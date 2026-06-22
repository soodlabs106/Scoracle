import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../lib/supabaseClient'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('Completing Google sign in...')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function completeSignIn() {
      try {
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const errorDescription =
          searchParams.get('error_description') ?? searchParams.get('error')

        if (errorDescription) {
          throw new Error(errorDescription)
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            throw error
          }
        } else {
          const { data, error } = await supabase.auth.getSession()

          if (error) {
            throw error
          }

          if (!data.session) {
            throw new Error('No active sign-in session was found.')
          }
        }

        if (isMounted) {
          navigate('/', { replace: true })
        }
      } catch (error) {
        if (isMounted) {
          setIsError(true)
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not complete Google sign in.',
          )
        }
      }
    }

    completeSignIn()

    return () => {
      isMounted = false
    }
  }, [navigate])

  return (
    <main className="min-h-screen bg-[#F9F9F9] px-4 py-10 text-[#333333]">
      <section className="mx-auto max-w-md rounded-lg border border-[#DADADA] bg-white p-6 text-center shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <img
          src="/scoracle-base.png"
          alt=""
          className="mx-auto h-14 w-14 rounded-lg object-contain"
        />
        <h1 className="mt-4 text-2xl font-bold">Scoracle</h1>
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm font-semibold ${
            isError
              ? 'border-[#F45B5B] bg-[#F45B5B]/10 text-[#8a2626]'
              : 'border-[#3CC8A5] bg-[#3CC8A5]/10 text-[#146b59]'
          }`}
        >
          {message}
        </p>
        {isError ? (
          <Link
            to="/"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-[#3CC8A5] px-4 text-sm font-semibold text-[#3CC8A5] transition hover:bg-[#3CC8A5]/10"
          >
            Back to Scoracle
          </Link>
        ) : null}
      </section>
    </main>
  )
}
