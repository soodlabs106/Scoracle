import { useState } from 'react'
import { ChevronDown, MessageCircle } from 'lucide-react'
import { useChat } from '../../features/chat/useChat'
import { ChatMessageInput } from './ChatMessageInput'
import { ChatMessageList } from './ChatMessageList'
import { ChatRoomList } from './ChatRoomList'

export function ChatPanel({
  userId,
  displayName,
}: {
  userId: string
  displayName: string
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { room, messages, isLoading, isSending, error, sendMessage } = useChat({
    userId,
    displayName,
  })

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#DCD5FF] bg-white shadow-[0_12px_32px_rgba(18,22,63,0.08)] lg:h-[calc(100vh-40px)] lg:max-h-[780px]">
      <button
        type="button"
        onClick={() => setIsMobileOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left lg:cursor-default"
        aria-expanded={isMobileOpen}
      >
        <span className="inline-flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="h-5 w-5 text-[#5B3FFF]" />
          ScoracleFC Chat
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#E9FFFC] px-3 py-1 text-xs font-bold uppercase lg:hidden">
          {isMobileOpen ? 'Hide' : 'Open'}
          <ChevronDown className={`h-3.5 w-3.5 transition ${isMobileOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div className={`${isMobileOpen ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col border-t border-[#E7E2FF] lg:flex`}>
        <ChatRoomList room={room} />
        <ChatMessageList
          messages={messages}
          currentUserId={userId}
          isLoading={isLoading}
        />
        {error ? (
          <p role="alert" className="border-t border-[#F45B5B]/20 bg-[#F45B5B]/10 px-3 py-2 text-xs font-semibold text-[#8A2626]">
            {error}
          </p>
        ) : null}
        <ChatMessageInput
          isSending={isSending}
          disabled={isLoading || !room}
          onSend={sendMessage}
        />
      </div>
    </section>
  )
}
