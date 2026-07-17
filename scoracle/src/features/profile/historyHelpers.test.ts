import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Fixture } from '../../data/homeData'
import type { PredictionRow } from '../../types/predictions'
import {
  compareHistoryItems,
  getFixturePredictionKey,
  getProfileFixtureLockAt,
  isHistoryItemLocked,
  type HistoryItem,
} from './historyHelpers'

function buildFixture(overrides: Partial<Fixture>): Fixture {
  return {
    id: '128731',
    matchweek: 0,
    kickoffUtc: '2026-07-18T15:00:00.000Z',
    status: 'Not played yet',
    venue: 'Helsinki Olympic Stadium, Helsinki',
    homeTeamId: '12',
    awayTeamId: '195',
    homeScore: null,
    awayScore: null,
    scorers: [],
    assists: [],
    ...overrides,
  }
}

function buildPrediction(overrides: Partial<PredictionRow> = {}): PredictionRow {
  return {
    id: 'prediction-1',
    user_id: 'user-1',
    fixture_id: 'ce8c85ac-6782-4549-99fa-56de09ee0588',
    match_week: 0,
    predicted_home_score: 3,
    predicted_away_score: 1,
    closeness: null,
    points: 0,
    is_locked: false,
    created_at: '2026-07-17T00:00:00.000Z',
    updated_at: '2026-07-17T00:00:00.000Z',
    ...overrides,
  }
}

describe('profile history helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes fixture-level lock timestamps and uses provider ids when no db id is present', () => {
    const fixture = buildFixture({
      dbId: undefined,
      providerFixtureId: '128731',
    })

    expect(getFixturePredictionKey(fixture)).toBe('provider:128731')
    expect(getProfileFixtureLockAt(fixture)).toBe('2026-07-18T14:00:00.000Z')
  })

  it('sorts preseason before league history by matchweek and kickoff', () => {
    const preseason: HistoryItem = {
      prediction: buildPrediction({
        id: 'prediction-preseason',
        match_week: 0,
      }),
      fixture: {
        id: 'fixture-preseason',
        matchweek: 0,
        kickoffUtc: '2026-07-18T15:00:00.000Z',
        homeScore: null,
        awayScore: null,
      },
      matchweekLockAt: '2026-07-18T14:00:00.000Z',
    }
    const league: HistoryItem = {
      prediction: buildPrediction({
        id: 'prediction-league',
        match_week: 1,
      }),
      fixture: {
        id: 'fixture-league',
        matchweek: 1,
        kickoffUtc: '2026-08-21T19:00:00.000Z',
        homeScore: null,
        awayScore: null,
      },
      matchweekLockAt: '2026-08-21T18:00:00.000Z',
    }

    const sorted = [preseason, league].sort(compareHistoryItems)

    expect(sorted.map((item) => item.prediction.id)).toEqual([
      'prediction-league',
      'prediction-preseason',
    ])
  })

  it('shows delete before lock time and lock after lock time', () => {
    const item: HistoryItem = {
      prediction: buildPrediction(),
      fixture: {
        id: 'fixture-preseason',
        matchweek: 0,
        kickoffUtc: '2026-07-18T15:00:00.000Z',
        homeScore: null,
        awayScore: null,
      },
      matchweekLockAt: '2026-07-18T14:00:00.000Z',
    }

    vi.setSystemTime(new Date('2026-07-17T12:00:00.000Z'))
    expect(isHistoryItemLocked(item)).toBe(false)

    vi.setSystemTime(new Date('2026-07-18T14:30:00.000Z'))
    expect(isHistoryItemLocked(item)).toBe(true)
  })
})
