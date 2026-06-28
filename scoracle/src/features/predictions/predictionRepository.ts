import { supabase } from '../../lib/supabaseClient'
import type { PredictionRow } from '../../types/predictions'

const PREDICTION_COLUMNS =
  'id, user_id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at, updated_at'

export type PredictionUpsert = Pick<
  PredictionRow,
  | 'user_id'
  | 'fixture_id'
  | 'match_week'
  | 'predicted_home_score'
  | 'predicted_away_score'
  | 'closeness'
  | 'points'
  | 'is_locked'
>

export async function listPredictionsForMatchWeek(
  userId: string,
  matchWeek: number,
) {
  const { data, error } = await supabase
    .from('predictions')
    .select(PREDICTION_COLUMNS)
    .eq('user_id', userId)
    .eq('match_week', matchWeek)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PredictionRow[]
}

export async function savePredictions(rows: PredictionUpsert[]) {
  const { data, error } = await supabase
    .from('predictions')
    .upsert(rows, { onConflict: 'user_id,fixture_id' })
    .select(PREDICTION_COLUMNS)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PredictionRow[]
}

export async function removePrediction(predictionId: string) {
  const { error } = await supabase
    .from('predictions')
    .delete()
    .eq('id', predictionId)

  if (error) {
    throw new Error(error.message)
  }
}
