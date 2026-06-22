import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import {
  ArrowLeft,
  Camera,
  LockKeyhole,
  Pencil,
  Save,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useAuth } from '../context/useAuth'
import { fetchHomeData, mockHomeData, type Team } from '../data/homeData'
import { fetchSimulatedPredictionHistory } from '../data/predictionSimulation'
import { supabase } from '../lib/supabaseClient'
import type { PredictionRow } from '../types/predictions'
import {
  getPredictionClosenessDisplay,
  type PredictionCloseness,
} from '../utils/predictionScoring'

const AVATAR_BUCKET = 'profile-avatars'
const MAX_AVATAR_SOURCE_BYTES = 3 * 1024 * 1024
const MAX_AVATAR_DIMENSION = 512
const AVATAR_QUALITY = 0.82
const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const TEAM_CODES_BY_NORMALIZED_NAME: Record<string, string> = {
  arsenal: 'ARS',
  astonvilla: 'AVL',
  bournemouth: 'BOU',
  brentford: 'BRE',
  brightonandhovealbion: 'BRI',
  brightonhovealbion: 'BRI',
  chelsea: 'CHE',
  coventrycity: 'COV',
  crystalpalace: 'CRY',
  everton: 'EVE',
  fulham: 'FUL',
  hullcity: 'HUL',
  ipswichtown: 'IPS',
  leedsunited: 'LEE',
  liverpool: 'LIV',
  manchestercity: 'MCI',
  manchesterunited: 'MUN',
  newcastleunited: 'NEW',
  nottinghamforest: 'NFO',
  sunderland: 'SUN',
  tottenhamhotspur: 'TOT',
}

type FixtureHistoryRow = {
  id: string
  matchweek: number
  kickoffUtc: string
  homeScore: number | null
  awayScore: number | null
  homeTeamId: string
  awayTeamId: string
}

type TeamRow = {
  id: string
  canonical_name: string
  team_code: string | null
  crest_url: string | null
}

type HistoryItem = {
  prediction: PredictionRow
  fixture?: FixtureHistoryRow
  homeTeam?: string
  awayTeam?: string
  homeTeamCode?: string
  awayTeamCode?: string
  homeTeamCrestUrl?: string
  awayTeamCrestUrl?: string
  matchweekLockAt?: string
}

export function ProfilePage() {
  const {
    profile,
    user,
    isLoading,
    updateProfile,
    checkUsernameAvailability,
  } = useAuth()
  const [clubs, setClubs] = useState<Team[]>(mockHomeData.teams)
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [favoriteClub, setFavoriteClub] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [selectedHistoryMatchweek, setSelectedHistoryMatchweek] = useState('all')
  const [deletingPredictionId, setDeletingPredictionId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (profile) {
      const timeoutId = window.setTimeout(() => {
        setUsername(profile.username)
        setFirstName(profile.first_name ?? '')
        setLastName(profile.last_name ?? '')
        setFavoriteClub(profile.favorite_club ?? '')
        setAvatarUrl(profile.avatar_url)
        setAvatarPath(profile.avatar_path)
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }
  }, [profile])

  useEffect(() => {
    let isMounted = true

    fetchHomeData()
      .then((data) => {
        if (isMounted) {
          setClubs(data.teams)
        }
      })
      .catch(() => {
        if (isMounted) {
          setClubs(mockHomeData.teams)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    let isMounted = true
    const currentUser = user

    async function loadHistory() {
      setIsHistoryLoading(true)

      try {
        const homeData = await fetchHomeData().catch(() => mockHomeData)
        const simulatedHistory = await fetchSimulatedPredictionHistory(
          currentUser.id,
          homeData,
        )

        if (simulatedHistory) {
          if (isMounted) {
            setHistory(simulatedHistory)
          }
          return
        }

        await supabase.rpc('score_my_predictions_for_completed_fixtures')

        const { data: predictionRows, error: predictionError } = await supabase
          .from('predictions')
          .select(
            'id, user_id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at, updated_at',
          )
          .eq('user_id', currentUser.id)
          .order('match_week', { ascending: false })

        if (predictionError) {
          throw predictionError
        }

        const predictions = (predictionRows ?? []) as PredictionRow[]
        const predictionWeeks = Array.from(
          new Set(predictions.map((prediction) => prediction.match_week)),
        )

        if (predictionWeeks.length === 0) {
          if (isMounted) {
            setHistory([])
          }
          return
        }

        const { data: fixtureRows, error: fixtureError } = await supabase
          .from('fixtures')
          .select(
            'id, matchweek, kickoff_utc, home_score, away_score, home_team_id, away_team_id',
          )
          .in('matchweek', predictionWeeks)

        if (fixtureError) {
          throw fixtureError
        }

        const fixtures = (fixtureRows ?? []).map((fixture) => ({
          id: fixture.id,
          matchweek: fixture.matchweek,
          kickoffUtc: fixture.kickoff_utc,
          homeScore: fixture.home_score,
          awayScore: fixture.away_score,
          homeTeamId: fixture.home_team_id,
          awayTeamId: fixture.away_team_id,
        })) as FixtureHistoryRow[]
        const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
        const lockByMatchweek = new Map<number, string>()
        for (const fixture of fixtures) {
          const currentLock = lockByMatchweek.get(fixture.matchweek)
          if (
            !currentLock ||
            new Date(fixture.kickoffUtc).getTime() <
              new Date(currentLock).getTime()
          ) {
            lockByMatchweek.set(fixture.matchweek, fixture.kickoffUtc)
          }
        }
        const teamIds = Array.from(
          new Set(
            fixtures.flatMap((fixture) => [
              fixture.homeTeamId,
              fixture.awayTeamId,
            ]),
          ),
        )

        const { data: teamRows, error: teamError } = await supabase
          .from('teams')
          .select('id, canonical_name, team_code, crest_url')
          .in('id', teamIds)

        if (teamError) {
          throw teamError
        }

        const teamsById = new Map(
          ((teamRows ?? []) as TeamRow[]).map((team) => [
            team.id,
            team,
          ]),
        )
        const rows = predictions
          .map((prediction) => {
            const fixture = fixturesById.get(prediction.fixture_id)

            return {
              prediction,
              fixture,
              homeTeam: fixture
                ? teamsById.get(fixture.homeTeamId)?.canonical_name
                : undefined,
              awayTeam: fixture
                ? teamsById.get(fixture.awayTeamId)?.canonical_name
                : undefined,
              homeTeamCode: fixture
                ? teamsById.get(fixture.homeTeamId)?.team_code ??
                  getTeamCodeFallback(
                    teamsById.get(fixture.homeTeamId)?.canonical_name,
                  )
                : undefined,
              awayTeamCode: fixture
                ? teamsById.get(fixture.awayTeamId)?.team_code ??
                  getTeamCodeFallback(
                    teamsById.get(fixture.awayTeamId)?.canonical_name,
                  )
                : undefined,
              homeTeamCrestUrl: fixture
                ? teamsById.get(fixture.homeTeamId)?.crest_url ?? undefined
                : undefined,
              awayTeamCrestUrl: fixture
                ? teamsById.get(fixture.awayTeamId)?.crest_url ?? undefined
                : undefined,
              matchweekLockAt: lockByMatchweek.get(prediction.match_week),
            }
          })
          .sort((first, second) => {
            const weekDelta =
              second.prediction.match_week - first.prediction.match_week

            if (weekDelta !== 0) {
              return weekDelta
            }

            return (
              new Date(first.fixture?.kickoffUtc ?? 0).getTime() -
              new Date(second.fixture?.kickoffUtc ?? 0).getTime()
            )
          })

        if (isMounted) {
          setHistory(rows)
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Could not load prediction history.',
          )
        }
      } finally {
        if (isMounted) {
          setIsHistoryLoading(false)
        }
      }
    }

    loadHistory()

    return () => {
      isMounted = false
    }
  }, [user])

  const historyMatchweeks = useMemo(
    () =>
      Array.from(new Set(history.map((item) => item.prediction.match_week))).sort(
        (first, second) => second - first,
      ),
    [history],
  )
  const visibleHistory = useMemo(
    () =>
      selectedHistoryMatchweek === 'all'
        ? history
        : history.filter(
            (item) =>
              item.prediction.match_week.toString() === selectedHistoryMatchweek,
          ),
    [history, selectedHistoryMatchweek],
  )
  const groupedHistory = useMemo(() => {
    const groups = new Map<number, HistoryItem[]>()

    for (const item of visibleHistory) {
      const rows = groups.get(item.prediction.match_week) ?? []
      rows.push(item)
      groups.set(item.prediction.match_week, rows)
    }

    return Array.from(groups.entries()).sort(([first], [second]) => second - first)
  }, [visibleHistory])
  const favoriteTeam = useMemo(
    () => clubs.find((club) => club.name === profile?.favorite_club),
    [clubs, profile?.favorite_club],
  )

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#F9F9F9] text-[#333333]">
        <Header onLogin={() => undefined} onSignup={() => undefined} />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="rounded-lg border border-[#DADADA] bg-white p-5 text-sm font-semibold">
            Loading profile...
          </p>
        </div>
      </main>
    )
  }

  if (!profile || !user) {
    return <Navigate to="/" replace />
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const trimmedUsername = username.trim()
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    if (!trimmedUsername) {
      setError('Username is required.')
      return
    }

    if (!trimmedFirstName || !trimmedLastName) {
      setError('First name and last name are required.')
      return
    }

    try {
      setIsSaving(true)
      let nextAvatarUrl = avatarUrl
      let nextAvatarPath = avatarPath

      if (selectedAvatarFile && user) {
        const preparedAvatar = await prepareAvatarUpload(selectedAvatarFile)
        const path = `${user.id}/avatar-${Date.now()}.webp`
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, preparedAvatar, {
            contentType: 'image/webp',
            upsert: true,
          })

        if (uploadError) {
          throw uploadError
        }

        const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
        nextAvatarUrl = data.publicUrl
        nextAvatarPath = path
      }

      if (trimmedUsername !== profile?.username) {
        const isAvailable = await checkUsernameAvailability(trimmedUsername)

        if (!isAvailable) {
          setError('That username is already taken.')
          return
        }
      }

      await updateProfile({
        username: trimmedUsername,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        favoriteClub: favoriteClub || null,
        avatarUrl: nextAvatarUrl,
        avatarPath: nextAvatarPath,
      })
      if (avatarPath && selectedAvatarFile && avatarPath !== nextAvatarPath) {
        await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath])
      }
      setAvatarUrl(nextAvatarUrl)
      setAvatarPath(nextAvatarPath)
      setSelectedAvatarFile(null)
      setIsEditing(false)
      setMessage('Profile saved.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save profile.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleEditCancel() {
    if (!profile) {
      return
    }

    setUsername(profile.username)
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setFavoriteClub(profile.favorite_club ?? '')
    setAvatarUrl(profile.avatar_url)
    setAvatarPath(profile.avatar_path)
    setSelectedAvatarFile(null)
    setError(null)
    setMessage(null)
    setIsEditing(false)
  }

  function handleAvatarSelect(file: File | null) {
    setError(null)

    if (!file) {
      setSelectedAvatarFile(null)
      return
    }

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setError('Upload a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setError('Avatar photo must be 3 MB or smaller before compression.')
      return
    }

    setSelectedAvatarFile(file)
    setAvatarUrl(URL.createObjectURL(file))
  }

  async function handleDeletePrediction(item: HistoryItem) {
    if (
      isMatchweekLocked(item.prediction.match_week, history) ||
      hasActualResult(item.fixture)
    ) {
      setError('Predictions are locked for that match week.')
      return
    }

    const shouldDelete = window.confirm(
      'Delete this saved prediction? You can enter it again while the match week is open.',
    )

    if (!shouldDelete) {
      return
    }

    setDeletingPredictionId(item.prediction.id)
    setError(null)
    setMessage(null)

    try {
      const { error: deleteError } = await supabase
        .from('predictions')
        .delete()
        .eq('id', item.prediction.id)

      if (deleteError) {
        throw deleteError
      }

      setHistory((current) =>
        current.filter(
          (historyItem) => historyItem.prediction.id !== item.prediction.id,
        ),
      )
      setMessage('Prediction deleted.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not delete prediction.',
      )
    } finally {
      setDeletingPredictionId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#F9F9F9] text-[#333333]">
      <Header onLogin={() => undefined} onSignup={() => undefined} />

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E8F4FA] text-[#3CC8A5]">
              <UserRound className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">Profile</h2>
              <p className="text-sm text-[#5f6664]">
                Manage your Scoracle identity and prediction history.
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-[#3CC8A5] bg-white px-4 text-sm font-semibold text-[#3CC8A5] transition hover:bg-[#3CC8A5]/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to predictions
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <form
            onSubmit={handleSave}
            className="self-start rounded-lg border border-[#DADADA] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <AvatarPreview avatarUrl={avatarUrl} username={profile.username} />
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold">{profile.username}</p>
                  <p className="mt-1 text-sm font-semibold text-[#5f6664]">
                    {profile.email}
                  </p>
                </div>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true)
                    setMessage(null)
                    setError(null)
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#333333] transition hover:bg-[#E8F4FA]"
                  aria-label="Edit profile"
                  title="Edit profile"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {!isEditing ? (
              <div className="mt-5 space-y-3">
                <ProfileValue label="Username" value={profile.username} />
                <ProfileValue label="Email ID" value={profile.email} />
                <ProfileValue
                  label="First name"
                  value={profile.first_name ?? 'Not set'}
                />
                <ProfileValue
                  label="Last name"
                  value={profile.last_name ?? 'Not set'}
                />
                <div className="rounded-lg border border-[#DADADA] bg-[#F9F9F9] px-3 py-3">
                  <p className="text-xs font-semibold uppercase text-[#5f6664]">
                    Favorite club
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm font-bold">
                    <ClubCrest team={favoriteTeam} />
                    <span>{profile.favorite_club ?? 'Not selected'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <label className="block text-sm font-semibold text-[#333333]">
                  Profile photo
                  <div className="mt-2 flex items-center gap-3">
                    <AvatarPreview avatarUrl={avatarUrl} username={username} />
                    <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DADADA] px-3 text-sm font-semibold text-[#333333]">
                      <Camera className="h-4 w-4" />
                      Choose photo
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      handleAvatarSelect(event.target.files?.[0] ?? null)
                    }
                    className="sr-only"
                  />
                  <span className="mt-2 block text-xs font-medium text-[#5f6664]">
                    JPG, PNG, or WebP. Max 3 MB before upload; Scoracle stores a compressed 512px WebP.
                  </span>
                </label>

                <label className="mt-4 block text-sm font-semibold text-[#333333]">
                  Username
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
                  />
                  <span className="mt-1 block text-xs font-medium text-[#5f6664]">
                    Spaces and casing are ignored when checking uniqueness.
                  </span>
                </label>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#333333]">
                    First name
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#333333]">
                    Last name
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
                    />
                  </label>
                </div>

                <ReadOnlyField label="Email ID" value={profile.email} />

                <label className="mt-4 block text-sm font-semibold text-[#333333]">
                  Favorite club
                  <select
                    value={favoriteClub}
                    onChange={(event) => setFavoriteClub(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] bg-white px-3 text-base focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
                  >
                    <option value="">Choose a club</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.name}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {error ? (
              <p className="mt-4 rounded-lg border border-[#F45B5B] bg-[#F45B5B]/10 px-3 py-2 text-sm font-semibold text-[#8a2626]">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-lg border border-[#3CC8A5] bg-[#3CC8A5]/10 px-3 py-2 text-sm font-semibold text-[#146b59]">
                {message}
              </p>
            ) : null}

            {isEditing ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#3CC8A5] px-4 text-sm font-semibold text-white transition hover:bg-[#F45B5B] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save profile'}
                </button>
                <button
                  type="button"
                  onClick={handleEditCancel}
                  disabled={isSaving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#DADADA] px-4 text-sm font-semibold text-[#333333] transition hover:bg-[#F9F9F9] disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            ) : null}
          </form>

          <section className="rounded-lg border border-[#DADADA] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">Prediction History</h3>
                <p className="text-sm text-[#5f6664]">
                  Grouped by match week with scored results when available.
                </p>
              </div>
              <label className="grid gap-1 text-xs font-semibold uppercase text-[#5f6664]">
                Match week
                <select
                  value={selectedHistoryMatchweek}
                  onChange={(event) =>
                    setSelectedHistoryMatchweek(event.target.value)
                  }
                  className="h-10 rounded-lg border border-[#DADADA] bg-[#F9F9F9] px-3 text-sm font-semibold normal-case text-[#333333] focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20"
                >
                  <option value="all">All match weeks</option>
                  {historyMatchweeks.map((matchweek) => (
                    <option key={matchweek} value={matchweek}>
                      MW {matchweek}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {isHistoryLoading ? (
              <p className="mt-4 rounded-lg border border-[#DADADA] bg-[#F9F9F9] p-4 text-sm font-semibold">
                Loading predictions...
              </p>
            ) : null}

            {!isHistoryLoading && groupedHistory.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-[#DADADA] bg-[#F9F9F9] p-5 text-center text-sm font-semibold text-[#5f6664]">
                No saved predictions yet.
              </p>
            ) : null}

            <div className="mt-4 space-y-5">
              {groupedHistory.map(([matchWeek, items]) => (
                <div key={matchWeek}>
                  <h4 className="mb-2 text-sm font-bold uppercase text-[#03718a]">
                    Match Week {matchWeek}
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-[#DADADA]">
                    <table className="w-full table-fixed text-left text-xs">
                      <thead className="bg-[#E8F4FA] text-xs uppercase text-[#5f6664]">
                        <tr>
                          <th className="w-[28%] px-2 py-2">Fixture</th>
                          <th className="w-[15%] px-2 py-2">Pred</th>
                          <th className="w-[13%] px-2 py-2">Actual</th>
                          <th className="w-[21%] px-2 py-2">Call</th>
                          <th className="w-[10%] px-2 py-2 text-right">Pts</th>
                          <th className="w-[13%] px-2 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DADADA]">
                        {items.map((item) => {
                          const closeness =
                            item.prediction.closeness ?? 'NOT_SCORED'
                          const display = getPredictionClosenessDisplay(
                            closeness as PredictionCloseness,
                          )
                          const isPendingResult = !hasActualResult(item.fixture)
                          const isLocked = isMatchweekLocked(
                            item.prediction.match_week,
                            history,
                          ) || hasActualResult(item.fixture)

                          return (
                            <tr key={item.prediction.id}>
                              <td className="px-3 py-3 font-semibold">
                                <FixtureLabel item={item} />
                              </td>
                              <td className="px-2 py-3">
                                <span
                                  className={`inline-flex whitespace-nowrap rounded-lg border px-2 py-1 font-bold ${
                                    isPendingResult
                                      ? 'border-[#F59E0B]'
                                      : 'border-transparent'
                                  }`}
                                >
                                  {item.prediction.predicted_home_score} -{' '}
                                  {item.prediction.predicted_away_score}
                                </span>
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap">
                                {formatActualResult(item.fixture)}
                              </td>
                              <td className="px-2 py-3">
                                {isPendingResult ? (
                                  <span className="inline-flex whitespace-nowrap rounded-full border border-[#F59E0B] bg-white px-2 py-1 text-xs font-bold text-[#8a5a00]">
                                    TBP
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold"
                                    style={{
                                      backgroundColor: display.backgroundColor,
                                      color: display.textColor,
                                    }}
                                  >
                                    {display.label}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-3 text-right font-bold">
                                {item.prediction.points}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {isLocked ? (
                                  <span
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#F45B5B]/10 text-[#8a2626]"
                                    aria-label="Prediction locked"
                                    title="Predictions locked"
                                  >
                                    <LockKeyhole className="h-4 w-4" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePrediction(item)}
                                    disabled={
                                      deletingPredictionId === item.prediction.id
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#F45B5B]/45 text-[#8a2626] transition hover:bg-[#F45B5B]/10 disabled:cursor-not-allowed disabled:border-[#DADADA] disabled:text-[#5f6664]"
                                    aria-label="Delete prediction"
                                    title="Delete prediction"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function formatActualResult(fixture?: FixtureHistoryRow) {
  if (!hasActualResult(fixture)) {
    return 'Pending'
  }

  return `${fixture.homeScore} - ${fixture.awayScore}`
}

function FixtureLabel({ item }: { item: HistoryItem }) {
  const homeCode = item.homeTeamCode ?? getTeamCodeFallback(item.homeTeam)
  const awayCode = item.awayTeamCode ?? getTeamCodeFallback(item.awayTeam)

  return (
    <span
      className="inline-grid grid-cols-[20px_32px_16px_20px_32px] items-center gap-1 whitespace-nowrap"
      title={`${item.homeTeam ?? 'Home'} vs ${item.awayTeam ?? 'Away'}`}
    >
      <ClubMiniCrest
        crestUrl={item.homeTeamCrestUrl}
        label={item.homeTeam ?? 'Home'}
      />
      <span className="font-bold tracking-normal">{homeCode}</span>
      <span className="text-center text-[#5f6664]">vs</span>
      <ClubMiniCrest
        crestUrl={item.awayTeamCrestUrl}
        label={item.awayTeam ?? 'Away'}
      />
      <span className="font-bold tracking-normal">{awayCode}</span>
    </span>
  )
}

function getTeamCodeFallback(teamName?: string | null) {
  if (!teamName) {
    return 'TBC'
  }

  const normalizedName = normalizeTeamName(teamName)
  const knownCode = TEAM_CODES_BY_NORMALIZED_NAME[normalizedName]

  if (knownCode) {
    return knownCode
  }

  return teamName.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'TBC'
}

function normalizeTeamName(teamName: string) {
  return teamName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function ClubMiniCrest({
  crestUrl,
  label,
}: {
  crestUrl?: string
  label: string
}) {
  if (crestUrl) {
    return (
      <img
        src={crestUrl}
        alt=""
        className="h-5 w-5 shrink-0 rounded-full object-contain"
      />
    )
  }

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3CC8A5]/15 text-[9px] font-bold text-[#02745d]">
      {initials(label).slice(0, 2)}
    </span>
  )
}

function hasActualResult(
  fixture?: FixtureHistoryRow,
): fixture is FixtureHistoryRow & {
  homeScore: number
  awayScore: number
} {
  return Boolean(
    fixture &&
      fixture.homeScore !== null &&
      fixture.awayScore !== null,
  )
}

function AvatarPreview({
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
        className="h-20 w-20 shrink-0 rounded-lg border border-[#DADADA] object-cover"
      />
    )
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-[#DADADA] bg-[#E8F4FA] text-xl font-bold text-[#03718a]">
      {initials(username)}
    </div>
  )
}

function ClubCrest({ team }: { team?: Team }) {
  if (team?.crestUrl) {
    return (
      <img
        src={team.crestUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-contain"
      />
    )
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3CC8A5]/15 text-xs font-bold text-[#02745d]">
      {team ? initials(team.shortName) : 'PL'}
    </span>
  )
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#DADADA] bg-[#F9F9F9] px-3 py-3">
      <p className="text-xs font-semibold uppercase text-[#5f6664]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[#333333]">
        {value}
      </p>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-sm font-semibold text-[#333333]">
      {label}
      <input
        value={value}
        readOnly
        className="mt-1 h-11 w-full rounded-lg border border-[#DADADA] bg-[#F1F1F1] px-3 text-base font-semibold text-[#5f6664]"
      />
    </label>
  )
}

function isMatchweekLocked(matchweek: number, history: HistoryItem[]) {
  const lockSource = history.find(
    (item) =>
      item.prediction.match_week === matchweek && Boolean(item.matchweekLockAt),
  )?.matchweekLockAt

  if (!lockSource) {
    return true
  }

  const firstKickoff = new Date(lockSource).getTime()
  const lockAt = firstKickoff - 24 * 60 * 60 * 1000

  return Date.now() >= lockAt
}

async function prepareAvatarUpload(file: File) {
  const image = await loadImage(file)
  const scale = Math.min(
    1,
    MAX_AVATAR_DIMENSION / Math.max(image.width, image.height),
  )
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not prepare avatar image.')
  }

  context.drawImage(image, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not compress avatar image.'))
          return
        }

        resolve(blob)
      },
      'image/webp',
      AVATAR_QUALITY,
    )
  })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read avatar image.'))
    }
    image.src = url
  })
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
}
