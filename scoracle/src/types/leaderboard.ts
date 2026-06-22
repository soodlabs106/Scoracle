export type LeaderboardRow = {
  user_id: string
  username: string
  favorite_club: string | null
  avatar_url?: string | null
  total_points: number
  scored_predictions: number
  exact_count: number
  great_count: number
  close_count: number
  near_miss_count?: number
  miss_count?: number
}

export type MatchWeekLeaderboardRow = LeaderboardRow & {
  match_week: number
}

export type RankMovementRow = {
  user_id: string
  username: string
  favorite_club: string | null
  avatar_url?: string | null
  match_week: number
  current_rank: number
  previous_rank: number | null
  rank_change: number | null
  weekly_points: number
  overall_points_after_week: number
  exact_count: number
  great_count: number
  close_count: number
}
