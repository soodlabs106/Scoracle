import { useRef, useState, type KeyboardEvent } from 'react'
import { Send, Smile } from 'lucide-react'
import { CHAT_MESSAGE_MAX_LENGTH } from '../../features/chat/chatRepository'

const EMOJIS = [
  '😀', '😂', '😍', '🤩', '😎', '🤔', '👏', '🙌',
  '👍', '👎', '🔥', '⚽', '🥅', '🏆', '🎯', '💜',
]

export function ChatMessageInput({
  isSending,
  disabled,
  onSend,
}: {
  isSending: boolean
  disabled?: boolean
  onSend: (message: string) => Promise<void>
}) {
  const [message, setMessage] = useState('')
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const trimmedMessage = message.trim()
  const canSend =
    !disabled && !isSending && trimmedMessage.length > 0 && message.length <= CHAT_MESSAGE_MAX_LENGTH

  async function submit() {
    if (!canSend) return
    try {
      await onSend(message)
      setMessage('')
      setIsEmojiOpen(false)
    } catch {
      // The parent displays the repository error and keeps the draft intact.
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? message.length
    const end = textarea?.selectionEnd ?? start
    const nextMessage = `${message.slice(0, start)}${emoji}${message.slice(end)}`
    if (nextMessage.length > CHAT_MESSAGE_MAX_LENGTH) return

    setMessage(nextMessage)
    requestAnimationFrame(() => {
      textarea?.focus()
      const cursor = start + emoji.length
      textarea?.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="border-t border-[#E7E2FF] bg-white p-3">
      {isEmojiOpen ? (
        <div
          className="mb-2 grid grid-cols-8 gap-1 rounded-lg border border-[#E0DAFF] bg-[#FAF9FF] p-2"
          aria-label="Emoji keyboard"
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertEmoji(emoji)}
              className="rounded p-1 text-lg hover:bg-[#EEE9FF] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]"
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setIsEmojiOpen((current) => !current)}
          disabled={disabled || isSending}
          className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#5B3FFF] hover:bg-[#EEE9FF] disabled:opacity-50"
          aria-label={isEmojiOpen ? 'Close emoji keyboard' : 'Open emoji keyboard'}
          aria-expanded={isEmojiOpen}
        >
          <Smile className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={2}
            disabled={disabled || isSending}
            placeholder="Message General Chat"
            aria-label="Message General Chat"
            className="block max-h-28 min-h-11 w-full resize-none rounded-xl border border-[#DCD5FF] bg-[#FAF9FF] px-3 py-2 text-sm outline-none transition focus:border-[#5B3FFF] focus:ring-2 focus:ring-[#5B3FFF]/15 disabled:opacity-60"
          />
          <p className="mt-1 text-right text-[10px] text-[#777D98]">
            {message.length}/{CHAT_MESSAGE_MAX_LENGTH}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          className="mb-4 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#18D6C9] to-[#5B3FFF] text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
