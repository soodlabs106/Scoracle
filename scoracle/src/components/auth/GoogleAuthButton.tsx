import { useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { ServerMessage } from './AuthModalFrame'

export function GoogleAuthButton({ label }: { label: string }) {
  const { signInWithGoogle } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleClick() {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await signInWithGoogle()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not start Google sign in.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isSubmitting}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#DADADA] bg-white px-4 text-sm font-semibold text-[#333333] transition hover:bg-[#E8F4FA] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#DADADA] text-xs font-bold">
          G
        </span>
        {isSubmitting ? 'Opening Google...' : label}
      </button>
      <ServerMessage message={errorMessage} tone="error" />
    </div>
  )
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase text-[#5f6664]">
      <span className="h-px flex-1 bg-[#DADADA]" />
      or
      <span className="h-px flex-1 bg-[#DADADA]" />
    </div>
  )
}
