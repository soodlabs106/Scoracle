import { createContext } from 'react'
import type { AuthState, Profile } from '../types/auth'

export type SignupInput = {
  email: string
  username: string
  password: string
}

export type AuthContextValue = AuthState & {
  isAdmin: boolean
  signUp: (input: SignupInput) => Promise<string>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateUsername: (username: string) => Promise<void>
  refreshProfile: () => Promise<Profile | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
