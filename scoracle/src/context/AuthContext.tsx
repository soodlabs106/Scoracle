import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import { logSessionActivity } from '../data/activityLogs'
import type { AuthState, Profile } from '../types/auth'
import {
  AuthContext,
  type AuthContextValue,
  type SignupInput,
} from './authContextCore'

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000
const PROFILE_SELECT =
  'id, username, email, first_name, last_name, role, is_disabled, favorite_club, avatar_url, avatar_path, onboarding_required, onboarding_completed_at, created_at'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    message: null,
  })

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data as Profile | null
  }, [])

  const applySession = useCallback(
    async (session: AuthState['session'], nextMessage: string | null = null) => {
      if (!session?.user) {
        setState((current) => ({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          message: nextMessage ?? current.message,
        }))
        return null
      }

      let profile = await fetchProfile(session.user.id)

      const providerAvatar = getProviderAvatarUrl(session.user)
      const shouldSyncProviderAvatar =
        providerAvatar &&
        (!profile?.avatar_url ||
          !profile.avatar_path ||
          isProviderAvatarUrl(profile.avatar_url))

      if (shouldSyncProviderAvatar) {
        try {
          const cachedAvatar = await cacheProviderAvatar(
            session.access_token,
          )
          const nextAvatarUrl = cachedAvatar?.avatarUrl ?? providerAvatar
          const nextAvatarPath = cachedAvatar?.avatarPath ?? null
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({
              avatar_url: nextAvatarUrl,
              avatar_path: nextAvatarPath,
            })
            .eq('id', session.user.id)
            .select(PROFILE_SELECT)
            .maybeSingle()

          if (!updateError && updatedProfile) {
            profile = updatedProfile as Profile
          }
        } catch (error) {
          console.error('Failed to sync OAuth avatar:', error)
        }
      }

      if (profile?.is_disabled) {
        await supabase.auth.signOut()
        setState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          message: 'Your account has been disabled. Contact the Scoracle admin.',
        })
        return null
      }

      setState({
        session,
        user: session.user,
        profile,
        isLoading: false,
        message: nextMessage,
      })

      return profile
    },
    [fetchProfile],
  )

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      applySession(data.session).catch((error) => {
        console.error(error)
        setState((current) => ({
          ...current,
          isLoading: false,
          message: 'Could not load your profile.',
        }))
      })
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setTimeout(async () => {
          try {
            const profile = await applySession(session)

            if (event === 'SIGNED_IN' && session?.user && profile) {
              const activityKey = `scoracle:activity:${session.user.id}:${session.expires_at ?? 'session'}`

              if (window.sessionStorage.getItem(activityKey) !== 'logged') {
                window.sessionStorage.setItem(activityKey, 'logged')
                await logSessionActivity('SIGNED_IN', {
                  provider:
                    typeof session.user.app_metadata.provider === 'string'
                      ? session.user.app_metadata.provider
                      : 'unknown',
                })
              }
            }
          } catch (error) {
            console.error(error)
            setState((current) => ({
              ...current,
              isLoading: false,
              message: 'Could not sync your auth session.',
            }))
          }
        }, 0)
      },
    )

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [applySession])

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!state.user) {
      throw new Error('Username availability can only be checked after signing in.')
    }

    const { data: isAvailable, error: usernameError } = await supabase.rpc(
      'is_username_available',
      { candidate_username: username.trim() },
    )

    if (usernameError) {
      throw new Error('Could not check username availability.')
    }

    return Boolean(isAvailable)
  }, [state.user])

  const signUp = useCallback(async ({ email, firstName, lastName, username, password }: SignupInput) => {
    const trimmedUsername = username.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    if (!trimmedFirstName || !trimmedLastName) {
      throw new Error('First name and last name are required.')
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          username: trimmedUsername,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })

    if (error) {
      throw new Error(toFriendlySignupError(error.message))
    }

    if (data.session) {
      await supabase.auth.signOut()
    }

    return 'Check your email for the next step if the signup details can be used.'
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        throw new Error(toFriendlyAuthError(error.message))
      }

      await applySession(data.session, 'Signed in.')
    },
    [applySession],
  )

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw new Error(toFriendlyAuthError(error.message))
    }
  }, [])

  const signOut = useCallback(async () => {
    await logSessionActivity('SIGNED_OUT', { reason: 'manual' })

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(toFriendlyAuthError(error.message))
    }

    setState({
      session: null,
      user: null,
      profile: null,
      isLoading: false,
      message: null,
    })
  }, [])

  useEffect(() => {
    if (!state.user) {
      return
    }

    let timeoutId = window.setTimeout(handleInactive, INACTIVITY_LIMIT_MS)
    const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart']

    function resetTimer() {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(handleInactive, INACTIVITY_LIMIT_MS)
    }

    async function handleInactive() {
      try {
        await logSessionActivity('SESSION_TIMEOUT', { reason: 'inactivity' })
        await supabase.auth.signOut()
      } finally {
        setState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          message: 'Signed out after 5 minutes of inactivity.',
        })
      }
    }

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, resetTimer, { passive: true })
    }

    return () => {
      window.clearTimeout(timeoutId)
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, resetTimer)
      }
    }
  }, [state.user])

  const resetPassword = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    )

    if (error) {
      throw new Error(toFriendlyAuthError(error.message))
    }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      throw new Error(toFriendlyAuthError(error.message))
    }
  }, [])

  const updateProfile = useCallback(
    async ({
      username,
      firstName,
      lastName,
      favoriteClub,
      avatarUrl,
      avatarPath,
    }: {
      username: string
      firstName?: string | null
      lastName?: string | null
      favoriteClub: string | null
      avatarUrl?: string | null
      avatarPath?: string | null
    }) => {
      if (!state.user) {
        throw new Error('You must be signed in to update your profile.')
      }

      if (!state.profile) {
        throw new Error('Could not load your profile.')
      }

      const trimmedUsername = username.trim()
      const trimmedFirstName =
        firstName === undefined
          ? state.profile.first_name
          : (firstName ?? '').trim()
      const trimmedLastName =
        lastName === undefined ? state.profile.last_name : (lastName ?? '').trim()
      const trimmedFavoriteClub = favoriteClub?.trim() || null
      const nextAvatarUrl =
        avatarUrl === undefined ? state.profile.avatar_url : avatarUrl
      const nextAvatarPath =
        avatarPath === undefined ? state.profile.avatar_path : avatarPath

      if (!trimmedUsername) {
        throw new Error('Username is required.')
      }

      if (!trimmedFirstName || !trimmedLastName) {
        throw new Error('First name and last name are required.')
      }

      const usernameChanged = trimmedUsername !== state.profile?.username
      const firstNameChanged =
        trimmedFirstName !== (state.profile?.first_name ?? null)
      const lastNameChanged =
        trimmedLastName !== (state.profile?.last_name ?? null)
      const favoriteClubChanged =
        trimmedFavoriteClub !== (state.profile?.favorite_club ?? null)
      const avatarChanged =
        nextAvatarUrl !== (state.profile.avatar_url ?? null) ||
        nextAvatarPath !== (state.profile.avatar_path ?? null)

      if (
        !usernameChanged &&
        !firstNameChanged &&
        !lastNameChanged &&
        !favoriteClubChanged &&
        !avatarChanged
      ) {
        return state.profile
      }

      if (usernameChanged) {
        const isAvailable = await checkUsernameAvailability(trimmedUsername)

        if (!isAvailable) {
          throw new Error('That username is already taken.')
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: trimmedUsername,
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          favorite_club: trimmedFavoriteClub,
          avatar_url: nextAvatarUrl,
          avatar_path: nextAvatarPath,
        })
        .eq('id', state.user.id)
        .select(PROFILE_SELECT)
        .single()

      if (error) {
        throw new Error(error.message)
      }

      if (avatarChanged) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: {
            avatar_url: nextAvatarUrl,
            picture: nextAvatarUrl,
          },
        })

        if (authUpdateError) {
          throw new Error(toFriendlyAuthError(authUpdateError.message))
        }
      }

      setState((current) => ({
        ...current,
        profile: data as Profile,
        message: 'Profile updated.',
      }))

      return data as Profile
    },
    [checkUsernameAvailability, state.profile, state.user],
  )

  const updateUsername = useCallback(
    async (username: string) => {
      await updateProfile({
        username,
        favoriteClub: state.profile?.favorite_club ?? null,
      })
    },
    [state.profile?.favorite_club, updateProfile],
  )

  const refreshProfile = useCallback(async () => {
    if (!state.user) {
      return null
    }

    const profile = await fetchProfile(state.user.id)
    setState((current) => ({ ...current, profile }))
    return profile
  }, [fetchProfile, state.user])

  const completeOnboarding = useCallback(async () => {
    if (!state.user) {
      throw new Error('You must be signed in to complete onboarding.')
    }

    const completedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('profiles')
      .update({
        onboarding_required: false,
        onboarding_completed_at: completedAt,
      })
      .eq('id', state.user.id)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    setState((current) => ({
      ...current,
      profile: data as Profile,
    }))
  }, [state.user])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAdmin: state.profile?.role === 'admin' && !state.profile.is_disabled,
      checkUsernameAvailability,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      updateUsername,
      updateProfile,
      refreshProfile,
      completeOnboarding,
    }),
    [
      refreshProfile,
      resetPassword,
      checkUsernameAvailability,
      completeOnboarding,
      signIn,
      signInWithGoogle,
      signOut,
      signUp,
      state,
      updatePassword,
      updateProfile,
      updateUsername,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function getProviderAvatarUrl(user: NonNullable<AuthState['user']>) {
  const metadataAvatar = getAvatarUrlFromMetadata(user.user_metadata)

  if (metadataAvatar) {
    return metadataAvatar
  }

  for (const identity of user.identities ?? []) {
    const identityAvatar = getAvatarUrlFromMetadata(identity.identity_data)

    if (identityAvatar) {
      return identityAvatar
    }
  }

  return null
}

async function cacheProviderAvatar(accessToken: string) {
  const response = await fetch('/api/cache-oauth-avatar', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as {
    avatarUrl?: unknown
    avatarPath?: unknown
  }

  if (typeof data.avatarUrl !== 'string' || !data.avatarUrl.trim()) {
    return null
  }

  return {
    avatarUrl: data.avatarUrl.trim(),
    avatarPath:
      typeof data.avatarPath === 'string' && data.avatarPath.trim()
        ? data.avatarPath.trim()
        : null,
  }
}

function isProviderAvatarUrl(avatarUrl: string | null | undefined) {
  if (!avatarUrl) {
    return false
  }

  try {
    const host = new URL(avatarUrl).hostname.toLowerCase()
    return (
      host.includes('googleusercontent.com') ||
      host.includes('google.com') ||
      host.includes('githubusercontent.com')
    )
  } catch {
    return false
  }
}

function getAvatarUrlFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
) {
  if (!metadata) {
    return null
  }

  // Check multiple possible field names for avatar URL from different OAuth providers
  // Google typically uses: picture, avatar_url
  // GitHub uses: avatar_url
  // Others might use different field names
  const possibleFields = [
    'picture',
    'avatar_url',
    'avatar',
    'profile_picture',
    'image_url',
  ]

  for (const field of possibleFields) {
    const value = metadata[field]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  // Also check nested user_image or similar patterns
  const userImage = metadata.user_image
  if (typeof userImage === 'string' && userImage.trim()) {
    return userImage.trim()
  }

  return null
}

function toFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Invalid email or password.'
  }

  if (normalized.includes('username')) {
    return 'That username is already taken.'
  }

  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'An account with this email already exists.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before logging in.'
  }

  return message
}

function toFriendlySignupError(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('password') ||
    normalized.includes('weak password') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('captcha')
  ) {
    return toFriendlyAuthError(message)
  }

  return 'Check your email for the next step if the signup details can be used.'
}
