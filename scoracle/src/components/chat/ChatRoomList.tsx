import { Hash } from 'lucide-react'
import type { ChatRoom } from '../../features/chat/chatRepository'

export function ChatRoomList({ room }: { room: ChatRoom | null }) {
  return (
    <div aria-label="Chat rooms" className="border-b border-[#E7E2FF] px-3 py-2">
      <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#EEE9FF] px-3 py-1.5 text-xs font-bold text-[#4A35C8]">
        <Hash className="h-3.5 w-3.5" />
        <span className="truncate">{room?.name ?? 'General Chat'}</span>
      </div>
    </div>
  )
}
