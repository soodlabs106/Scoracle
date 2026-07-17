import type { NetlifyFunctionEvent } from '../core/types.ts'
import { handler as refreshHomeData, releaseSyncLease } from './home-data.ts'

export async function handler(event: NetlifyFunctionEvent) {
  const expected = process.env.INTERNAL_REFRESH_SECRET
  const provided =
    event.headers?.['x-scoracle-refresh-token'] ??
    event.headers?.['X-Scoracle-Refresh-Token']

  if (!expected || provided !== expected) {
    return
  }

  const season = process.env.SCORACLE_SEASON ?? '2026'
  const compSeasonId = process.env.PULSE_COMP_SEASON_ID ?? '841'
  const cacheKey = `home-data-v6:${season}:${compSeasonId}`

  try {
    await refreshHomeData({
      httpMethod: 'GET',
      headers: { 'x-scoracle-refresh-token': expected },
      queryStringParameters: {},
    })
  } finally {
    await releaseSyncLease(cacheKey).catch(() => undefined)
  }
}
