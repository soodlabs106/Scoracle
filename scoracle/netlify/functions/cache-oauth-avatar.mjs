const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const AVATAR_BUCKET = 'profile-avatars'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const config = getSupabaseConfig()

  if (!config) {
    return jsonResponse({ error: 'Supabase server config is missing' }, 500)
  }

  const accessToken = getBearerToken(event.headers ?? {})

  if (!accessToken) {
    return jsonResponse({ error: 'Missing user access token' }, 401)
  }

  let avatarUrl

  try {
    avatarUrl = String(JSON.parse(event.body ?? '{}')?.avatarUrl ?? '').trim()
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }

  if (!isValidRemoteImageUrl(avatarUrl)) {
    return jsonResponse({ error: 'Invalid avatar URL' }, 400)
  }

  try {
    const user = await fetchSupabaseUser(config, accessToken)
    const avatar = await fetchRemoteAvatar(avatarUrl)
    const extension = extensionForContentType(avatar.contentType)
    const avatarPath = `${user.id}/google-oauth-avatar.${extension}`

    await uploadAvatar(config, avatarPath, avatar)

    const publicAvatarUrl = `${config.url}/storage/v1/object/public/${AVATAR_BUCKET}/${avatarPath}`
    await updateProfileAvatar(config, user.id, publicAvatarUrl, avatarPath)

    return jsonResponse({
      avatarUrl: publicAvatarUrl,
      avatarPath,
    })
  } catch (error) {
    return jsonResponse(
      {
        error: 'Could not cache OAuth avatar',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      502,
    )
  }
}

async function fetchSupabaseUser(config, accessToken) {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Could not validate user session')
  }

  return response.json()
}

async function fetchRemoteAvatar(avatarUrl) {
  const response = await fetch(avatarUrl, {
    headers: {
      'user-agent': 'Scoracle avatar cache',
    },
  })

  if (!response.ok) {
    throw new Error(`OAuth avatar returned ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('OAuth avatar URL did not return an image')
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)

  if (contentLength > MAX_AVATAR_BYTES) {
    throw new Error('OAuth avatar is too large')
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  if (buffer.byteLength > MAX_AVATAR_BYTES) {
    throw new Error('OAuth avatar is too large')
  }

  return {
    buffer,
    contentType,
  }
}

async function uploadAvatar(config, avatarPath, avatar) {
  const response = await fetch(
    `${config.url}/storage/v1/object/${AVATAR_BUCKET}/${avatarPath}`,
    {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        'cache-control': '3600',
        'content-type': avatar.contentType,
        'x-upsert': 'true',
      },
      body: avatar.buffer,
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Avatar upload failed: ${details}`)
  }
}

async function updateProfileAvatar(config, userId, avatarUrl, avatarPath) {
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        avatar_url: avatarUrl,
        avatar_path: avatarPath,
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Profile avatar update failed: ${details}`)
  }
}

function getBearerToken(headers) {
  const authorization =
    headers.authorization ??
    headers.Authorization ??
    headers.AUTHORIZATION ??
    ''
  const match = String(authorization).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return { url, serviceRoleKey }
}

function isValidRemoteImageUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function extensionForContentType(contentType) {
  const normalized = contentType.toLowerCase()

  if (normalized.includes('png')) {
    return 'png'
  }

  if (normalized.includes('webp')) {
    return 'webp'
  }

  return 'jpg'
}

function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}
