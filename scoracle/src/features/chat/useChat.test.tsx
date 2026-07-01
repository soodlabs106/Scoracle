import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchRoom: vi.fn(),
  fetchMessages: vi.fn(),
  fetchNames: vi.fn(),
  insertMessage: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./chatRepository', async (importOriginal) => {
  const original = await importOriginal<typeof import('./chatRepository')>()
  return {
    ...original,
    fetchGeneralChatRoom: mocks.fetchRoom,
    fetchChatMessages: mocks.fetchMessages,
    fetchChatDisplayNames: mocks.fetchNames,
    insertChatMessage: mocks.insertMessage,
    subscribeToChatMessages: mocks.subscribe,
    unsubscribeFromChatMessages: mocks.unsubscribe,
  }
})

import { useChat } from './useChat'

const room = {
  id: 'room-1', name: 'General Chat', room_type: 'general',
  fixture_id: null, created_at: '2026-07-01T00:00:00.000Z',
}
const message = {
  id: 'message-1', room_id: 'room-1', user_id: 'user-2',
  message: 'Hello', created_at: '2026-07-01T01:00:00.000Z',
}

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchRoom.mockResolvedValue(room)
    mocks.fetchMessages.mockResolvedValue([message])
    mocks.fetchNames.mockResolvedValue(new Map([['user-2', 'Alex']]))
    mocks.subscribe.mockReturnValue({ topic: 'chat-room:room-1' })
    mocks.unsubscribe.mockResolvedValue(undefined)
  })

  it('deduplicates realtime inserts and removes the subscription on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useChat({ userId: 'user-1', displayName: 'Rishi' }),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].displayName).toBe('Alex')

    const realtimeHandler = mocks.subscribe.mock.calls[0][1]
    await act(async () => realtimeHandler(message))
    expect(result.current.messages).toHaveLength(1)

    unmount()
    expect(mocks.unsubscribe).toHaveBeenCalledWith({ topic: 'chat-room:room-1' })
  })
})
