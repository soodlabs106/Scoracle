import type { Fixture } from '../../data/homeData'
import type { PredictionRow } from '../../types/predictions'

export type FixtureHistoryRow = {
  id: string
  matchweek: number
  kickoffUtc: string
  homeScore: number | null
  awayScore: number | null
}

export type HistoryItem = {
  prediction: PredictionRow
  fixture?: FixtureHistoryRow
  homeTeam?: string
  awayTeam?: string
  homeTeamCode?: string
  awayTeamCode?: string
  homeTeamCrestUrl?: string
  awayTeamCrestUrl?: string
  matchweekLockAt?: string
}

export function getFixturePredictionKey(fixture: Fixture) {
  return fixture.dbId ?? `provider:${fixture.providerFixtureId ?? fixture.id}`
}

export function getProfileFixtureLockAt(fixture: Fixture) {
  return new Date(
    new Date(fixture.kickoffUtc).getTime() - 60 * 60 * 1000,
  ).toISOString()
}

export function compareHistoryItems(first: HistoryItem, second: HistoryItem) {
  const weekDelta = second.prediction.match_week - first.prediction.match_week

  if (weekDelta !== 0) {
    return weekDelta
  }

  return (
    new Date(first.fixture?.kickoffUtc ?? 0).getTime() -
    new Date(second.fixture?.kickoffUtc ?? 0).getTime()
  )
}

export function isHistoryItemLocked(item: HistoryItem) {
  if (!item.matchweekLockAt) {
    return true
  }

  return Date.now() >= new Date(item.matchweekLockAt).getTime()
}
