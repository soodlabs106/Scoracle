import { supabase } from '../lib/supabaseClient'
import type {
  LeaderboardRow,
  MatchWeekLeaderboardRow,
  RankMovementRow,
} from '../types/leaderboard'

type MatchWeekRow = {
  match_week: number
}

type LeaderboardSimulation = {
  enabled?: boolean
  scoredMatchWeeks: number[]
  overall: LeaderboardRow[]
  matchWeeks: Record<string, MatchWeekLeaderboardRow[]>
  rankMovement: Record<string, RankMovementRow[]>
}

const LOCAL_SIMULATION_PATH = '/local-leaderboard-simulation.json'
let simulationPromise: Promise<LeaderboardSimulation | null> | null = null

export async function fetchOverallLeaderboard() {
  const simulation = await loadLocalSimulation()

  if (simulation?.enabled) {
    return normalizeLeaderboardRows(simulation.overall)
  }

  await scoreCurrentUserPredictions()

  const { data, error } = await supabase.rpc('get_overall_leaderboard')

  if (error) {
    throw new Error(error.message)
  }

  return normalizeLeaderboardRows(data ?? [])
}

export async function fetchMatchWeekLeaderboard(matchWeek: number) {
  const simulation = await loadLocalSimulation()

  if (simulation?.enabled) {
    return normalizeMatchWeekRows(simulation.matchWeeks[String(matchWeek)] ?? [])
  }

  await scoreCurrentUserPredictions()

  const { data, error } = await supabase.rpc('get_match_week_leaderboard', {
    selected_match_week: matchWeek,
  })

  if (error) {
    throw new Error(error.message)
  }

  return normalizeMatchWeekRows(data ?? [])
}

export async function fetchRankMovement(matchWeek: number) {
  const simulation = await loadLocalSimulation()

  if (simulation?.enabled) {
    return normalizeRankMovementRows(
      simulation.rankMovement[String(matchWeek)] ?? [],
    )
  }

  await scoreCurrentUserPredictions()

  const { data, error } = await supabase.rpc('get_match_week_rank_movement', {
    selected_match_week: matchWeek,
  })

  if (error) {
    throw new Error(error.message)
  }

  return normalizeRankMovementRows(data ?? [])
}

export async function fetchScoredMatchWeeks() {
  const simulation = await loadLocalSimulation()

  if (simulation?.enabled) {
    return simulation.scoredMatchWeeks
      .map((matchWeek) => Number(matchWeek))
      .filter((matchWeek) => Number.isInteger(matchWeek))
  }

  await scoreCurrentUserPredictions()

  const { data, error } = await supabase.rpc('get_scored_match_weeks')

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as MatchWeekRow[])
    .map((row) => Number(row.match_week))
    .filter((matchWeek) => Number.isInteger(matchWeek))
}

async function scoreCurrentUserPredictions() {
  const { error } = await supabase.rpc(
    'score_my_predictions_for_completed_fixtures',
  )

  if (error) {
    throw new Error(error.message)
  }
}

async function loadLocalSimulation() {
  if (!simulationPromise) {
    simulationPromise = fetch(LOCAL_SIMULATION_PATH, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }

        return (await response.json()) as LeaderboardSimulation
      })
      .catch(() => null)
  }

  return simulationPromise
}

function normalizeLeaderboardRows(rows: unknown[]): LeaderboardRow[] {
  return rows.map((row) => {
    const value = row as Record<string, unknown>

    return {
      user_id: String(value.user_id),
      username: String(value.username ?? ''),
      favorite_club:
        value.favorite_club === null || value.favorite_club === undefined
          ? null
          : String(value.favorite_club),
      avatar_url:
        value.avatar_url === null || value.avatar_url === undefined
          ? null
          : String(value.avatar_url),
      total_points: Number(value.total_points ?? 0),
      scored_predictions: Number(value.scored_predictions ?? 0),
      exact_count: Number(value.exact_count ?? 0),
      great_count: Number(value.great_count ?? 0),
      close_count: Number(value.close_count ?? 0),
      near_miss_count: Number(value.near_miss_count ?? 0),
      miss_count: Number(value.miss_count ?? 0),
    }
  })
}

function normalizeMatchWeekRows(rows: unknown[]): MatchWeekLeaderboardRow[] {
  return normalizeLeaderboardRows(rows).map((row, index) => ({
    ...row,
    match_week: Number((rows[index] as Record<string, unknown>).match_week ?? 0),
  }))
}

function normalizeRankMovementRows(rows: unknown[]): RankMovementRow[] {
  return rows.map((row) => {
    const value = row as Record<string, unknown>
    const previousRank = value.previous_rank
    const rankChange = value.rank_change

    return {
      user_id: String(value.user_id),
      username: String(value.username ?? ''),
      favorite_club:
        value.favorite_club === null || value.favorite_club === undefined
          ? null
          : String(value.favorite_club),
      avatar_url:
        value.avatar_url === null || value.avatar_url === undefined
          ? null
          : String(value.avatar_url),
      match_week: Number(value.match_week ?? 0),
      current_rank: Number(value.current_rank ?? 0),
      previous_rank:
        previousRank === null || previousRank === undefined
          ? null
          : Number(previousRank),
      rank_change:
        rankChange === null || rankChange === undefined
          ? null
          : Number(rankChange),
      weekly_points: Number(value.weekly_points ?? 0),
      overall_points_after_week: Number(value.overall_points_after_week ?? 0),
      exact_count: Number(value.exact_count ?? 0),
      great_count: Number(value.great_count ?? 0),
      close_count: Number(value.close_count ?? 0),
    }
  })
}
