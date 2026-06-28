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
    throw error
  }

  return (data ?? []) as PredictionHistoryRpcRow[]
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
