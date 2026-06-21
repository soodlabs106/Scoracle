import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type AuthModalFrameProps = {
  title: string
  children: ReactNode
  onClose: () => void
}

export function AuthModalFrame({
  title,
  children,
  onClose,
}: AuthModalFrameProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#333333]/45 p-4">
      <section
        aria-labelledby="auth-modal-title"
        className="max-h-[92vh] w-full max-w-md overflow-auto rounded-lg bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/scoracle-base.png"
              alt=""
              className="h-11 w-11 rounded-lg object-contain"
            />
            <div>
              <p className="text-sm font-semibold text-[#3CC8A5]">Scoracle</p>
              <h2
                id="auth-modal-title"
                className="text-2xl font-semibold text-[#333333]"
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg border border-[#DADADA] p-2 text-[#333333] transition hover:bg-[#E8F4FA]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="mt-1 text-sm font-semibold text-[#F45B5B]">{message}</p>
}

export function ServerMessage({
  message,
  tone = 'info',
}: {
  message: string | null
  tone?: 'info' | 'error' | 'success'
}) {
  if (!message) {
    return null
  }

  const styles = {
    info: 'border-[#4DB7E8] bg-[#E8F4FA] text-[#333333]',
    error: 'border-[#F45B5B] bg-[#F45B5B]/10 text-[#8a2626]',
    success: 'border-[#3CC8A5] bg-[#3CC8A5]/10 text-[#146b59]',
  }

  return (
    <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${styles[tone]}`}>
      {message}
    </div>
  )
}
