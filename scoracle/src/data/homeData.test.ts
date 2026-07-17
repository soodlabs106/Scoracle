import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: fromMock,
  },
}))

import {
  attachFixtureDatabaseIds,
  normalizeHomeData,
  type HomeData,
} from './homeData'

type QueryResult<T> = { data: T; error: null | { message: string } }

class QueryBuilder<T> implements PromiseLike<QueryResult<T>> {
  private readonly result: QueryResult<T>

  constructor(result: QueryResult<T>) {
    this.result = result
  }
  select() { return this }
  eq() { return this }
  in() { return this }
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

describe('home data normalization', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('preserves preseason matchweek zero and normalizes mixed provider identifiers', () => {
    const input: HomeData = {
      teams: [
        {
          id: '12.0',
          name: 'Manchester United',
          shortName: 'Manchester United',
          teamCode: '',
        },
      ],
      standings: [
        {
          teamId: '12.0',
          position: 1,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        },
      ],
      fixtures: [
        {
          id: '128731.0',
          matchweek: 0,
          kickoffUtc: '2026-07-18T15:00:00.0000000Z',
          status: 'Not played yet',
          venue: 'Helsinki Olympic Stadium, Helsinki',
          homeTeamId: '12.0',
          awayTeamId: '195.0',
          homeScore: null,
          awayScore: null,
          scorers: [],
          assists: [],
          watch: 'TBC',
        },
      ],
      leaderboards: {
        scorers: [],
        assists: [],
        cleanSheets: [],
      },
      lastUpdated: '2026-07-17T00:00:00.000Z',
      sources: ['test'],
    }

    const normalized = normalizeHomeData(input)
    const united = normalized.teams.find((team) => team.id === '12')
    const wrexham = normalized.teams.find((team) => team.id === '195')

    expect(normalized.fixtures[0]).toMatchObject({
      id: '128731',
      providerFixtureId: '128731',
      matchweek: 0,
      homeTeamId: '12',
      awayTeamId: '195',
    })
    expect(normalized.standings[0].teamId).toBe('12')
    expect(united).toMatchObject({
      id: '12',
      teamCode: 'MUN',
      crestUrl: '/team-crests/12.webp',
    })
    expect(wrexham).toMatchObject({
      id: '195',
      name: 'Wrexham',
      teamCode: 'WRX',
      crestUrl: '/team-crests/195.png',
    })
  })

  it('attaches Supabase fixture UUIDs using provider fixture ids', async () => {
    fromMock.mockReturnValue(
      new QueryBuilder({
        data: [
          {
            id: 'ce8c85ac-6782-4549-99fa-56de09ee0588',
            provider_fixture_id: '128731',
          },
        ],
        error: null,
      }),
    )

    const input: HomeData = {
      teams: [],
      standings: [],
      fixtures: [
        {
          id: '128731',
          providerFixtureId: '128731',
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
        },
      ],
      leaderboards: {
        scorers: [],
        assists: [],
        cleanSheets: [],
      },
      lastUpdated: '2026-07-17T00:00:00.000Z',
      sources: ['test'],
    }

    const result = await attachFixtureDatabaseIds(input)

    expect(result.fixtures[0]).toMatchObject({
      id: '128731',
      providerFixtureId: '128731',
      dbId: 'ce8c85ac-6782-4549-99fa-56de09ee0588',
    })
  })
})
