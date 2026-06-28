import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import sharp from 'sharp'
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

const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const MAX_STORED_BYTES = 1024 * 1024
const AVATAR_BUCKET = 'profile-avatars'
const MAX_REDIRECTS = 2

export async function handler(event: NetlifyFunctionEvent) {
  const requestId = requestIdFrom(event)

  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', requestId }, 405, 'no-store', requestId)
  }

  const config = getSupabaseServerConfig()

  if (!config) {
    return jsonResponse({ error: 'SERVER_CONFIG_MISSING', requestId }, 500, 'no-store', requestId)
  }

  const accessToken = bearerTokenFrom(event.headers)

  if (!accessToken) {
    return jsonResponse({ error: 'AUTH_REQUIRED', requestId }, 401, 'no-store', requestId)
  }

  try {
    const user = await getAuthenticatedUser(config, accessToken)
    const avatarUrl = providerAvatarFromUser(user)

    if (!avatarUrl) {
      return jsonResponse({ error: 'PROVIDER_AVATAR_MISSING', requestId }, 404, 'no-store', requestId)
    }

    const source = await fetchRemoteAvatar(avatarUrl)
    const avatar = await normalizeAvatar(source)
    const avatarPath = `${user.id}/google-oauth-avatar.webp`

    await uploadAvatar(config, avatarPath, avatar)

    const publicAvatarUrl = `${config.url}/storage/v1/object/public/${AVATAR_BUCKET}/${avatarPath}`
    await updateProfileAvatar(config, user.id, publicAvatarUrl, avatarPath)

    return jsonResponse(
      { avatarUrl: publicAvatarUrl, avatarPath },
      200,
      'no-store',
      requestId,
    )
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? String(error.code)
      : 'AVATAR_CACHE_FAILED'
    const status = code === 'AUTH_REQUIRED' ? 401 : 502
    return jsonResponse(publicError(error, requestId, code), status, 'no-store', requestId)
  }
}

export function providerAvatarFromUser(user) {
  const candidates = [
    user?.user_metadata?.picture,
    user?.user_metadata?.avatar_url,
    ...(user?.identities ?? []).flatMap((identity) => [
      identity?.identity_data?.picture,
      identity?.identity_data?.avatar_url,
    ]),
  ]

  return candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim(),
  )?.trim()
}

async function fetchRemoteAvatar(initialUrl) {
  let currentUrl = initialUrl

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeGoogleAvatarUrl(currentUrl)
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
      headers: { 'user-agent': 'Scoracle avatar cache' },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')

      if (!location || redirectCount === MAX_REDIRECTS) {
        throw codedError('AVATAR_REDIRECT_REJECTED')
      }

      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    if (!response.ok) {
      throw codedError('AVATAR_PROVIDER_FAILED')
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0)

    if (contentLength > MAX_SOURCE_BYTES) {
      throw codedError('AVATAR_TOO_LARGE')
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    if (buffer.byteLength > MAX_SOURCE_BYTES) {
      throw codedError('AVATAR_TOO_LARGE')
    }

    return buffer
  }

  throw codedError('AVATAR_REDIRECT_REJECTED')
}

export async function assertSafeGoogleAvatarUrl(value) {
  let url

  try {
    url = new URL(value)
  } catch {
    throw codedError('AVATAR_URL_REJECTED')
  }

  const hostname = url.hostname.toLowerCase()

  if (
    url.protocol !== 'https:' ||
    !(
      hostname === 'googleusercontent.com' ||
      hostname.endsWith('.googleusercontent.com')
    )
  ) {
    throw codedError('AVATAR_URL_REJECTED')
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw codedError('AVATAR_ADDRESS_REJECTED')
  }
}

function isPrivateAddress(address) {
  const version = isIP(address)

  if (version === 4) {
    const [first, second] = address.split('.').map(Number)
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    )
  }

  if (version === 6) {
    const normalized = address.toLowerCase()
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    )
  }

  return true
}

async function normalizeAvatar(source) {
  const image = sharp(source, { failOn: 'error', limitInputPixels: 16_000_000 })
  const metadata = await image.metadata()

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 32 ||
    metadata.height < 32 ||
    !['jpeg', 'png', 'webp'].includes(metadata.format ?? '')
  ) {
    throw codedError('AVATAR_IMAGE_REJECTED')
  }

  const buffer = await image
    .rotate()
    .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  if (buffer.byteLength > MAX_STORED_BYTES) {
    throw codedError('AVATAR_TOO_LARGE')
  }

  return { buffer, contentType: 'image/webp' }
}

async function uploadAvatar(config, avatarPath, avatar) {
  const response = await fetch(
    `${config.url}/storage/v1/object/${AVATAR_BUCKET}/${avatarPath}`,
    {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'cache-control': '31536000',
        'content-type': avatar.contentType,
        'x-upsert': 'true',
      },
      body: avatar.buffer,
    },
  )

  if (!response.ok) {
    throw codedError('AVATAR_UPLOAD_FAILED')
  }
}

async function updateProfileAvatar(config, userId, avatarUrl, avatarPath) {
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(config),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ avatar_url: avatarUrl, avatar_path: avatarPath }),
    },
  )

  if (!response.ok) {
    throw codedError('AVATAR_PROFILE_UPDATE_FAILED')
  }
}

function codedError(code) {
  return Object.assign(new Error(code), { code })
}
