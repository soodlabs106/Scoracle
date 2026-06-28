import { Link } from 'react-router'
import { HelpCircle, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { useHelp } from '../../features/help/useHelp'

type HeaderProps = {
  onLogin: () => void
  onSignup: () => void
}

export function Header({ onLogin, onSignup }: HeaderProps) {
  const { profile, isAdmin, isLoading, message, signOut } = useAuth()
  const { openHelp } = useHelp()

  async function handleSignOut() {
    await signOut()
  }

  return (
    <header className="border-b border-[#DCD5FF] bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-[72px] max-w-[1600px] flex-col items-center gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:justify-between lg:px-8">
        <Link to="/" className="flex w-full items-center justify-center gap-3 text-left lg:w-auto lg:justify-start">
          <img
            src="/scoracle-logo.png"
            alt=""
            className="h-14 w-14 rounded-lg object-contain"
          />
          <div>
            <h1>
              <img
                src="/scoracle-lettering.png"
                alt="Scoracle"
                className="h-9 w-auto object-contain"
              />
            </h1>
            <p className="text-sm font-medium text-[#555B7A]">
              Predict the Premier League. Prove your edge.
            </p>
          </div>
        </Link>

        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3 lg:w-auto lg:justify-end">
          <button
            type="button"
            onClick={openHelp}
            aria-label="Open Scoracle help"
            title="Help"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DCD5FF] bg-white text-[#5B3FFF] shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-[#F1ECFF] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]/30 sm:h-10 sm:w-10"
          >
            <HelpCircle size={19} aria-hidden="true" />
          </button>
          {message ? (
            <span className="rounded-full border border-[#DCD5FF] bg-[#FFF0F8] px-3 py-2 text-xs font-bold text-[#12163F]">
              {message}
            </span>
          ) : (
            <span
              data-tour-id="mode"
              className="hidden items-center gap-2 rounded-full border border-[#DCD5FF] bg-[#F1ECFF] px-4 py-2 text-xs font-bold text-[#5B3FFF] shadow-[0_8px_20px_rgba(91,63,255,0.10)] sm:inline-flex"
            >
              <Sparkles className="h-4 w-4 text-[#5B3FFF]" />
              {profile ? 'Prediction mode' : 'Fixture mode'}
            </span>
          )}

          {profile ? (
            <>
              <Link
                to="/leaderboard"
                data-tour-id="leaderboard-link"
                className="rounded-lg border border-[#DCD5FF] bg-white px-2 py-2 text-xs font-semibold text-[#12163F] shadow-sm transition-all duration-200 hover:bg-[#F1ECFF] sm:px-4 sm:text-sm"
              >
                Leaderboard
              </Link>
              {isAdmin ? (
                <Link
                  to="/admin-soodlabs"
                  className="rounded-lg border border-[#5B3FFF] bg-white px-4 py-2 text-sm font-semibold text-[#5B3FFF] shadow-sm transition-all duration-200 hover:bg-[#F1ECFF]"
                >
                  Admin
                </Link>
              ) : null}
              <Link
                to="/profile"
                data-tour-id="profile-link"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DCD5FF] bg-[#E9FFFC] p-0.5 text-sm font-semibold text-[#12163F] shadow-sm transition-all duration-200 hover:bg-[#F1ECFF] sm:h-11 sm:w-auto sm:gap-2 sm:justify-start sm:p-1 sm:pr-3"
                title="Open profile"
              >
                <HeaderAvatar
                  avatarUrl={profile.avatar_url}
                  username={profile.username}
                />
                <span className="hidden max-w-44 truncate sm:inline">{profile.username}</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-[#18D6C9] bg-white px-2 py-2 text-xs font-semibold text-[#12163F] transition-all duration-200 hover:bg-[#E9FFFC] focus:outline-none focus:ring-2 focus:ring-[#18D6C9]/40 sm:px-4 sm:text-sm"
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
                className="rounded-lg border border-[#5B3FFF] bg-white px-5 py-2 text-sm font-semibold text-[#5B3FFF] shadow-sm transition-all duration-200 hover:bg-[#F1ECFF] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]/30 disabled:opacity-60"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={onSignup}
                disabled={isLoading}
                className="rounded-lg bg-gradient-to-br from-[#FF2D9A] to-[#8B5CFF] px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,45,154,0.24)] transition-all duration-200 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#FF2D9A]/35 disabled:opacity-60"
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
        className="h-9 w-9 shrink-0 rounded-full border-2 border-[#18D6C9] object-cover"
      />
    )
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#18D6C9] bg-[#E9FFFC] text-xs font-bold text-[#12163F]">
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
