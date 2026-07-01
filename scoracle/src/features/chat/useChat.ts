import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchChatDisplayNames,
  fetchChatMessages,
  fetchGeneralChatRoom,
  insertChatMessage,
  subscribeToChatMessages,
  unsubscribeFromChatMessages,
  type ChatMessage,
  type ChatMessageRow,
  type ChatRoom,
} from './chatRepository'

type UseChatInput = {
  userId: string
  displayName: string
}

export function useChat({ userId, displayName }: UseChatInput) {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const namesRef = useRef(new Map([[userId, displayName || 'User']]))

  const addMessage = useCallback(async (row: ChatMessageRow) => {
    let senderName = namesRef.current.get(row.user_id)
    if (!senderName) {
      try {
        const names = await fetchChatDisplayNames([row.user_id])
        senderName = names.get(row.user_id) ?? 'User'
        namesRef.current.set(row.user_id, senderName)
      } catch {
        senderName = 'User'
      }
    }

    setMessages((current) => {
      if (current.some((message) => message.id === row.id)) return current
      return [...current, { ...row, displayName: senderName ?? 'User' }].sort(
        (first, second) =>
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime(),
      )
    })
  }, [])

  useEffect(() => {
    namesRef.current.set(userId, displayName || 'User')
  }, [displayName, userId])

  useEffect(() => {
    let isActive = true
    let channel: ReturnType<typeof subscribeToChatMessages> | null = null

    async function loadChat() {
      setIsLoading(true)
      setError(null)
      try {
        const generalRoom = await fetchGeneralChatRoom()
        const rows = await fetchChatMessages(generalRoom.id)
        const names = await fetchChatDisplayNames(rows.map((row) => row.user_id))
        names.set(userId, displayName || 'User')

        if (!isActive) return
        namesRef.current = names
        setRoom(generalRoom)
        setMessages(
          rows.map((row) => ({
            ...row,
            displayName: names.get(row.user_id) ?? 'User',
          })),
        )
        channel = subscribeToChatMessages(generalRoom.id, (message) => {
          if (isActive) void addMessage(message)
        })
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error ? loadError.message : 'Could not load chat.',
          )
        }
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadChat()
    return () => {
      isActive = false
      if (channel) void unsubscribeFromChatMessages(channel)
    }
  }, [addMessage, displayName, userId])

  const sendMessage = useCallback(
    async (message: string) => {
      if (!room) throw new Error('Chat is still loading.')
      setIsSending(true)
      setError(null)
      try {
        const row = await insertChatMessage(room.id, userId, message)
        await addMessage(row)
      } catch (sendError) {
        const nextError =
          sendError instanceof Error ? sendError.message : 'Could not send message.'
        setError(nextError)
        throw sendError
      } finally {
        setIsSending(false)
      }
    },
    [addMessage, room, userId],
  )

  return { room, messages, isLoading, isSending, error, sendMessage }
}
