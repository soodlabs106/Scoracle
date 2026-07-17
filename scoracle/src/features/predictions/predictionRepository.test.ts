import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  fromMock,
  selectSpy,
  upsertSpy,
  deleteSpy,
  eqSpy,
  inSpy,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectSpy: vi.fn(),
  upsertSpy: vi.fn(),
  deleteSpy: vi.fn(),
  eqSpy: vi.fn(),
  inSpy: vi.fn(),
}))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: fromMock,
  },
}))

import {
  listLocalPredictionsForUser,
  listPredictionsForMatchWeek,
  removePrediction,
  savePredictions,
} from './predictionRepository'

function buildSelectQuery(data: unknown[] = []) {
  const query = {
    select: selectSpy.mockReturnThis(),
    eq: eqSpy.mockReturnThis(),
    in: inSpy.mockReturnThis(),
    then(onfulfilled: (value: { data: unknown[]; error: null }) => unknown) {
      return Promise.resolve({ data, error: null }).then(onfulfilled)
    },
  }

  selectSpy.mockReturnValue(query)
  eqSpy.mockReturnValue(query)
  inSpy.mockReturnValue(query)
  return query
}

describe('prediction repository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    fromMock.mockReset()
    selectSpy.mockReset()
    upsertSpy.mockReset()
    deleteSpy.mockReset()
    eqSpy.mockReset()
    inSpy.mockReset()
  })

  it('returns preseason predictions from Supabase and local storage for matchweek zero', async () => {
    window.localStorage.setItem(
      'scoracle-local-predictions-v1',
      JSON.stringify([
        {
          id: 'local:user-1:provider:128731',
          user_id: 'user-1',
          fixture_id: 'provider:128731',
          match_week: 0,
          predicted_home_score: 3,
          predicted_away_score: 1,
          closeness: null,
          points: 0,
          is_locked: false,
          created_at: '2026-07-17T00:00:00.000Z',
          updated_at: '2026-07-17T00:00:00.000Z',
        },
      ]),
    )

    fromMock.mockReturnValue(buildSelectQuery([
      {
        id: 'remote-1',
        user_id: 'user-1',
        fixture_id: 'ce8c85ac-6782-4549-99fa-56de09ee0588',
        match_week: 0,
        predicted_home_score: 2,
        predicted_away_score: 0,
        closeness: null,
        points: 0,
        is_locked: false,
        created_at: '2026-07-17T00:00:00.000Z',
        updated_at: '2026-07-17T00:00:00.000Z',
      },
    ]))

    const rows = await listPredictionsForMatchWeek('user-1', 0)

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.fixture_id)).toEqual([
      'ce8c85ac-6782-4549-99fa-56de09ee0588',
      'provider:128731',
    ])
  })

  it('saves UUID fixtures to Supabase and non-UUID fixtures locally', async () => {
    const databaseRows = [
      {
        user_id: 'user-1',
        fixture_id: 'ce8c85ac-6782-4549-99fa-56de09ee0588',
        match_week: 0,
        predicted_home_score: 2,
        predicted_away_score: 1,
        closeness: null,
        points: 0,
        is_locked: false,
      },
    ]

    const remoteSavedRow = {
      id: 'remote-1',
      created_at: '2026-07-17T00:00:00.000Z',
      updated_at: '2026-07-17T00:00:00.000Z',
      ...databaseRows[0],
    }

    const upsertSelect = vi.fn().mockResolvedValue({
      data: [remoteSavedRow],
      error: null,
    })
    const upsertQuery = {
      select: upsertSelect,
    }
    upsertSpy.mockReturnValue(upsertQuery)

    fromMock.mockReturnValue({
      upsert: upsertSpy,
    })

    const saved = await savePredictions([
      ...databaseRows,
      {
        user_id: 'user-1',
        fixture_id: 'provider:128731',
        match_week: 0,
        predicted_home_score: 3,
        predicted_away_score: 1,
        closeness: null,
        points: 0,
        is_locked: false,
      },
    ])

    expect(upsertSpy).toHaveBeenCalledWith(databaseRows, {
      onConflict: 'user_id,fixture_id',
    })
    expect(saved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'remote-1' }),
        expect.objectContaining({
          id: 'local:user-1:provider:128731',
          fixture_id: 'provider:128731',
        }),
      ]),
    )
    expect(listLocalPredictionsForUser('user-1')).toEqual([
      expect.objectContaining({
        fixture_id: 'provider:128731',
        match_week: 0,
      }),
    ])
  })

  it('deletes local predictions without calling Supabase and remote predictions through Supabase', async () => {
    window.localStorage.setItem(
      'scoracle-local-predictions-v1',
      JSON.stringify([
        {
          id: 'local:user-1:provider:128731',
          user_id: 'user-1',
          fixture_id: 'provider:128731',
          match_week: 0,
          predicted_home_score: 3,
          predicted_away_score: 1,
          closeness: null,
          points: 0,
          is_locked: false,
          created_at: '2026-07-17T00:00:00.000Z',
          updated_at: '2026-07-17T00:00:00.000Z',
        },
      ]),
    )

    await removePrediction('local:user-1:provider:128731')
    expect(fromMock).not.toHaveBeenCalled()
    expect(listLocalPredictionsForUser('user-1')).toHaveLength(0)

    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    deleteSpy.mockReturnValue({ eq: deleteEq })
    fromMock.mockReturnValue({ delete: deleteSpy })

    await removePrediction('remote-1')

    expect(deleteSpy).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 'remote-1')
  })
})
