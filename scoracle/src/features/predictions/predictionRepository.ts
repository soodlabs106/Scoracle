import { supabase } from '../../lib/supabaseClient'
import type { PredictionRow } from '../../types/predictions'

const PREDICTION_COLUMNS =
  'id, user_id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at, updated_at'
const LOCAL_PREDICTIONS_KEY = 'scoracle-local-predictions-v1'

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

  const localRows = readLocalPredictions().filter(
    (prediction) =>
      prediction.user_id === userId && prediction.match_week === matchWeek,
  )

  return [...((data ?? []) as PredictionRow[]), ...localRows]
}

export function listLocalPredictionsForUser(userId: string) {
  return readLocalPredictions().filter((prediction) => prediction.user_id === userId)
}

export async function savePredictions(rows: PredictionUpsert[]) {
  const databaseRows = rows.filter((row) => isUuid(row.fixture_id))
  const localRows = rows.filter((row) => !isUuid(row.fixture_id))
  const savedRows: PredictionRow[] = []

  if (databaseRows.length > 0) {
    const { data, error } = await supabase
      .from('predictions')
      .upsert(databaseRows, { onConflict: 'user_id,fixture_id' })
      .select(PREDICTION_COLUMNS)

    if (error) {
      throw new Error(error.message)
    }

    savedRows.push(...((data ?? []) as PredictionRow[]))
  }

  if (localRows.length > 0) {
    savedRows.push(...writeLocalPredictions(localRows))
  }

  return savedRows
}

export async function removePrediction(predictionId: string) {
  if (predictionId.startsWith('local:')) {
    deleteLocalPrediction(predictionId)
    return
  }

  const { error } = await supabase
    .from('predictions')
    .delete()
    .eq('id', predictionId)

  if (error) {
    throw new Error(error.message)
  }
}

function readLocalPredictions() {
  if (typeof window === 'undefined') {
    return [] as PredictionRow[]
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_PREDICTIONS_KEY)

    if (!raw) {
      return []
    }

    return JSON.parse(raw) as PredictionRow[]
  } catch {
    return []
  }
}

function writeLocalPredictions(rows: PredictionUpsert[]) {
  const currentRows = readLocalPredictions()
  const rowsByIdentity = new Map(
    currentRows.map((row) => [`${row.user_id}:${row.fixture_id}`, row]),
  )
  const now = new Date().toISOString()
  const savedRows: PredictionRow[] = []

  for (const row of rows) {
    const existing = rowsByIdentity.get(`${row.user_id}:${row.fixture_id}`)
    const savedRow: PredictionRow = {
      id: existing?.id ?? `local:${row.user_id}:${row.fixture_id}`,
      fixture_id: row.fixture_id,
      user_id: row.user_id,
      match_week: row.match_week,
      predicted_home_score: row.predicted_home_score,
      predicted_away_score: row.predicted_away_score,
      closeness: row.closeness,
      points: row.points,
      is_locked: row.is_locked,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }

    rowsByIdentity.set(`${row.user_id}:${row.fixture_id}`, savedRow)
    savedRows.push(savedRow)
  }

  persistLocalPredictions(Array.from(rowsByIdentity.values()))
  return savedRows
}

function deleteLocalPrediction(predictionId: string) {
  const nextRows = readLocalPredictions().filter((row) => row.id !== predictionId)
  persistLocalPredictions(nextRows)
}

function persistLocalPredictions(rows: PredictionRow[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(LOCAL_PREDICTIONS_KEY, JSON.stringify(rows))
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}
