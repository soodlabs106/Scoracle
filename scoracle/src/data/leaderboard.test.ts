import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: rpcMock },
}))

import { fetchRankTimeline } from './leaderboard'

describe('rank timeline compatibility', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('falls back to deployed match-week RPCs when the new RPC is absent', async () => {
    rpcMock.mockImplementation((name: string, args?: { selected_match_week: number }) => {
      if (name === 'get_rank_timeline') {
        return Promise.resolve({
          data: null,
          error: {
            code: 'PGRST202',
            message:
              'Could not find the function public.get_rank_timeline without parameters in the schema cache',
          },
        })
      }

      if (name === 'get_scored_match_weeks') {
        return Promise.resolve({
          data: [{ match_week: 1 }, { match_week: 2 }],
          error: null,
        })
      }

      return Promise.resolve({
        data: [
          {
            user_id: 'user-1',
            username: 'Rishi',
            match_week: args?.selected_match_week,
            current_rank: 1,
            previous_rank: null,
            rank_change: null,
          },
        ],
        error: null,
      })
    })

    const rows = await fetchRankTimeline()

    expect(rows.map((row) => row.match_week)).toEqual([1, 2])
    expect(rpcMock).toHaveBeenCalledWith('get_match_week_rank_movement', {
      selected_match_week: 1,
    })
  })

  it('does not hide unrelated database errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Access denied' },
    })

    await expect(fetchRankTimeline()).rejects.toThrow('Access denied')
  })
})
