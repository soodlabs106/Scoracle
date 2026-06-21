import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/useAuth'
import { AuthModalFrame, FieldError, ServerMessage } from './AuthModalFrame'
import { AuthDivider, GoogleAuthButton } from './GoogleAuthButton'
import { isValidEmail } from './passwordValidation'

type LoginModalProps = {
  onClose: () => void
  onSwitchToSignup: () => void
  onForgotPassword: () => void
}

export function LoginModal({
  onClose,
  onSwitchToSignup,
  onForgotPassword,
}: LoginModalProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = isValidEmail(email) && password.length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      setServerMessage('Enter your email and password.')
      return
    }

    setIsSubmitting(true)
    setServerMessage(null)

    try {
      await signIn(email, password)
      onClose()
    } catch (error) {
      setServerMessage(
        error instanceof Error ? error.message : 'Could not sign in.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthModalFrame title="Log In" onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <GoogleAuthButton label="Continue with Google" />
        <AuthDivider />

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

        <label className="block text-sm font-semibold text-[#333333]">
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
            required
          />
        </label>

        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm font-semibold text-[#3CC8A5] hover:underline"
        >
          Forgot password?
        </button>

        <ServerMessage message={serverMessage} tone="error" />

        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className="h-11 w-full rounded-lg bg-[#F45B5B] px-4 text-sm font-semibold text-white transition hover:bg-[#3CC8A5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={onSwitchToSignup}
          className="w-full text-sm font-semibold text-[#3CC8A5] hover:underline"
        >
          Need an account? Sign up
        </button>
      </form>
    </AuthModalFrame>
  )
}
