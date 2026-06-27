import { createContext } from 'react'
import type { AuthState, Profile } from '../types/auth'

export type SignupInput = {
  email: string
  firstName: string
  lastName: string
  username: string
  password: string
}

export type AuthContextValue = AuthState & {
  isAdmin: boolean
  checkUsernameAvailability: (username: string) => Promise<boolean>
  signUp: (input: SignupInput) => Promise<string>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateUsername: (username: string) => Promise<void>
  updateProfile: (input: {
    username: string
    firstName?: string | null
    lastName?: string | null
    favoriteClub: string | null
    avatarUrl?: string | null
    avatarPath?: string | null
  }) => Promise<Profile>
  refreshProfile: () => Promise<Profile | null>
  completeOnboarding: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
