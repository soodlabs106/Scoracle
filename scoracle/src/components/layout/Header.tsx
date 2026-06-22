import { Link } from 'react-router'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../context/useAuth'

type HeaderProps = {
  onLogin: () => void
  onSignup: () => void
}

export function Header({ onLogin, onSignup }: HeaderProps) {
  const { profile, isAdmin, isLoading, message, signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
  }

  return (
    <header className="border-b border-[#DADADA] bg-white/90">
      <div className="mx-auto flex min-h-[72px] max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link to="/" className="flex items-center gap-3 text-left">
          <img
            src="/scoracle-base.png"
            alt="Scoracle"
            className="h-14 w-14 rounded-lg object-contain"
          />
          <div>
            <h1 className="text-3xl font-bold leading-tight text-[#333333]">
              Scoracle
            </h1>
            <p className="text-sm text-[#5f6664]">
              Predict the Premier League. Prove your edge.
            </p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {message ? (
            <span className="rounded-full border border-[#EEDFA3] bg-[#EEDFA3]/45 px-3 py-2 text-xs font-semibold text-[#333333]">
              {message}
            </span>
          ) : (
            <span className="hidden items-center gap-2 rounded-full border border-[#DADADA] bg-[#E8F4FA] px-3 py-2 text-xs font-semibold text-[#333333] sm:inline-flex">
              <Sparkles className="h-4 w-4 text-[#3CC8A5]" />
              {profile ? 'Prediction mode' : 'Fixture mode'}
            </span>
          )}

          {profile ? (
            <>
              <button
                type="button"
                className="rounded-lg border border-[#DADADA] px-4 py-2 text-sm font-semibold text-[#333333]"
              >
                Leaderboard
              </button>
              {isAdmin ? (
                <Link
                  to="/admin-soodlabs"
                  className="rounded-lg border border-[#4DB7E8] px-4 py-2 text-sm font-semibold text-[#03718a] transition hover:bg-[#E8F4FA]"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                to="/profile"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#DADADA] bg-[#E8F4FA] py-1 pl-1 pr-3 text-sm font-semibold text-[#333333] transition hover:bg-[#DADADA]/60"
                title="Open profile"
              >
                <HeaderAvatar
                  avatarUrl={profile.avatar_url}
                  username={profile.username}
                />
                <span className="max-w-44 truncate">{profile.username}</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-[#3CC8A5] px-4 py-2 text-sm font-semibold text-[#3CC8A5] transition hover:bg-[#3CC8A5]/10 focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/40"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onLogin}
                disabled={isLoading}
                className="rounded-lg border border-[#3CC8A5] px-4 py-2 text-sm font-semibold text-[#3CC8A5] transition hover:bg-[#3CC8A5]/10 focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/40 disabled:opacity-60"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={onSignup}
                disabled={isLoading}
                className="rounded-lg bg-[#F45B5B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#F45B5B]/35 disabled:opacity-60"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function HeaderAvatar({
  avatarUrl,
  username,
}: {
  avatarUrl: string | null
  username: string
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border border-white object-cover"
      />
    )
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white bg-[#3CC8A5]/20 text-xs font-bold text-[#02745d]">
      {initials(username)}
    </span>
  )
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
