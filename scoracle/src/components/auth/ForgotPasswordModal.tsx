import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/useAuth'
import { AuthModalFrame, FieldError, ServerMessage } from './AuthModalFrame'
import { isValidEmail } from './passwordValidation'

type ForgotPasswordModalProps = {
  onClose: () => void
  onSwitchToLogin: () => void
}

export function ForgotPasswordModal({
  onClose,
  onSwitchToLogin,
}: ForgotPasswordModalProps) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [serverTone, setServerTone] = useState<'error' | 'success'>('success')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isValidEmail(email)) {
      setServerTone('error')
      setServerMessage('Enter a valid email.')
      return
    }

    setIsSubmitting(true)
    setServerMessage(null)

    try {
      await resetPassword(email)
      setServerTone('success')
      setServerMessage('Password reset email requested. Check your inbox.')
    } catch (error) {
      setServerTone('error')
      setServerMessage(
        error instanceof Error ? error.message : 'Could not request reset.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthModalFrame title="Reset Password" onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm leading-6 text-[#5f6664]">
          Enter your account email and Supabase will send the reset link.
        </p>
        <label className="block text-sm font-semibold text-[#333333]">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
            required
          />
          <FieldError
            message={
              email && !isValidEmail(email) ? 'Enter a valid email.' : undefined
            }
          />
        </label>

        <ServerMessage message={serverMessage} tone={serverTone} />

        <button
          type="submit"
          disabled={isSubmitting || !isValidEmail(email)}
          className="h-11 w-full rounded-lg bg-[#F45B5B] px-4 text-sm font-semibold text-white transition hover:bg-[#3CC8A5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>

        <button
          type="button"
          onClick={onSwitchToLogin}
          className="w-full text-sm font-semibold text-[#3CC8A5] hover:underline"
        >
          Back to log in
        </button>
      </form>
    </AuthModalFrame>
  )
}
