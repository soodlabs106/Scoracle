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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12163F]/45 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="auth-modal-title"
        className="max-h-[92vh] w-full max-w-md overflow-auto rounded-lg border border-[#DCD5FF] bg-white p-6 shadow-[0_24px_80px_rgba(18,22,63,0.20)] motion-safe:animate-[modalIn_180ms_ease-out]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/scoracle-logo.png"
              alt=""
              className="h-11 w-11 rounded-lg object-contain"
            />
            <div>
              <img
                src="/scoracle-lettering.png"
                alt="Scoracle"
                className="h-5 w-auto object-contain"
              />
              <h2
                id="auth-modal-title"
                className="text-2xl font-bold text-[#12163F]"
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg border border-[#DCD5FF] p-2 text-[#12163F] transition-all duration-200 hover:bg-[#F1ECFF]"
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

  return <p className="mt-1 text-sm font-semibold text-[#FF2D9A]">{message}</p>
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
    info: 'border-[#2F6BFF] bg-[#E9FFFC] text-[#12163F]',
    error: 'border-[#FF2D9A] bg-[#FFF0F8] text-[#12163F]',
    success: 'border-[#18D6C9] bg-[#E9FFFC] text-[#12163F]',
  }

  return (
    <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${styles[tone]}`}>
      {message}
    </div>
  )
}
