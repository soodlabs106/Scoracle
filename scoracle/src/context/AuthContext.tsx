import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import type { AuthState, Profile } from '../types/auth'
import {
  AuthContext,
  type AuthContextValue,
  type SignupInput,
} from './authContextCore'

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000

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
      .select(
        'id, username, email, first_name, last_name, role, is_disabled, favorite_club, avatar_url, avatar_path, created_at',
      )
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
        setState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          message: nextMessage,
        })
        return null
      }

      const profile = await fetchProfile(session.user.id)

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
      (_event, session) => {
        setTimeout(() => {
          applySession(session).catch((error) => {
            console.error(error)
            setState((current) => ({
              ...current,
              isLoading: false,
              message: 'Could not sync your auth session.',
            }))
          })
        }, 0)
      },
    )

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [applySession])

  const checkUsernameAvailability = useCallback(async (username: string) => {
    const { data: isAvailable, error: usernameError } = await supabase.rpc(
      'is_username_available',
      { candidate_username: username.trim() },
    )

    if (usernameError) {
      throw new Error('Could not check username availability.')
    }

    return Boolean(isAvailable)
  }, [])

  const signUp = useCallback(async ({ email, firstName, lastName, username, password }: SignupInput) => {
    const trimmedUsername = username.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    if (!trimmedFirstName || !trimmedLastName) {
      throw new Error('First name and last name are required.')
    }

    const isAvailable = await checkUsernameAvailability(trimmedUsername)

    if (!isAvailable) {
      throw new Error('That username is already taken.')
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
      throw new Error(toFriendlyAuthError(error.message))
    }

    if (data.user && data.user.identities?.length === 0) {
      throw new Error('An account with this email already exists.')
    }

    if (data.session) {
      await applySession(data.session, 'Account created.')
      return 'Account created.'
    }

    return 'Account created. Check your email to confirm your account before logging in.'
  }, [applySession, checkUsernameAvailability])

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
        redirectTo: `${window.location.origin}/`,
      },
    })

    if (error) {
      throw new Error(toFriendlyAuthError(error.message))
    }
  }, [])

  const signOut = useCallback(async () => {
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
    const { data: exists, error: existsError } = await supabase.rpc(
      'auth_email_exists',
      { candidate_email: normalizedEmail },
    )

    if (existsError) {
      throw new Error('Could not check that email address.')
    }

    if (!exists) {
      throw new Error('No Scoracle account exists for that email.')
    }

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
      favoriteClub,
      avatarUrl,
      avatarPath,
    }: {
      username: string
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
      const trimmedFavoriteClub = favoriteClub?.trim() || null
      const nextAvatarUrl =
        avatarUrl === undefined ? state.profile.avatar_url : avatarUrl
      const nextAvatarPath =
        avatarPath === undefined ? state.profile.avatar_path : avatarPath

      if (!trimmedUsername) {
        throw new Error('Username is required.')
      }

      const usernameChanged = trimmedUsername !== state.profile?.username
      const favoriteClubChanged =
        trimmedFavoriteClub !== (state.profile?.favorite_club ?? null)
      const avatarChanged =
        nextAvatarUrl !== (state.profile.avatar_url ?? null) ||
        nextAvatarPath !== (state.profile.avatar_path ?? null)

      if (!usernameChanged && !favoriteClubChanged && !avatarChanged) {
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
          favorite_club: trimmedFavoriteClub,
          avatar_url: nextAvatarUrl,
          avatar_path: nextAvatarPath,
        })
        .eq('id', state.user.id)
        .select(
          'id, username, email, first_name, last_name, role, is_disabled, favorite_club, avatar_url, avatar_path, created_at',
        )
        .single()

      if (error) {
        throw new Error(error.message)
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
    }),
    [
      refreshProfile,
      resetPassword,
      checkUsernameAvailability,
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
