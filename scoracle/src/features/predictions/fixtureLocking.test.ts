import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Fixture } from '../../data/homeData'
import {
  getDefaultPredictionMatchweek,
  getFixtureLockInfo,
  getPredictionDraftKey,
  getPredictionGroupLockInfo,
} from './fixtureLocking'

function buildFixture(overrides: Partial<Fixture>): Fixture {
  return {
    id: 'fixture-1',
    matchweek: 0,
    kickoffUtc: '2026-07-18T15:00:00.000Z',
    status: 'Not played yet',
    venue: 'Test venue',
    homeTeamId: '12',
    awayTeamId: '195',
    homeScore: null,
    awayScore: null,
    scorers: [],
    assists: [],
    ...overrides,
  }
}

describe('fixture locking helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks each fixture at kickoff and uses db ids for prediction keys', () => {
    vi.setSystemTime(new Date('2026-07-17T13:30:00.000Z'))
    const fixture = buildFixture({
      id: '128731',
      providerFixtureId: '128731',
      dbId: 'ce8c85ac-6782-4549-99fa-56de09ee0588',
    })

    expect(getPredictionDraftKey(fixture)).toBe(
      'ce8c85ac-6782-4549-99fa-56de09ee0588',
    )
    expect(getFixtureLockInfo(fixture)).toMatchObject({
      isLocked: false,
      lockAt: new Date('2026-07-18T15:00:00.000Z'),
    })

    vi.setSystemTime(new Date('2026-07-18T15:00:00.000Z'))
    expect(getFixtureLockInfo(fixture).isLocked).toBe(true)
  })

  it('treats completed fixtures as locked and reports mixed fixture groups', () => {
    vi.setSystemTime(new Date('2026-07-17T13:30:00.000Z'))
    const openFixture = buildFixture({ id: 'open-fixture' })
    const completedFixture = buildFixture({
      id: 'done-fixture',
      homeScore: 2,
      awayScore: 1,
    })
    const lockInfoByFixtureId = new Map([
      [openFixture.id, getFixtureLockInfo(openFixture)],
      [completedFixture.id, getFixtureLockInfo(completedFixture)],
    ])

    expect(getFixtureLockInfo(completedFixture).isLocked).toBe(true)
    expect(
      getPredictionGroupLockInfo(
        [openFixture, completedFixture],
        lockInfoByFixtureId,
      ),
    ).toEqual({
      allLocked: false,
      hasLockedFixtures: true,
    })
  })

  it('chooses the earliest still-editable matchweek, preserving preseason zero', () => {
    vi.setSystemTime(new Date('2026-07-17T10:00:00.000Z'))
    const fixtures = [
      buildFixture({
        id: 'preseason-open',
        matchweek: 0,
        kickoffUtc: '2026-07-18T15:00:00.000Z',
      }),
      buildFixture({
        id: 'mw1-open',
        matchweek: 1,
        kickoffUtc: '2026-08-21T19:00:00.000Z',
      }),
    ]

    expect(getDefaultPredictionMatchweek(fixtures)).toBe(0)

    vi.setSystemTime(new Date('2026-07-18T14:59:00.000Z'))
    expect(getDefaultPredictionMatchweek(fixtures)).toBe(0)

    vi.setSystemTime(new Date('2026-07-18T15:00:00.000Z'))
    expect(getDefaultPredictionMatchweek(fixtures)).toBe(1)
  })
})
