# Supabase Maintenance

## Purpose

`Scoracle Supabase Maintenance` performs legitimate, lightweight application maintenance once per day. It counts active Scoracle profiles, deletes chat messages older than 30 days, and records the result in `public.system_job_runs`. The workflow invokes the reviewed `scripts/supabase-maintenance.sh` script. It is not a fake ping and does not call Netlify, football providers, email services, or frontend endpoints.

The workflow reduces the chance of a Supabase Free project being considered inactive, but Supabase controls Free-plan pause policy and does not guarantee that any particular request prevents a pause. Check the current Supabase plan terms periodically.

## Schedule And Usage

- Schedule: daily at `03:17 UTC` / `08:47 India time`.
- GitHub Actions: about 30 short runs per month.
- Supabase: about 30 bounded reads, chat-retention calls, and audit inserts per month.
- The workflow has a five-minute job timeout and each request has a 30-second timeout.
- It does not commit, push, build, or deploy anything.

## Required GitHub Secrets

Create these repository secrets under **GitHub > Repository settings > Secrets and variables > Actions**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is backend-only. Never place it in a `VITE_` variable, browser code, screenshots, workflow output, or documentation. Rotate it immediately if it is exposed.

## Manual Run

1. Apply the pending Supabase migrations, including `20260701230000_authenticated_general_chat.sql`.
2. Push the workflow to GitHub.
3. Open **GitHub > Actions > Scoracle Supabase Maintenance**.
4. Select **Run workflow**.
5. Wait for the single maintenance job to complete.
6. Check `public.system_job_runs` in Supabase or open **Scoracle Admin > System Maintenance**.

The admin page loads only the newest 50 rows. RLS permits reads only when the authenticated user's `profiles.role` is `admin`; the service role performs workflow inserts and bypasses RLS. Anonymous and normal authenticated users cannot read or modify the table.

## Status Values

- `success`: the bounded profile count, available chat cleanup, and audit insert completed.
- `failed`: a step failed and the workflow managed to write a sanitized failure row.
- `skipped`: reserved for a legitimate optional check. Chat cleanup is safely skipped if its RPC was removed during a documented feature rollback.

Stored details include the workflow/run identifiers, trigger, timestamp, active-profile count, chat cleanup status/deleted count, and sanitized failure location. Secrets, tokens, authorization headers, cookies, and raw Supabase error bodies are never stored.

## Troubleshooting

- **Missing secrets:** add both repository secrets and run the workflow again.
- **HTTP 401/403:** verify the URL and service-role key belong to the same Supabase project; rotate the key if its status is uncertain.
- **HTTP 404 for `system_job_runs`:** apply the migration, then allow Supabase's PostgREST schema cache to refresh.
- **Admin page cannot read logs:** confirm the user has `profiles.role = 'admin'`, is not disabled, and the migration/policy exists.
- **No failed row:** if Supabase itself is unreachable or authentication is invalid, the best-effort failure insert cannot succeed. GitHub Actions remains the source for that failure.
- **Schedule is delayed:** GitHub schedules can start later than the exact cron minute. Use `workflow_dispatch` to verify immediately.
