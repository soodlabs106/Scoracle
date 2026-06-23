import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../context/useAuth'
import { AuthModalFrame, FieldError, ServerMessage } from './AuthModalFrame'
import { AuthDivider, GoogleAuthButton } from './GoogleAuthButton'
import { isValidEmail, validatePassword } from './passwordValidation'

type SignupModalProps = {
  onClose: () => void
  onSwitchToLogin: () => void
}

export function SignupModal({ onClose, onSwitchToLogin }: SignupModalProps) {
  const { checkUsernameAvailability, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [serverTone, setServerTone] = useState<'error' | 'success'>('success')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'error'
  >('idle')

  const passwordValidation = useMemo(
    () => validatePassword(password),
    [password],
  )
  const trimmedUsername = username.trim()
  const trimmedFirstName = firstName.trim()
  const trimmedLastName = lastName.trim()
  const usernameHasOnlyWhitespace =
    username.length > 0 && trimmedUsername.length === 0
  const passwordsMatch = password === repeatPassword
  const canSubmit =
    isValidEmail(email) &&
    trimmedFirstName.length > 0 &&
    trimmedLastName.length > 0 &&
    usernameStatus === 'available' &&
    passwordValidation.isValid &&
    passwordsMatch

  useEffect(() => {
    if (!trimmedUsername) {
      return
    }

    let isCurrent = true

    const timeoutId = window.setTimeout(() => {
      checkUsernameAvailability(trimmedUsername)
        .then((isAvailable) => {
          if (isCurrent) {
            setUsernameStatus(isAvailable ? 'available' : 'taken')
          }
        })
        .catch(() => {
          if (isCurrent) {
            setUsernameStatus('error')
          }
        })
    }, 350)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [checkUsernameAvailability, trimmedUsername])

  function handleUsernameChange(nextUsername: string) {
    setUsername(nextUsername)
    setUsernameStatus(nextUsername.trim() ? 'checking' : 'idle')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      setServerTone('error')
      setServerMessage('Fix the highlighted fields before creating an account.')
      return
    }

    setIsSubmitting(true)
    setServerMessage(null)

    try {
      const message = await signUp({
        email,
        firstName,
        lastName,
        username,
        password,
      })
      setServerTone('success')
      setServerMessage(message)
      onClose()
    } catch (error) {
      setServerTone('error')
      setServerMessage(
        error instanceof Error ? error.message : 'Could not create account.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthModalFrame title="Create Account" onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <GoogleAuthButton label="Sign up with Google" />
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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-[#333333]">
            First name
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              type="text"
              autoComplete="given-name"
              className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
              required
            />
            <FieldError
              message={
                firstName && !trimmedFirstName
                  ? 'First name is required.'
                  : undefined
              }
            />
          </label>

          <label className="block text-sm font-semibold text-[#333333]">
            Last name
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              type="text"
              autoComplete="family-name"
              className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
              required
            />
            <FieldError
              message={
                lastName && !trimmedLastName
                  ? 'Last name is required.'
                  : undefined
              }
            />
          </label>
        </div>

        <label className="block text-sm font-semibold text-[#333333]">
          Username
          <input
            value={username}
            onChange={(event) => handleUsernameChange(event.target.value)}
            type="text"
            autoComplete="username"
            className={`mt-1 h-11 w-full rounded-lg border px-3 text-base focus:outline-none focus:ring-2 ${
              usernameStatus === 'taken' ||
              usernameStatus === 'error' ||
              usernameHasOnlyWhitespace
                ? 'border-[#F45B5B] focus:border-[#F45B5B] focus:ring-[#F45B5B]/20'
                : usernameStatus === 'available'
                  ? 'border-[#3CC8A5] focus:border-[#3CC8A5] focus:ring-[#3CC8A5]/20'
                  : 'border-[#DADADA] focus:border-[#3CC8A5] focus:ring-[#3CC8A5]/20'
            }`}
            required
          />
          {usernameStatus === 'available' ? (
            <p className="mt-1 text-sm font-semibold text-[#146b59]">
              Username is available.
            </p>
          ) : null}
          {usernameStatus === 'checking' ? (
            <p className="mt-1 text-sm font-semibold text-[#5f6664]">
              Checking username...
            </p>
          ) : null}
          <p className="mt-1 text-xs font-medium text-[#5f6664]">
            Spaces and letter casing are ignored for username availability.
          </p>
          <FieldError message={getUsernameError(usernameStatus, username)} />
        </label>

        <label className="block text-sm font-semibold text-[#333333]">
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
            required
          />
        </label>

        <div
          className={`rounded-lg border p-3 text-sm ${
            passwordValidation.isValid
              ? 'border-[#3CC8A5] bg-[#3CC8A5]/10 text-[#333333]'
              : 'border-[#F45B5B] bg-[#F45B5B]/10 text-[#8a2626]'
          }`}
        >
          <PasswordRule
            isValid={passwordValidation.isLongEnough}
            label="At least 8 characters"
          />
          <PasswordRule
            isValid={passwordValidation.hasNumber}
            label="Includes at least 1 number"
          />
          <PasswordRule
            isValid={passwordValidation.hasSpecialCharacter}
            label="Includes a special character"
          />
        </div>

        <label className="block text-sm font-semibold text-[#333333]">
          Repeat password
          <input
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
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

        <ServerMessage message={serverMessage} tone={serverTone} />

        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className="h-11 w-full rounded-lg bg-gradient-to-br from-[#FF2D9A] to-[#8B5CFF] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,45,154,0.22)] transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>

        <button
          type="button"
          onClick={onSwitchToLogin}
          className="w-full text-sm font-semibold text-[#5B3FFF] hover:underline"
        >
          Already have an account? Log in
        </button>
      </form>
    </AuthModalFrame>
  )
}

function PasswordRule({
  isValid,
  label,
}: {
  isValid: boolean
  label: string
}) {
  return (
    <p className={isValid ? 'font-semibold text-[#146b59]' : 'text-[#5f6664]'}>
      {isValid ? 'OK' : '-'} {label}
    </p>
  )
}

function getUsernameError(
  status: 'idle' | 'checking' | 'available' | 'taken' | 'error',
  username: string,
) {
  if (username.length > 0 && username.trim().length === 0) {
    return 'Username is required.'
  }

  if (status === 'taken') {
    return 'That username is already taken.'
  }

  if (status === 'error') {
    return 'Could not check username availability.'
  }

  return undefined
}
