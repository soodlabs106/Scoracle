import { describe, expect, it } from 'vitest'
import { handler } from './team-details.ts'

describe('team details input validation', () => {
  it('rejects unknown team ids without calling a provider', async () => {
    const result = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { teamId: '../../metadata' },
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toMatchObject({ error: 'INVALID_TEAM' })
  })
})
