#!/usr/bin/env bash
set -Eeuo pipefail

temp_dir="$(mktemp -d)"
failure_step="initialization"
http_status=""
audit_written="false"

cleanup() {
  rm -rf "${temp_dir}"
}

post_job_run() {
  local payload="$1"
  curl --silent --show-error \
    --connect-timeout 10 \
    --max-time 30 \
    --output "${temp_dir}/audit-body.json" \
    --write-out "%{http_code}" \
    --request POST \
    --header "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    --header "Content-Type: application/json" \
    --header "Prefer: return=minimal" \
    --data "${payload}" \
    "${SUPABASE_URL%/}/rest/v1/system_job_runs"
}

handle_failure() {
  local exit_code="$1"
  trap - ERR
  set +e

  echo "Maintenance failed during ${failure_step}."
  local timestamp_utc
  timestamp_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local safe_status="${http_status:-unavailable}"
  local details
  details="$(jq -n \
    --arg source "github_actions" \
    --arg purpose "scoracle_supabase_daily_maintenance" \
    --arg workflow "${WORKFLOW_NAME}" \
    --arg repository "${REPOSITORY}" \
    --arg commit_sha "${COMMIT_SHA}" \
    --arg run_id "${RUN_ID}" \
    --arg run_attempt "${RUN_ATTEMPT}" \
    --arg trigger "${TRIGGER}" \
    --arg timestamp_utc "${timestamp_utc}" \
    --arg step "${failure_step}" \
    --arg http_status "${safe_status}" \
    '{source: $source, purpose: $purpose, workflow: $workflow, repository: $repository, commit_sha: $commit_sha, run_id: $run_id, run_attempt: $run_attempt, trigger: $trigger, timestamp_utc: $timestamp_utc, error: {step: $step, message: "Supabase maintenance request failed", http_status: $http_status}}')"
  local payload
  payload="$(jq -n \
    --arg job_name "github-daily-maintenance" \
    --arg status "failed" \
    --argjson details "${details}" \
    '[{job_name: $job_name, status: $status, details: $details}]')"

  if [[ "${audit_written}" != "true" ]]; then
    local failure_log_status
    if failure_log_status="$(post_job_run "${payload}")" &&
      [[ "${failure_log_status}" =~ ^2 ]]; then
      echo "A sanitized failed-run audit row was written."
    else
      echo "Could not write the failed-run audit row (HTTP ${failure_log_status:-unavailable})."
    fi
  fi

  exit "${exit_code}"
}

trap cleanup EXIT
trap 'handle_failure $?' ERR

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Required GitHub repository secrets are missing."
  exit 1
fi

echo "Starting Scoracle Supabase maintenance."
echo "Running lightweight active-profile count."
failure_step="lightweight_read"
if ! http_status="$(curl --silent --show-error \
  --connect-timeout 10 \
  --max-time 30 \
  --output "${temp_dir}/read-body.json" \
  --dump-header "${temp_dir}/read-headers.txt" \
  --write-out "%{http_code}" \
  --header "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "Prefer: count=exact" \
  "${SUPABASE_URL%/}/rest/v1/profiles?select=id&is_disabled=eq.false&limit=1")"; then
  http_status="network_error"
  false
fi

if [[ ! "${http_status}" =~ ^2 ]]; then
  false
fi

active_profile_count="$(awk -F/ 'tolower($1) ~ /^content-range:/ {gsub(/\r/, "", $2); print $2}' "${temp_dir}/read-headers.txt" | tail -n 1)"
if [[ ! "${active_profile_count}" =~ ^[0-9]+$ ]]; then
  failure_step="parse_lightweight_read"
  http_status="invalid_content_range"
  false
fi

echo "Lightweight check completed successfully."

# Chat messages are intentionally retained for no more than 30 days. The RPC
# can be absent after an emergency feature rollback; that is a safe skip.
echo "Pruning expired chat messages."
failure_step="chat_retention_cleanup"
chat_cleanup_status="success"
chat_deleted_count=0
if ! http_status="$(curl --silent --show-error \
  --connect-timeout 10 \
  --max-time 30 \
  --output "${temp_dir}/chat-cleanup-body.json" \
  --write-out "%{http_code}" \
  --request POST \
  --header "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "Content-Type: application/json" \
  --data '{}' \
  "${SUPABASE_URL%/}/rest/v1/rpc/prune_chat_messages")"; then
  http_status="network_error"
  false
fi

if [[ "${http_status}" =~ ^2 ]]; then
  chat_deleted_count="$(jq -er 'if type == "number" then . else error("invalid cleanup count") end' "${temp_dir}/chat-cleanup-body.json")"
elif [[ "${http_status}" == "404" ]] &&
  jq -e '.code == "PGRST202"' "${temp_dir}/chat-cleanup-body.json" >/dev/null 2>&1; then
  chat_cleanup_status="skipped"
  echo "Chat cleanup RPC is not installed; cleanup skipped safely."
else
  false
fi

echo "Chat retention cleanup ${chat_cleanup_status} (${chat_deleted_count} messages deleted)."
timestamp_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
details="$(jq -n \
  --arg source "github_actions" \
  --arg purpose "scoracle_supabase_daily_maintenance" \
  --arg workflow "${WORKFLOW_NAME}" \
  --arg repository "${REPOSITORY}" \
  --arg commit_sha "${COMMIT_SHA}" \
  --arg run_id "${RUN_ID}" \
  --arg run_attempt "${RUN_ATTEMPT}" \
  --arg trigger "${TRIGGER}" \
  --arg timestamp_utc "${timestamp_utc}" \
  --argjson active_profile_count "${active_profile_count}" \
  --arg chat_cleanup_status "${chat_cleanup_status}" \
  --argjson chat_deleted_count "${chat_deleted_count}" \
  '{source: $source, purpose: $purpose, workflow: $workflow, repository: $repository, commit_sha: $commit_sha, run_id: $run_id, run_attempt: $run_attempt, trigger: $trigger, timestamp_utc: $timestamp_utc, lightweight_check: {type: "active_profiles_count", success: true, count: $active_profile_count, summary: (($active_profile_count | tostring) + " active profiles")}, chat_retention: {status: $chat_cleanup_status, deleted_count: $chat_deleted_count, retention_days: 14}, checks: {lightweight_read: true, chat_cleanup: ($chat_cleanup_status == "success"), audit_insert: true}}')"
payload="$(jq -n \
  --arg job_name "github-daily-maintenance" \
  --arg status "success" \
  --argjson details "${details}" \
  '[{job_name: $job_name, status: $status, details: $details}]')"

echo "Writing maintenance audit row."
failure_step="audit_insert"
if ! http_status="$(post_job_run "${payload}")"; then
  http_status="network_error"
  false
fi
if [[ ! "${http_status}" =~ ^2 ]]; then
  false
fi
audit_written="true"

echo "Scoracle Supabase maintenance completed successfully."
