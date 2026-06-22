import type { Session, User } from '@supabase/supabase-js'

export type ProfileRole = 'user' | 'admin'

export type Profile = {
  id: string
  username: string
  email: string
  role: ProfileRole
  is_disabled: boolean
  favorite_club: string | null
  avatar_url: string | null
  avatar_path: string | null
  created_at: string
}

export type AdminProfileRow = Pick<
  Profile,
  'id' | 'username' | 'role' | 'is_disabled' | 'created_at'
>

export type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  message: string | null
}
