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
      .select('id, username, email, role, is_disabled, created_at')
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

  const signUp = useCallback(async ({ email, username, password }: SignupInput) => {
    const trimmedUsername = username.trim()
    const normalizedEmail = email.trim().toLowerCase()

    const { data: isAvailable, error: usernameError } = await supabase.rpc(
      'is_username_available',
      { candidate_username: trimmedUsername },
    )

    if (usernameError) {
      throw new Error('Could not check username availability.')
    }

    if (!isAvailable) {
      throw new Error('That username is already taken.')
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
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
  }, [applySession])

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

  const updateUsername = useCallback(
    async (username: string) => {
      if (!state.user) {
        throw new Error('You must be signed in to update your username.')
      }

      const trimmedUsername = username.trim()

      if (!trimmedUsername) {
        throw new Error('Username is required.')
      }

      if (trimmedUsername === state.profile?.username) {
        return
      }

      const { data: isAvailable, error: usernameError } = await supabase.rpc(
        'is_username_available',
        { candidate_username: trimmedUsername },
      )

      if (usernameError) {
        throw new Error('Could not check username availability.')
      }

      if (!isAvailable) {
        throw new Error('That username is already taken.')
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ username: trimmedUsername })
        .eq('id', state.user.id)
        .select('id, username, email, role, is_disabled, created_at')
        .single()

      if (error) {
        throw new Error(error.message)
      }

      setState((current) => ({
        ...current,
        profile: data as Profile,
        message: 'Username updated.',
      }))
    },
    [state.profile?.username, state.user],
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
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      updateUsername,
      refreshProfile,
    }),
    [
      refreshProfile,
      resetPassword,
      signIn,
      signInWithGoogle,
      signOut,
      signUp,
      state,
      updatePassword,
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

  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'An account with this email already exists.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before logging in.'
  }

  return message
}
