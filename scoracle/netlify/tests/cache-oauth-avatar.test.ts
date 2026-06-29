import { describe, expect, it } from 'vitest'
import {
  assertSafeGoogleAvatarUrl,
  providerAvatarFromUser,
} from '../functions/cache-oauth-avatar.ts'

describe('OAuth avatar hardening', () => {
  it('reads the provider URL from authenticated user metadata', () => {
    expect(
      providerAvatarFromUser({
        user_metadata: { picture: 'https://lh3.googleusercontent.com/avatar' },
      }),
    ).toBe('https://lh3.googleusercontent.com/avatar')
  })

  it.each([
    'http://lh3.googleusercontent.com/avatar',
    'https://localhost/avatar',
    'https://googleusercontent.com.evil.example/avatar',
  ])('rejects unsafe avatar URL %s', async (url) => {
    await expect(assertSafeGoogleAvatarUrl(url)).rejects.toThrow(
      'AVATAR_URL_REJECTED',
    )
  })
})
