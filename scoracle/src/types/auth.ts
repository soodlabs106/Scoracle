import type { Session, User } from '@supabase/supabase-js'

export type ProfileRole = 'user' | 'admin'

export type Profile = {
  id: string
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  role: ProfileRole
  is_disabled: boolean
  favorite_club: string | null
  avatar_url: string | null
  avatar_path: string | null
  onboarding_required: boolean
  onboarding_completed_at: string | null
  created_at: string
}

export type AdminProfileRow = Pick<
  Profile,
  | 'id'
  | 'username'
  | 'first_name'
  | 'last_name'
  | 'role'
  | 'is_disabled'
  | 'favorite_club'
  | 'avatar_url'
  | 'onboarding_required'
  | 'onboarding_completed_at'
  | 'created_at'
>

export type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  message: string | null
}
