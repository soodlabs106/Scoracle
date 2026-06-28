import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from './admin-user-status.ts'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

describe('admin user status security boundary', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('requires an authenticated bearer token', async () => {
    const result = await handler({ httpMethod: 'POST', headers: {} })

    expect(result.statusCode).toBe(401)
  })

  it('rejects a signed-in non-admin before reading the request body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: USER_ID }))
        .mockResolvedValueOnce(
          jsonResponse([{ id: USER_ID, role: 'user', is_disabled: false }]),
        ),
    )

    const result = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer user-token' },
      body: JSON.stringify({ targetUserId: ADMIN_ID, disabled: true }),
    })

    expect(result.statusCode).toBe(403)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('prevents an admin from disabling their own account', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: ADMIN_ID }))
        .mockResolvedValueOnce(
          jsonResponse([{ id: ADMIN_ID, role: 'admin', is_disabled: false }]),
        ),
    )

    const result = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: JSON.stringify({ targetUserId: ADMIN_ID, disabled: true }),
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toMatchObject({
      error: 'ADMIN_SELF_DISABLE_REJECTED',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
