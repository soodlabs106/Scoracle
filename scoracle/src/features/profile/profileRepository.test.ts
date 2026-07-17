import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
    storage: { from: vi.fn() },
  },
}))

import { fetchMyPredictionHistory } from './profileRepository'

type QueryResult<T> = { data: T; error: null }

class QueryBuilder<T> implements PromiseLike<QueryResult<T>> {
  private readonly result: QueryResult<T>

  constructor(result: QueryResult<T>) {
    this.result = result
  }
  select() { return this }
  order() { return this }
  in() { return this }
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

describe('prediction history compatibility', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    fromMock.mockReset()
  })

  it('reconstructs saved history when the joined RPC is not deployed', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message:
          'Could not find the function public.get_my_prediction_history without parameters in the schema cache',
      },
    })

    const responses = [
      new QueryBuilder({
        data: [
          {
            id: 'prediction-1', fixture_id: 'fixture-1', match_week: 1,
            predicted_home_score: 2, predicted_away_score: 1,
            closeness: null, points: 0, is_locked: false,
            created_at: '2026-06-01T00:00:00.000Z',
            updated_at: '2026-06-01T00:00:00.000Z',
          },
          {
            id: 'prediction-2', fixture_id: 'fixture-2', match_week: 0,
            predicted_home_score: 3, predicted_away_score: 1,
            closeness: null, points: 0, is_locked: false,
            created_at: '2026-07-17T00:00:00.000Z',
            updated_at: '2026-07-17T00:00:00.000Z',
          },
        ],
        error: null,
      }),
      new QueryBuilder({
        data: [
          {
            id: 'fixture-1', matchweek: 1,
            kickoff_utc: '2026-08-22T19:00:00.000Z',
            home_score: null, away_score: null,
            home_team_id: 'home-1', away_team_id: 'away-1',
          },
          {
            id: 'fixture-2', matchweek: 0,
            kickoff_utc: '2026-07-24T16:00:00.000Z',
            home_score: null, away_score: null,
            home_team_id: 'away-1', away_team_id: 'home-1',
          },
        ],
        error: null,
      }),
      new QueryBuilder({
        data: [
          { id: 'home-1', canonical_name: 'Arsenal', team_code: 'ARS', crest_url: '/ars.webp' },
          { id: 'away-1', canonical_name: 'Leeds United', team_code: 'LEE', crest_url: '/lee.webp' },
        ],
        error: null,
      }),
    ]
    fromMock.mockImplementation(() => responses.shift())

    const rows = await fetchMyPredictionHistory()

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      prediction_id: 'prediction-1',
      home_team_code: 'ARS',
      away_team_code: 'LEE',
      predicted_home_score: 2,
      predicted_away_score: 1,
      matchweek_lock_at: '2026-08-22T18:00:00.000Z',
    })
    expect(rows[1]).toMatchObject({
      prediction_id: 'prediction-2',
      match_week: 0,
      home_team_code: 'LEE',
      away_team_code: 'ARS',
      predicted_home_score: 3,
      predicted_away_score: 1,
      matchweek_lock_at: '2026-07-24T15:00:00.000Z',
    })
  })

  it('does not mask unrelated history errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Access denied' },
    })

    await expect(fetchMyPredictionHistory()).rejects.toMatchObject({
      message: 'Access denied',
    })
  })
})
