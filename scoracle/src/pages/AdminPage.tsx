import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Activity, RefreshCw, Users } from 'lucide-react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/useAuth'
import type { AdminProfileRow } from '../types/auth'

type AdminPredictionRow = {
  id: string
  fixture_id: string
  match_week: number
  predicted_home_score: number
  predicted_away_score: number
  closeness: string | null
  points: number
  is_locked: boolean
  created_at: string
}

type AdminFixtureRow = {
  id: string
  matchweek: number
  kickoff_utc: string
  status: string
  home_score: number | null
  away_score: number | null
  home_team_id: string
  away_team_id: string
}

type AdminTeamRow = {
  id: string
  canonical_name: string
  crest_url: string | null
}

type ActivityLogRow = {
  id: number
  user_id: string | null
  target_user_id: string | null
  event_type: ActivityEventType
  metadata: Record<string, unknown>
  created_at: string
}

type ActivityEventType =
  | 'ACCOUNT_CREATED'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'SESSION_TIMEOUT'
  | 'PREDICTION_CREATED'
  | 'PREDICTION_UPDATED'
  | 'PREDICTION_DELETED'
  | 'PROFILE_UPDATED'
  | 'ONBOARDING_COMPLETED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'

const LOG_PAGE_SIZE = 50

const ACTIVITY_FILTERS: Array<{
  value: 'all' | ActivityEventType
  label: string
}> = [
  { value: 'all', label: 'All actions' },
  { value: 'SIGNED_IN', label: 'Signed in' },
  { value: 'SIGNED_OUT', label: 'Signed out' },
  { value: 'SESSION_TIMEOUT', label: 'Session timeout' },
  { value: 'PREDICTION_CREATED', label: 'Prediction created' },
  { value: 'PREDICTION_UPDATED', label: 'Prediction updated' },
  { value: 'PREDICTION_DELETED', label: 'Prediction deleted' },
  { value: 'PROFILE_UPDATED', label: 'Profile updated' },
  { value: 'ACCOUNT_CREATED', label: 'Account created' },
  { value: 'ONBOARDING_COMPLETED', label: 'Onboarding completed' },
  { value: 'USER_DISABLED', label: 'User disabled' },
  { value: 'USER_ENABLED', label: 'User enabled' },
]

export function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users')
  const [users, setUsers] = useState<AdminProfileRow[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([])
  const [activityFilter, setActivityFilter] = useState<
    'all' | ActivityEventType
  >('all')
  const [activityUserFilter, setActivityUserFilter] = useState('all')
  const [hasMoreActivity, setHasMoreActivity] = useState(false)
  const [isActivityFetching, setIsActivityFetching] = useState(false)
  const hasPrunedActivity = useRef(false)
  const [selectedProfile, setSelectedProfile] =
    useState<AdminProfileRow | null>(null)
  const [selectedPredictions, setSelectedPredictions] = useState<
    AdminPredictionRow[]
  >([])
  const [selectedFixtures, setSelectedFixtures] = useState<
    Map<string, AdminFixtureRow>
  >(new Map())
  const [selectedTeams, setSelectedTeams] = useState<Map<string, AdminTeamRow>>(
    new Map(),
  )
  const [message, setMessage] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isProfileFetching, setIsProfileFetching] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsFetching(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, username, first_name, last_name, role, is_disabled, favorite_club, avatar_url, onboarding_required, onboarding_completed_at, created_at',
      )
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setUsers((data ?? []) as AdminProfileRow[])
    }

    setIsFetching(false)
  }, [])

  const fetchActivityLogs = useCallback(
    async (offset = 0) => {
      setIsActivityFetching(true)
      setMessage(null)

      let query = supabase
        .from('app_activity_logs')
        .select(
          'id, user_id, target_user_id, event_type, metadata, created_at',
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + LOG_PAGE_SIZE - 1)

      if (activityFilter !== 'all') {
        query = query.eq('event_type', activityFilter)
      }

      if (activityUserFilter !== 'all') {
        query = query.or(
          `user_id.eq.${activityUserFilter},target_user_id.eq.${activityUserFilter}`,
        )
      }

      const { data, error } = await query

      if (error) {
        setMessage(error.message)
      } else {
        const rows = (data ?? []) as ActivityLogRow[]
        setActivityLogs((current) =>
          offset === 0 ? rows : [...current, ...rows],
        )
        setHasMoreActivity(rows.length === LOG_PAGE_SIZE)
      }

      setIsActivityFetching(false)
    },
    [activityFilter, activityUserFilter],
  )

  const fetchUserProfile = useCallback(async (target: AdminProfileRow) => {
    setSelectedProfile(target)
    setSelectedPredictions([])
    setSelectedFixtures(new Map())
    setSelectedTeams(new Map())
    setIsProfileFetching(true)
    setMessage(null)

    const { data: predictions, error: predictionsError } = await supabase
      .from('predictions')
      .select(
        'id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at',
      )
      .eq('user_id', target.id)
      .order('match_week', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(25)

    if (predictionsError) {
      setMessage(predictionsError.message)
      setIsProfileFetching(false)
      return
    }

    const predictionRows = (predictions ?? []) as AdminPredictionRow[]
    setSelectedPredictions(predictionRows)

    const fixtureIds = Array.from(
      new Set(predictionRows.map((prediction) => prediction.fixture_id)),
    )

    if (fixtureIds.length === 0) {
      setIsProfileFetching(false)
      return
    }

    const { data: fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select(
        'id, matchweek, kickoff_utc, status, home_score, away_score, home_team_id, away_team_id',
      )
      .in('id', fixtureIds)

    if (fixturesError) {
      setMessage(fixturesError.message)
      setIsProfileFetching(false)
      return
    }

    const fixtureRows = (fixtures ?? []) as AdminFixtureRow[]
    setSelectedFixtures(new Map(fixtureRows.map((fixture) => [fixture.id, fixture])))

    const teamIds = Array.from(
      new Set(
        fixtureRows.flatMap((fixture) => [
          fixture.home_team_id,
          fixture.away_team_id,
        ]),
      ),
    )

    if (teamIds.length > 0) {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, canonical_name, crest_url')
        .in('id', teamIds)

      if (teamsError) {
        setMessage(teamsError.message)
      } else {
        const teamRows = (teams ?? []) as AdminTeamRow[]
        setSelectedTeams(new Map(teamRows.map((team) => [team.id, team])))
      }
    }

    setIsProfileFetching(false)
  }, [])

  const selectedPredictionStats = useMemo(() => {
    return selectedPredictions.reduce(
      (stats, prediction) => ({
        count: stats.count + 1,
        points: stats.points + prediction.points,
        exact:
          stats.exact + (prediction.closeness === 'EXACT' ? 1 : 0),
      }),
      { count: 0, points: 0, exact: 0 },
    )
  }, [selectedPredictions])

  useEffect(() => {
    if (!isAdmin) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchUsers()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchUsers, isAdmin])

  useEffect(() => {
    if (!isAdmin || activeTab !== 'activity') {
      return
    }

    if (!hasPrunedActivity.current) {
      hasPrunedActivity.current = true
      void supabase.rpc('prune_activity_logs', { retention_days: 90 })
    }

    const timeoutId = window.setTimeout(() => {
      void fetchActivityLogs(0)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeTab, fetchActivityLogs, isAdmin])

  async function toggleDisabled(target: AdminProfileRow) {
    if (target.id === user?.id) {
      setMessage('Admins cannot disable themselves.')
      return
    }

    setUpdatingUserId(target.id)
    setMessage(null)

    const { data, error } = await supabase.rpc('admin_set_user_disabled', {
      target_user_id: target.id,
      disabled: !target.is_disabled,
    })

    if (error) {
      setMessage(error.message)
    } else {
      const updated = Array.isArray(data) ? data[0] : null
      setUsers((current) =>
        current.map((row) =>
          updated && row.id === updated.id
            ? ({ ...row, ...updated } as AdminProfileRow)
            : row,
        ),
      )
      if (updated) {
        setSelectedProfile((current) =>
          current?.id === updated.id
            ? ({ ...current, ...updated } as AdminProfileRow)
            : current,
        )
      }
    }

    setUpdatingUserId(null)
  }

  if (isLoading) {
    return <AdminShell message="Checking admin access..." />
  }

  if (!user) {
    return (
      <AdminShell message="Log in to access Scoracle admin tools.">
        <Link
          to="/"
          className="mt-4 inline-flex rounded-lg bg-[#F45B5B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3CC8A5]"
        >
          Return home
        </Link>
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return <AdminShell message="Access denied." />
  }

  return (
    <main className="min-h-screen bg-[#F7F5FF] px-4 py-6 text-[#12163F] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl rounded-lg border border-[#DCD5FF] bg-white p-5 shadow-[0_12px_32px_rgba(18,22,63,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <img
              src="/scoracle-lettering.png"
              alt="Scoracle"
              className="h-6 w-auto object-contain"
            />
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="mt-1 text-sm text-[#5f6664]">
              View user IDs, read-only profiles, and account status. Emails and passwords are not shown.
            </p>
          </div>
          <Link
            to="/"
            className="rounded-lg border border-[#3CC8A5] px-4 py-2 text-center text-sm font-semibold text-[#3CC8A5] transition hover:bg-[#3CC8A5]/10"
          >
            Home
          </Link>
        </div>

        {message ? (
          <div className="mt-4 rounded-lg border border-[#F45B5B] bg-[#F45B5B]/10 px-3 py-2 text-sm font-semibold text-[#8a2626]">
            {message}
          </div>
        ) : null}

        <div
          className="mt-5 flex w-full max-w-sm rounded-lg border border-[#DCD5FF] bg-[#F7F5FF] p-1"
          role="tablist"
          aria-label="Admin sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            onClick={() => setActiveTab('users')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
              activeTab === 'users'
                ? 'bg-white text-[#5B3FFF] shadow-sm'
                : 'text-[#555B7A] hover:text-[#12163F]'
            }`}
          >
            <Users size={16} aria-hidden="true" />
            Users
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'activity'}
            onClick={() => setActiveTab('activity')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
              activeTab === 'activity'
                ? 'bg-white text-[#5B3FFF] shadow-sm'
                : 'text-[#555B7A] hover:text-[#12163F]'
            }`}
          >
            <Activity size={16} aria-hidden="true" />
            Activity log
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
            <div className="overflow-hidden rounded-lg border border-[#DCD5FF]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="bg-gradient-to-r from-[#5B3FFF] to-[#FF2D9A] text-white">
                  <tr>
                    <th className="px-3 py-3 font-semibold">User ID</th>
                    <th className="px-3 py-3 font-semibold">Username</th>
                    <th className="px-3 py-3 font-semibold">Role</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Created</th>
                    <th className="px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCD5FF] bg-white">
                  {users.map((profile) => (
                    <tr
                      key={profile.id}
                      className={
                        selectedProfile?.id === profile.id
                          ? 'bg-gradient-to-r from-[#F1ECFF] to-[#E9FFFC]'
                          : ''
                      }
                    >
                      <td className="px-3 py-3">
                        <code className="rounded-md bg-[#F7F5FF] px-2 py-1 text-xs font-bold text-[#555B7A]" title={profile.id}>
                          {shortUserId(profile.id)}
                        </code>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <AdminAvatar profile={profile} />
                          <span className="font-semibold">{profile.username}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">{profile.role}</td>
                      <td className="px-3 py-3">
                        {profile.is_disabled ? 'Disabled' : 'Active'}
                      </td>
                      <td className="px-3 py-3">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void fetchUserProfile(profile)}
                            className="rounded-lg border border-[#5B3FFF] px-3 py-2 text-sm font-semibold text-[#5B3FFF] transition hover:bg-[#F1ECFF]"
                          >
                            View profile
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDisabled(profile)}
                            disabled={
                              profile.id === user.id ||
                              updatingUserId === profile.id
                            }
                            className="rounded-lg border border-[#DCD5FF] px-3 py-2 text-sm font-semibold transition hover:bg-[#E8F4FA] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {profile.is_disabled ? 'Enable' : 'Disable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isFetching && users.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-[#5f6664]" colSpan={6}>
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                </table>
              </div>
            </div>

            <AdminProfilePanel
              profile={selectedProfile}
              predictions={selectedPredictions}
              fixtures={selectedFixtures}
              teams={selectedTeams}
              stats={selectedPredictionStats}
              isLoading={isProfileFetching}
            />
          </div>
        ) : (
          <ActivityLogPanel
            logs={activityLogs}
            users={users}
            eventFilter={activityFilter}
            userFilter={activityUserFilter}
            isLoading={isActivityFetching}
            hasMore={hasMoreActivity}
            onEventFilterChange={setActivityFilter}
            onUserFilterChange={setActivityUserFilter}
            onRefresh={() => void fetchActivityLogs(0)}
            onLoadMore={() => void fetchActivityLogs(activityLogs.length)}
          />
        )}
      </section>
    </main>
  )
}

function ActivityLogPanel({
  logs,
  users,
  eventFilter,
  userFilter,
  isLoading,
  hasMore,
  onEventFilterChange,
  onUserFilterChange,
  onRefresh,
  onLoadMore,
}: {
  logs: ActivityLogRow[]
  users: AdminProfileRow[]
  eventFilter: 'all' | ActivityEventType
  userFilter: string
  isLoading: boolean
  hasMore: boolean
  onEventFilterChange: (value: 'all' | ActivityEventType) => void
  onUserFilterChange: (value: string) => void
  onRefresh: () => void
  onLoadMore: () => void
}) {
  const usersById = useMemo(
    () => new Map(users.map((profile) => [profile.id, profile])),
    [users],
  )

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-[#DCD5FF] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#DCD5FF] bg-gradient-to-r from-[#F7F5FF] to-[#E9FFFC] p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-xl font-black text-[#12163F]">
            User activity
          </h2>
          <p className="mt-1 text-sm font-medium text-[#555B7A]">
            Operational events from the last 90 days. No passwords, emails, or IP addresses are stored.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs font-bold uppercase text-[#555B7A]">
            Action
            <select
              value={eventFilter}
              onChange={(event) =>
                onEventFilterChange(
                  event.target.value as 'all' | ActivityEventType,
                )
              }
              className="mt-1 block min-h-10 w-full rounded-lg border border-[#DCD5FF] bg-white px-3 text-sm font-semibold text-[#12163F] outline-none focus:border-[#5B3FFF] focus:ring-2 focus:ring-[#5B3FFF]/15 sm:w-52"
            >
              {ACTIVITY_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold uppercase text-[#555B7A]">
            User
            <select
              value={userFilter}
              onChange={(event) => onUserFilterChange(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-lg border border-[#DCD5FF] bg-white px-3 text-sm font-semibold text-[#12163F] outline-none focus:border-[#5B3FFF] focus:ring-2 focus:ring-[#5B3FFF]/15 sm:w-52"
            >
              <option value="all">All users</option>
              {users.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.username}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#5B3FFF] bg-white px-3 text-sm font-bold text-[#5B3FFF] transition hover:bg-[#F1ECFF] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isLoading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gradient-to-r from-[#5B3FFF] to-[#FF2D9A] text-white">
            <tr>
              <th className="px-4 py-3 font-bold">Time</th>
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCD5FF]">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-[#F7F5FF]">
                <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-[#555B7A]">
                  {formatActivityTime(log.created_at)}
                </td>
                <td className="px-4 py-3 font-bold text-[#12163F]">
                  {activityUserName(log.user_id, usersById)}
                </td>
                <td className="px-4 py-3">
                  <ActivityBadge eventType={log.event_type} />
                </td>
                <td className="px-4 py-3 font-medium text-[#555B7A]">
                  {activityDetails(log, usersById)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#DCD5FF] md:hidden">
        {logs.map((log) => (
          <article key={log.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-[#12163F]">
                  {activityUserName(log.user_id, usersById)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#555B7A]">
                  {formatActivityTime(log.created_at)}
                </p>
              </div>
              <ActivityBadge eventType={log.event_type} />
            </div>
            <p className="text-sm font-medium text-[#555B7A]">
              {activityDetails(log, usersById)}
            </p>
          </article>
        ))}
      </div>

      {!isLoading && logs.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Activity className="mx-auto text-[#5B3FFF]" aria-hidden="true" />
          <p className="mt-3 font-bold text-[#12163F]">No activity found</p>
          <p className="mt-1 text-sm text-[#555B7A]">
            New account, session, profile, and prediction events will appear here.
          </p>
        </div>
      ) : null}

      {isLoading && logs.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm font-bold text-[#555B7A]">
          Loading activity...
        </p>
      ) : null}

      {logs.length > 0 ? (
        <div className="flex items-center justify-between border-t border-[#DCD5FF] bg-[#F7F5FF] px-4 py-3">
          <p className="text-xs font-bold text-[#555B7A]">
            Showing {logs.length} event{logs.length === 1 ? '' : 's'}
          </p>
          {hasMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoading}
              className="rounded-lg bg-[#5B3FFF] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#FF2D9A] disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function ActivityBadge({ eventType }: { eventType: ActivityEventType }) {
  const colorClass = eventType.startsWith('PREDICTION_')
    ? 'bg-[#E9FFFC] text-[#087E78]'
    : eventType === 'SIGNED_IN' || eventType === 'ACCOUNT_CREATED'
      ? 'bg-[#E4FAF3] text-[#087E78]'
      : eventType === 'USER_DISABLED'
        ? 'bg-[#FDE7E7] text-[#A12828]'
        : eventType === 'SESSION_TIMEOUT'
          ? 'bg-[#FFF0DD] text-[#8A5200]'
          : 'bg-[#F1ECFF] text-[#5B3FFF]'

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${colorClass}`}
    >
      {formatActivityLabel(eventType)}
    </span>
  )
}

function activityUserName(
  userId: string | null,
  usersById: Map<string, AdminProfileRow>,
) {
  if (!userId) {
    return 'System'
  }

  return usersById.get(userId)?.username ?? shortUserId(userId)
}

function activityDetails(
  log: ActivityLogRow,
  usersById: Map<string, AdminProfileRow>,
) {
  const metadata = log.metadata ?? {}
  const matchWeek = metadata.match_week
  const homeScore = metadata.predicted_home_score
  const awayScore = metadata.predicted_away_score

  switch (log.event_type) {
    case 'SIGNED_IN':
      return `Provider: ${stringMetadata(metadata.provider, 'unknown')}`
    case 'SIGNED_OUT':
      return 'Manual sign out'
    case 'SESSION_TIMEOUT':
      return 'Signed out after inactivity'
    case 'ACCOUNT_CREATED':
      return 'Created a Scoracle account'
    case 'PREDICTION_CREATED':
    case 'PREDICTION_UPDATED':
    case 'PREDICTION_DELETED':
      return `MW ${String(matchWeek ?? '?')} | ${String(homeScore ?? '?')} - ${String(awayScore ?? '?')}`
    case 'PROFILE_UPDATED': {
      const changedFields = Array.isArray(metadata.changed_fields)
        ? metadata.changed_fields
            .filter((field): field is string => typeof field === 'string')
            .map((field) => field.replaceAll('_', ' '))
        : []
      return changedFields.length > 0
        ? `Changed ${changedFields.join(', ')}`
        : 'Updated profile'
    }
    case 'ONBOARDING_COMPLETED':
      return 'Completed or skipped the welcome tour'
    case 'USER_DISABLED':
    case 'USER_ENABLED':
      return `Affected user: ${activityUserName(log.target_user_id, usersById)}`
  }
}

function stringMetadata(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function formatActivityLabel(eventType: ActivityEventType) {
  return eventType
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function AdminProfilePanel({
  profile,
  predictions,
  fixtures,
  teams,
  stats,
  isLoading,
}: {
  profile: AdminProfileRow | null
  predictions: AdminPredictionRow[]
  fixtures: Map<string, AdminFixtureRow>
  teams: Map<string, AdminTeamRow>
  stats: { count: number; points: number; exact: number }
  isLoading: boolean
}) {
  if (!profile) {
    return (
      <aside className="rounded-lg border border-dashed border-[#DCD5FF] bg-[#F7F5FF] p-5 text-sm font-semibold text-[#555B7A]">
        Select a user to view their read-only profile.
      </aside>
    )
  }

  return (
    <aside className="rounded-lg border border-[#DCD5FF] bg-white p-5 shadow-[0_12px_32px_rgba(18,22,63,0.08)]">
      <div className="flex items-start gap-3">
        <AdminAvatar profile={profile} large />
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black">{profile.username}</h2>
          <p className="mt-1 text-xs font-bold uppercase text-[#555B7A]">
            User ID
          </p>
          <code className="mt-1 block break-all rounded-lg bg-[#F7F5FF] px-2 py-1 text-xs font-bold text-[#555B7A]">
            {profile.id}
          </code>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <AdminProfileValue label="First name" value={profile.first_name ?? 'Not set'} />
        <AdminProfileValue label="Last name" value={profile.last_name ?? 'Not set'} />
        <AdminProfileValue label="Favorite club" value={profile.favorite_club ?? 'Not selected'} />
        <AdminProfileValue label="Role" value={profile.role} />
        <AdminProfileValue label="Status" value={profile.is_disabled ? 'Disabled' : 'Active'} />
        <AdminProfileValue
          label="Onboarding"
          value={
            profile.onboarding_required
              ? 'Required'
              : profile.onboarding_completed_at
                ? `Completed ${new Date(profile.onboarding_completed_at).toLocaleDateString()}`
                : 'Not required'
          }
        />
        <AdminProfileValue
          label="Created"
          value={new Date(profile.created_at).toLocaleString()}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <AdminStat label="Predictions" value={stats.count.toString()} />
        <AdminStat label="Points" value={stats.points.toString()} />
        <AdminStat label="Exact" value={stats.exact.toString()} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-black uppercase text-[#5B3FFF]">
          Recent predictions
        </h3>
        {isLoading ? (
          <p className="mt-3 rounded-lg bg-[#F7F5FF] p-3 text-sm font-semibold text-[#555B7A]">
            Loading profile...
          </p>
        ) : null}
        {!isLoading && predictions.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[#F7F5FF] p-3 text-sm font-semibold text-[#555B7A]">
            No saved predictions yet.
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {predictions.map((prediction) => {
            const fixture = fixtures.get(prediction.fixture_id)
            const homeTeam = fixture ? teams.get(fixture.home_team_id) : null
            const awayTeam = fixture ? teams.get(fixture.away_team_id) : null
            const actualResult =
              fixture?.home_score === null ||
              fixture?.away_score === null ||
              fixture?.home_score === undefined ||
              fixture?.away_score === undefined
                ? 'Pending'
                : `${fixture.home_score} - ${fixture.away_score}`

            return (
              <div
                key={prediction.id}
                className="rounded-lg border border-[#DCD5FF] bg-[#F7F5FF] p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-[#12163F]">
                      MW {prediction.match_week}
                    </p>
                    <p className="mt-1 truncate font-semibold text-[#555B7A]">
                      {homeTeam?.canonical_name ?? 'Home'} vs{' '}
                      {awayTeam?.canonical_name ?? 'Away'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-black text-[#5B3FFF]">
                    +{prediction.points}
                  </span>
                </div>
                <p className="mt-2 font-bold">
                  Prediction: {prediction.predicted_home_score} -{' '}
                  {prediction.predicted_away_score}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#555B7A]">
                  Actual: {actualResult} · {formatCloseness(prediction.closeness)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function AdminProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#DCD5FF] bg-[#F7F5FF] px-3 py-2">
      <p className="text-xs font-bold uppercase text-[#555B7A]">{label}</p>
      <p className="mt-1 font-semibold text-[#12163F]">{value}</p>
    </div>
  )
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-[#F1ECFF] to-[#E9FFFC] px-3 py-2 text-center">
      <p className="text-lg font-black text-[#5B3FFF]">{value}</p>
      <p className="text-xs font-bold uppercase text-[#555B7A]">{label}</p>
    </div>
  )
}

function AdminAvatar({
  profile,
  large = false,
}: {
  profile: AdminProfileRow
  large?: boolean
}) {
  const sizeClass = large ? 'h-14 w-14 text-lg' : 'h-8 w-8 text-xs'

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full border-2 border-[#18D6C9] object-cover`}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border-2 border-[#18D6C9] bg-[#E9FFFC] font-black text-[#12163F]`}
    >
      {profile.username.slice(0, 1).toUpperCase()}
    </span>
  )
}

function shortUserId(userId: string) {
  return `${userId.slice(0, 8)}...${userId.slice(-4)}`
}

function formatCloseness(closeness: string | null) {
  if (!closeness || closeness === 'NOT_SCORED') {
    return 'Not scored'
  }

  return closeness
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function AdminShell({
  message,
  children,
}: {
  message: string
  children?: ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#F9F9F9] px-4 py-10 text-[#333333]">
      <section className="mx-auto max-w-md rounded-lg border border-[#DADADA] bg-white p-6 text-center shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <img
          src="/scoracle-logo.png"
          alt=""
          className="mx-auto h-16 w-16 rounded-lg object-contain"
        />
        <h1 className="mt-4 flex flex-col items-center gap-2 text-2xl font-bold">
          <img
            src="/scoracle-lettering.png"
            alt="Scoracle"
            className="h-7 w-auto object-contain"
          />
          <span>Admin</span>
        </h1>
        <p className="mt-2 text-sm text-[#5f6664]">{message}</p>
        {children}
      </section>
    </main>
  )
}
