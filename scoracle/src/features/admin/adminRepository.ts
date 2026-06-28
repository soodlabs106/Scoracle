import { supabase } from '../../lib/supabaseClient'
import type { AdminProfileRow } from '../../types/auth'

export type ActivityEventType =
  | 'ACCOUNT_CREATED' | 'SIGNED_IN' | 'SIGNED_OUT' | 'SESSION_TIMEOUT'
  | 'PREDICTION_CREATED' | 'PREDICTION_UPDATED' | 'PREDICTION_DELETED'
  | 'PROFILE_UPDATED' | 'ONBOARDING_COMPLETED' | 'USER_DISABLED' | 'USER_ENABLED'

export type ActivityLogRow = {
  id: number
  user_id: string | null
  target_user_id: string | null
  event_type: ActivityEventType
  metadata: Record<string, unknown>
  created_at: string
}

export type SystemJobRunStatus = 'success' | 'failed' | 'skipped'

export type SystemJobRunRow = {
  id: string
  job_name: string
  status: SystemJobRunStatus
  details: Record<string, unknown> | null
  ran_at: string
}

export type AdminPredictionRow = {
  id: string; fixture_id: string; match_week: number
  predicted_home_score: number; predicted_away_score: number
  closeness: string | null; points: number; is_locked: boolean; created_at: string
}

export type AdminFixtureRow = {
  id: string; matchweek: number; kickoff_utc: string; status: string
  home_score: number | null; away_score: number | null
  home_team_id: string; away_team_id: string
}

export type AdminTeamRow = { id: string; canonical_name: string; crest_url: string | null }

export async function fetchAdminUsers(offset: number, pageSize: number) {
  const { data, error } = await supabase.from('profiles')
    .select('id, username, first_name, last_name, role, is_disabled, favorite_club, avatar_url, onboarding_required, onboarding_completed_at, created_at')
    .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
  if (error) throw error
  return (data ?? []) as AdminProfileRow[]
}

export async function fetchAdminActivityLogs(
  offset: number,
  pageSize: number,
  eventType: 'all' | ActivityEventType,
  userId: string,
) {
  let query = supabase.from('app_activity_logs')
    .select('id, user_id, target_user_id, event_type, metadata, created_at')
    .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
  if (eventType !== 'all') query = query.eq('event_type', eventType)
  if (userId !== 'all') query = query.or(`user_id.eq.${userId},target_user_id.eq.${userId}`)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ActivityLogRow[]
}

export async function fetchSystemJobRuns(limit = 50) {
  const safeLimit = Math.min(Math.max(limit, 1), 50)
  const { data, error } = await supabase
    .from('system_job_runs')
    .select('id, job_name, status, details, ran_at')
    .order('ran_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw error
  return (data ?? []) as SystemJobRunRow[]
}

export function isSystemJobRunsMigrationMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message =
    typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''

  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    (message.includes('system_job_runs') &&
      (message.includes('schema cache') || message.includes('does not exist')))
  )
}

export async function fetchAdminUserDetails(userId: string) {
  const { data: predictions, error: predictionError } = await supabase.from('predictions')
    .select('id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at')
    .eq('user_id', userId).order('match_week', { ascending: false })
    .order('created_at', { ascending: false }).limit(25)
  if (predictionError) throw predictionError
  const predictionRows = (predictions ?? []) as AdminPredictionRow[]
  const fixtureIds = [...new Set(predictionRows.map((row) => row.fixture_id))]
  if (!fixtureIds.length) return { predictions: predictionRows, fixtures: [], teams: [] }

  const { data: fixtures, error: fixtureError } = await supabase.from('fixtures')
    .select('id, matchweek, kickoff_utc, status, home_score, away_score, home_team_id, away_team_id')
    .in('id', fixtureIds)
  if (fixtureError) throw fixtureError
  const fixtureRows = (fixtures ?? []) as AdminFixtureRow[]
  const teamIds = [...new Set(fixtureRows.flatMap((row) => [row.home_team_id, row.away_team_id]))]
  if (!teamIds.length) return { predictions: predictionRows, fixtures: fixtureRows, teams: [] }

  const { data: teams, error: teamError } = await supabase.from('teams')
    .select('id, canonical_name, crest_url').in('id', teamIds)
  if (teamError) throw teamError
  return { predictions: predictionRows, fixtures: fixtureRows, teams: (teams ?? []) as AdminTeamRow[] }
}

export async function updateAdminUserStatus(
  accessToken: string,
  targetUserId: string,
  disabled: boolean,
) {
  const response = await fetch('/api/admin/user-status', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ targetUserId, disabled }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'Could not update user status.')
  return body as AdminProfileRow
}
