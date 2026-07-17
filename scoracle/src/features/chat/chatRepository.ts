import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import type { Tables } from '../../types/database.generated'

export const CHAT_MESSAGE_MAX_LENGTH = 500
export const CHAT_MESSAGE_LIMIT = 50
export const CHAT_RETENTION_DAYS = 30

export type ChatRoom = Tables<'chat_rooms'>
export type ChatMessageRow = Tables<'chat_messages'>
export type ChatMessage = ChatMessageRow & { displayName: string }

const CHAT_ROOM_SELECT = 'id, name, room_type, fixture_id, created_at'
const CHAT_MESSAGE_SELECT = 'id, room_id, user_id, message, created_at'

export async function fetchGeneralChatRoom() {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select(CHAT_ROOM_SELECT)
    .eq('room_type', 'general')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('General Chat is not available.')
  return data as ChatRoom
}
export async function fetchChatMessages(roomId: string) {
  const cutoff = new Date(
    Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
  const { data, error } = await supabase
    .from('chat_messages')
    .select(CHAT_MESSAGE_SELECT)
    .eq('room_id', roomId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(CHAT_MESSAGE_LIMIT)

  if (error) throw error
  return [...(data as ChatMessageRow[])].reverse()
}

export async function fetchChatDisplayNames(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)].slice(0, CHAT_MESSAGE_LIMIT)
  if (uniqueIds.length === 0) return new Map<string, string>()

  const { data, error } = await supabase.rpc('get_chat_display_names', {
    user_ids: uniqueIds,
  })
  if (error) throw error

  return new Map(
    (data ?? []).map((row) => [row.user_id, row.display_name || 'User']),
  )
}

export async function insertChatMessage(
  roomId: string,
  userId: string,
  message: string,
) {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) throw new Error('Enter a message before sending.')
  if (trimmedMessage.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw new Error(`Messages can be up to ${CHAT_MESSAGE_MAX_LENGTH} characters.`)
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, user_id: userId, message: trimmedMessage })
    .select(CHAT_MESSAGE_SELECT)
    .single()

  if (error) throw error
  return data as ChatMessageRow
}

export function subscribeToChatMessages(
  roomId: string,
  onMessage: (message: ChatMessageRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`chat-room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => onMessage(payload.new as ChatMessageRow),
    )
    .subscribe()
}

export async function unsubscribeFromChatMessages(channel: RealtimeChannel) {
  await supabase.removeChannel(channel)
}
