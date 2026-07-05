import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../features/chat/chatRepository'

const TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: 'short',
})

export function ChatMessageList({
  messages,
  currentUserId,
  isLoading,
}: {
  messages: ChatMessage[]
  currentUserId: string
  isLoading: boolean
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  return (
    <div
      className="min-h-56 flex-1 space-y-3 overflow-y-auto bg-[#FAF9FF] px-3 py-3 lg:min-h-0"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {isLoading ? (
        <ChatNotice>Loading messages...</ChatNotice>
      ) : messages.length === 0 ? (
        <ChatNotice>Start the conversation.</ChatNotice>
      ) : (
        messages.map((message) => {
          const isMine = message.user_id === currentUserId
          return (
            <article
              key={message.id}
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2 shadow-sm ${
                  isMine
                    ? 'rounded-br-sm bg-gradient-to-br from-[#5B3FFF] to-[#7A5CFF] text-white'
                    : 'rounded-bl-sm border border-[#E0DAFF] bg-white text-[#12163F]'
                }`}
              >
                <p className={`text-xs font-bold ${isMine ? 'text-white/80' : 'text-[#5B3FFF]'}`}>
                  {message.displayName}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5">
                  {message.message}
                </p>
              </div>
              <time
                dateTime={message.created_at}
                className="mt-1 px-1 text-[10px] text-[#777D98]"
              >
                {TIME_FORMATTER.format(new Date(message.created_at))}
              </time>
            </article>
          )
        })
      )}
      <div ref={endRef} />
    </div>
  )
}
function ChatNotice({ children }: { children: string }) {
  return (
    <p className="flex min-h-48 items-center justify-center text-center text-sm font-semibold text-[#777D98]">
      {children}
    </p>
  )
}
