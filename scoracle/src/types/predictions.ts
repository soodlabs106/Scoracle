import type { PredictionCloseness } from '../utils/predictionScoring'

export type PredictionRow = {
  id: string
  user_id: string
  fixture_id: string
  match_week: number
  predicted_home_score: number
  predicted_away_score: number
  closeness: PredictionCloseness | null
  points: number
  is_locked: boolean
  created_at: string
  updated_at: string
}

export type PredictionDraft = {
  home: string
  away: string
}
