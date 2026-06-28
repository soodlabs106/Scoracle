export function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return { url: url.replace(/\/$/, ''), serviceRoleKey }
}

export function supabaseHeaders(config, accessToken = config.serviceRoleKey) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${accessToken}`,
  }
}

export async function getAuthenticatedUser(config, accessToken) {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: supabaseHeaders(config, accessToken),
  })

  if (!response.ok) {
    const error = Object.assign(new Error('Invalid user session'), {
      code: 'AUTH_REQUIRED',
    })
    throw error
  }

  return response.json()
}

export function bearerTokenFrom(
  headers: Record<string, string | undefined> = {},
) {
  const value =
    headers.authorization ?? headers.Authorization ?? headers.AUTHORIZATION ?? ''
  return String(value).match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null
}
