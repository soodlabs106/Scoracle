import { supabase } from '../../lib/supabaseClient'
import type { PredictionCloseness } from '../../utils/predictionScoring'

const AVATAR_BUCKET = 'profile-avatars'

export type PredictionHistoryRpcRow = {
  prediction_id: string
  fixture_id: string
  match_week: number
  predicted_home_score: number
  predicted_away_score: number
  closeness: PredictionCloseness | null
  points: number
  is_locked: boolean
  prediction_created_at: string
  prediction_updated_at: string
  kickoff_utc: string
  home_score: number | null
  away_score: number | null
  home_team_name: string
  away_team_name: string
  home_team_code: string | null
  away_team_code: string | null
  home_team_crest_url: string | null
  away_team_crest_url: string | null
  matchweek_lock_at: string
}

export async function fetchMyPredictionHistory() {
  const { data, error } = await supabase.rpc('get_my_prediction_history')

  if (error) {
    if (isMissingPredictionHistoryFunction(error)) {
      return fetchPredictionHistoryFromTables()
    }

    throw error
  }

  return (data ?? []) as PredictionHistoryRpcRow[]
}

async function fetchPredictionHistoryFromTables(): Promise<PredictionHistoryRpcRow[]> {
  const { data: predictions, error: predictionError } = await supabase
    .from('predictions')
    .select(
      'id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at, updated_at',
    )
    .order('match_week', { ascending: false })

  if (predictionError) throw predictionError
  if (!predictions?.length) return []

  const fixtureIds = [...new Set(predictions.map((row) => row.fixture_id))]
  const { data: fixtures, error: fixtureError } = await supabase
    .from('fixtures')
    .select(
      'id, matchweek, kickoff_utc, home_score, away_score, home_team_id, away_team_id',
    )
    .in('id', fixtureIds)

  if (fixtureError) throw fixtureError

  const fixtureRows = fixtures ?? []
  const fixturesById = new Map(fixtureRows.map((row) => [row.id, row]))
  const teamIds = [
    ...new Set(
      fixtureRows.flatMap((row) => [row.home_team_id, row.away_team_id]),
    ),
  ]
  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, canonical_name, team_code, crest_url')
    .in('id', teamIds)

  if (teamError) throw teamError

  const teamsById = new Map((teams ?? []).map((row) => [row.id, row]))
  return predictions.flatMap((prediction) => {
    const fixture = fixturesById.get(prediction.fixture_id)
    if (!fixture) return []

    const homeTeam = teamsById.get(fixture.home_team_id)
    const awayTeam = teamsById.get(fixture.away_team_id)
    const lockAt = new Date(new Date(fixture.kickoff_utc).getTime()).toISOString()

    return [{
      prediction_id: prediction.id,
      fixture_id: prediction.fixture_id,
      match_week: prediction.match_week,
      predicted_home_score: prediction.predicted_home_score,
      predicted_away_score: prediction.predicted_away_score,
      closeness: prediction.closeness as PredictionCloseness | null,
      points: prediction.points,
      is_locked: prediction.is_locked,
      prediction_created_at: prediction.created_at,
      prediction_updated_at: prediction.updated_at,
      kickoff_utc: fixture.kickoff_utc,
      home_score: fixture.home_score,
      away_score: fixture.away_score,
      home_team_name: homeTeam?.canonical_name ?? 'Home team',
      away_team_name: awayTeam?.canonical_name ?? 'Away team',
      home_team_code: homeTeam?.team_code ?? null,
      away_team_code: awayTeam?.team_code ?? null,
      home_team_crest_url: homeTeam?.crest_url ?? null,
      away_team_crest_url: awayTeam?.crest_url ?? null,
      matchweek_lock_at: lockAt,
    }]
  })
}

function isMissingPredictionHistoryFunction(error: {
  code?: string
  message?: string
}) {
  return (
    error.code === 'PGRST202' ||
    error.message?.includes(
      'Could not find the function public.get_my_prediction_history',
    ) === true
  )
}

export async function uploadProfileAvatar(userId: string, file: Blob) {
  const path = `${userId}/avatar-${Date.now()}.webp`
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: 'image/webp',
    upsert: true,
  })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

export async function removeProfileAvatar(path: string) {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path])

  if (error) {
    throw error
  }
}
