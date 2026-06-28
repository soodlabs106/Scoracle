import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.generated'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Scoracle configuration is incomplete: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.',
  )
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
)
