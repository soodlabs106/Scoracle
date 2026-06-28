import {
  jsonResponse,
  publicError,
  requestIdFrom,
} from '../core/http.ts'
import {
  bearerTokenFrom,
  getAuthenticatedUser,
  getSupabaseServerConfig,
  supabaseHeaders,
} from '../core/supabase.ts'
import type { NetlifyFunctionEvent } from '../core/types.ts'

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handler(event: NetlifyFunctionEvent) {
  const requestId = requestIdFrom(event)

  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', requestId }, 405, 'no-store', requestId)
  }

  const config = getSupabaseServerConfig()
  const accessToken = bearerTokenFrom(event.headers)

  if (!config) {
    return jsonResponse({ error: 'SERVER_CONFIG_MISSING', requestId }, 500, 'no-store', requestId)
  }

  if (!accessToken) {
    return jsonResponse({ error: 'AUTH_REQUIRED', requestId }, 401, 'no-store', requestId)
  }

  try {
    const actor = await getAuthenticatedUser(config, accessToken)
    const actorProfile = await fetchProfile(config, actor.id)

    if (actorProfile?.role !== 'admin' || actorProfile.is_disabled) {
      return jsonResponse({ error: 'ACCESS_DENIED', requestId }, 403, 'no-store', requestId)
    }

    const body = parseBody(event.body)

    if (body.targetUserId === actor.id) {
      return jsonResponse({ error: 'ADMIN_SELF_DISABLE_REJECTED', requestId }, 400, 'no-store', requestId)
    }

    const targetProfile = await fetchProfile(config, body.targetUserId)

    if (!targetProfile) {
      return jsonResponse({ error: 'USER_NOT_FOUND', requestId }, 404, 'no-store', requestId)
    }

    await updateAuthBan(config, body.targetUserId, body.disabled)

    try {
      const updatedProfile = await updateProfileStatus(
        config,
        body.targetUserId,
        body.disabled,
      )
      return jsonResponse(updatedProfile, 200, 'no-store', requestId)
    } catch (error) {
      await updateAuthBan(config, body.targetUserId, !body.disabled).catch(
        () => undefined,
      )
      throw error
    }
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? String(error.code)
      : 'ADMIN_STATUS_UPDATE_FAILED'
    const status = code === 'INVALID_REQUEST' ? 400 : 502
    return jsonResponse(publicError(error, requestId, code), status, 'no-store', requestId)
  }
}

function parseBody(rawBody) {
  let body

  try {
    body = JSON.parse(rawBody ?? '{}')
  } catch {
    throw codedError('INVALID_REQUEST')
  }

  if (
    !USER_ID_PATTERN.test(String(body.targetUserId ?? '')) ||
    typeof body.disabled !== 'boolean'
  ) {
    throw codedError('INVALID_REQUEST')
  }

  return { targetUserId: body.targetUserId, disabled: body.disabled }
}

async function fetchProfile(config, userId) {
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,username,role,is_disabled,created_at&limit=1`,
    { headers: supabaseHeaders(config) },
  )

  if (!response.ok) {
    throw codedError('PROFILE_LOOKUP_FAILED')
  }

  return (await response.json())[0] ?? null
}

async function updateAuthBan(config, userId, disabled) {
  const response = await fetch(`${config.url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      ...supabaseHeaders(config),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ban_duration: disabled ? '876000h' : 'none' }),
  })

  if (!response.ok) {
    throw codedError('AUTH_STATUS_UPDATE_FAILED')
  }
}

async function updateProfileStatus(config, userId, disabled) {
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,username,role,is_disabled,created_at`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(config),
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify({ is_disabled: disabled }),
    },
  )

  if (!response.ok) {
    throw codedError('PROFILE_STATUS_UPDATE_FAILED')
  }

  return (await response.json())[0]
}

function codedError(code) {
  return Object.assign(new Error(code), { code })
}
