import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../context/useAuth'
import { FieldError, ServerMessage } from '../components/auth/AuthModalFrame'
import { validatePassword } from '../components/auth/passwordValidation'

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'error' | 'success'>('success')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validation = useMemo(() => validatePassword(password), [password])
  const passwordsMatch = password === repeatPassword
  const canSubmit = validation.isValid && passwordsMatch

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      setTone('error')
      setMessage('Fix the highlighted fields before updating your password.')
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      await updatePassword(password)
      setTone('success')
      setMessage('Password updated. Redirecting home...')
      setTimeout(() => navigate('/'), 1200)
    } catch (error) {
      setTone('error')
      setMessage(
        error instanceof Error ? error.message : 'Could not update password.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F5FF] px-4 py-10 text-[#12163F]">
      <section className="mx-auto max-w-md rounded-lg border border-[#DCD5FF] bg-white p-6 shadow-[0_12px_32px_rgba(18,22,63,0.08)]">
        <div className="flex items-center gap-3">
          <img
            src="/scoracle-logo.png"
            alt=""
            className="h-12 w-12 rounded-lg object-contain"
          />
          <div>
            <img
              src="/scoracle-lettering.png"
              alt="Scoracle"
              className="h-5 w-auto object-contain"
            />
            <h1 className="text-2xl font-bold">Reset Password</h1>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold">
            New password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-lg border border-[#DCD5FF] px-3 text-base focus:border-[#5B3FFF] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]/20"
              required
            />
          </label>

          <div
            className={`rounded-lg border p-3 text-sm ${
              validation.isValid
                ? 'border-[#18D6C9] bg-[#E9FFFC] text-[#12163F]'
                : 'border-[#FF2D9A] bg-[#FFF0F8] text-[#12163F]'
            }`}
          >
            <p
              className={
                validation.isLongEnough
                  ? 'font-semibold text-[#146b59]'
                  : 'text-[#5f6664]'
              }
            >
              {validation.isLongEnough ? 'OK' : '-'} At least 8 characters
            </p>
            <p
              className={
                validation.hasNumber
                  ? 'font-semibold text-[#146b59]'
                  : 'text-[#5f6664]'
              }
            >
              {validation.hasNumber ? 'OK' : '-'} Includes at least 1 number
            </p>
            <p
              className={
                validation.hasSpecialCharacter
                  ? 'font-semibold text-[#146b59]'
                  : 'text-[#5f6664]'
              }
            >
              {validation.hasSpecialCharacter ? 'OK' : '-'} Includes a special
              character
            </p>
          </div>

          <label className="block text-sm font-semibold">
            Repeat new password
            <input
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-lg border border-[#DCD5FF] px-3 text-base focus:border-[#5B3FFF] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]/20"
              required
            />
            <FieldError
              message={
                repeatPassword && !passwordsMatch
                  ? 'Passwords must match.'
                  : undefined
              }
            />
          </label>

          <ServerMessage message={message} tone={tone} />

          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="h-11 w-full rounded-lg bg-gradient-to-br from-[#FF2D9A] to-[#8B5CFF] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,45,154,0.22)] transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <Link
          to="/"
          className="mt-4 block text-center text-sm font-semibold text-[#5B3FFF] hover:underline"
        >
          Return home
        </Link>
      </section>
    </main>
  )
}
