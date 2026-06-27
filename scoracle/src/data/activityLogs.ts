import { supabase } from '../lib/supabaseClient'

export type SessionActivityType =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'SESSION_TIMEOUT'

export async function logSessionActivity(
  eventType: SessionActivityType,
  metadata: Record<string, string> = {},
) {
  const { error } = await supabase.rpc('log_my_activity', {
    activity_type: eventType,
    activity_metadata: metadata,
  })

  if (error) {
    console.error(`Could not record ${eventType.toLowerCase()} activity:`, error)
  }
}
