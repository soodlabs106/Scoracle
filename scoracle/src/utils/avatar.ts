const AVATAR_BUCKET = 'profile-avatars'

function normalizeSupabaseOrigin(rawUrl?: string | null) {
  if (!rawUrl) {
    return null
  }

  const trimmed = rawUrl.trim()

  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    const pathname = parsed.pathname.replace(/\/$/, '')
    const normalizedPath =
      pathname.endsWith('/rest/v1')
        ? pathname.slice(0, -'/rest/v1'.length)
        : pathname

    return `${parsed.origin}${normalizedPath}`.replace(/\/$/, '')
  } catch {
    return trimmed
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/$/, '')
  }
}

export function buildAvatarUrlFromPath(avatarPath?: string | null) {
  const normalizedPath = avatarPath?.trim()

  if (!normalizedPath) {
    return null
  }

  const origin = normalizeSupabaseOrigin(
    import.meta.env.VITE_SUPABASE_URL as string | undefined,
  )

  if (!origin) {
    return null
  }

  return `${origin}/storage/v1/object/public/${AVATAR_BUCKET}/${normalizedPath}`
}

export function getSafeAvatarUrl(
  avatarUrl?: string | null,
  avatarPath?: string | null,
) {
  const derivedUrl = buildAvatarUrlFromPath(avatarPath)

  if (derivedUrl) {
    return derivedUrl
  }

  const normalizedUrl = avatarUrl?.trim()

  if (!normalizedUrl) {
    return null
  }

  const origin = normalizeSupabaseOrigin(
    import.meta.env.VITE_SUPABASE_URL as string | undefined,
  )

  if (!origin) {
    return null
  }

  const expectedPrefix = `${origin}/storage/v1/object/public/${AVATAR_BUCKET}/`

  return normalizedUrl.startsWith(expectedPrefix) ? normalizedUrl : null
}
