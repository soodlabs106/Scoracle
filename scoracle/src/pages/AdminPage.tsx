import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Activity, Database, HelpCircle, RefreshCw, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../context/useAuth'
import type { AdminProfileRow } from '../types/auth'
import { useHelp } from '../features/help/useHelp'
import {
  fetchAdminActivityLogs,
  fetchAdminUserDetails,
  fetchAdminUsers,
  fetchSystemJobRuns,
  isSystemJobRunsMigrationMissing,
  updateAdminUserStatus,
  type ActivityEventType,
  type ActivityLogRow,
  type AdminFixtureRow,
  type AdminPredictionRow,
  type AdminTeamRow,
  type SystemJobRunRow,
  type SystemJobRunStatus,
} from '../features/admin/adminRepository'

const LOG_PAGE_SIZE = 50
const USER_PAGE_SIZE = 50

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
  const { user, session, isAdmin, isLoading } = useAuth()
  const { openHelp } = useHelp()
  const [activeTab, setActiveTab] = useState<
    'users' | 'activity' | 'maintenance'
  >('users')
  const [users, setUsers] = useState<AdminProfileRow[]>([])
  const [hasMoreUsers, setHasMoreUsers] = useState(false)
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([])
  const [activityFilter, setActivityFilter] = useState<
    'all' | ActivityEventType
  >('all')
  const [activityUserFilter, setActivityUserFilter] = useState('all')
  const [hasMoreActivity, setHasMoreActivity] = useState(false)
  const [isActivityFetching, setIsActivityFetching] = useState(false)
  const [maintenanceRuns, setMaintenanceRuns] = useState<SystemJobRunRow[]>([])
  const [isMaintenanceFetching, setIsMaintenanceFetching] = useState(false)
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null)
  const [maintenanceNeedsMigration, setMaintenanceNeedsMigration] =
    useState(false)
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

  const fetchUsers = useCallback(async (offset = 0) => {
    setIsFetching(true)
    setMessage(null)

    try {
      const rows = await fetchAdminUsers(offset, USER_PAGE_SIZE)
      setUsers((current) => (offset === 0 ? rows : [...current, ...rows]))
      setHasMoreUsers(rows.length === USER_PAGE_SIZE)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load users.')
    }

    setIsFetching(false)
  }, [])

  const fetchActivityLogs = useCallback(
    async (offset = 0) => {
      setIsActivityFetching(true)
      setMessage(null)

      try {
        const rows = await fetchAdminActivityLogs(
          offset,
          LOG_PAGE_SIZE,
          activityFilter,
          activityUserFilter,
        )
        setActivityLogs((current) =>
          offset === 0 ? rows : [...current, ...rows],
        )
        setHasMoreActivity(rows.length === LOG_PAGE_SIZE)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not load activity.')
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

    try {
      const details = await fetchAdminUserDetails(target.id)
      setSelectedPredictions(details.predictions)
      setSelectedFixtures(new Map(details.fixtures.map((row) => [row.id, row])))
      setSelectedTeams(new Map(details.teams.map((row) => [row.id, row])))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load user details.')
    }

    setIsProfileFetching(false)
  }, [])

  const fetchMaintenanceRuns = useCallback(async () => {
    setIsMaintenanceFetching(true)
    setMaintenanceError(null)
    setMaintenanceNeedsMigration(false)

    try {
      setMaintenanceRuns(await fetchSystemJobRuns(50))
    } catch (error) {
      if (isSystemJobRunsMigrationMissing(error)) {
        setMaintenanceRuns([])
        setMaintenanceNeedsMigration(true)
        return
      }

      setMaintenanceError(
        error instanceof Error
          ? error.message
          : 'Could not load system maintenance logs.',
      )
    } finally {
      setIsMaintenanceFetching(false)
    }
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
      void fetchUsers(0)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchUsers, isAdmin])

  useEffect(() => {
    if (!isAdmin || activeTab !== 'activity') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchActivityLogs(0)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeTab, fetchActivityLogs, isAdmin])

  useEffect(() => {
    if (!isAdmin || activeTab !== 'maintenance') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchMaintenanceRuns()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeTab, fetchMaintenanceRuns, isAdmin])

  async function toggleDisabled(target: AdminProfileRow) {
    if (target.id === user?.id) {
      setMessage('Admins cannot disable themselves.')
      return
    }

    setUpdatingUserId(target.id)
    setMessage(null)

    try {
      const updated = await updateAdminUserStatus(
        session?.access_token ?? '',
        target.id,
        !target.is_disabled,
      )
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
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not update user status.',
      )
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openHelp}
              aria-label="Open Scoracle help"
              title="Help"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#DCD5FF] bg-white text-[#5B3FFF] transition hover:bg-[#F1ECFF] focus:outline-none focus:ring-2 focus:ring-[#5B3FFF]/30"
            >
              <HelpCircle size={18} aria-hidden="true" />
            </button>
            <Link
              to="/"
              className="rounded-lg border border-[#3CC8A5] px-4 py-2 text-center text-sm font-semibold text-[#3CC8A5] transition hover:bg-[#3CC8A5]/10"
            >
              Home
            </Link>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-lg border border-[#F45B5B] bg-[#F45B5B]/10 px-3 py-2 text-sm font-semibold text-[#8a2626]">
            {message}
          </div>
        ) : null}

        <div
          className="mt-5 flex w-full max-w-xl rounded-lg border border-[#DCD5FF] bg-[#F7F5FF] p-1"
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
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'maintenance'}
            onClick={() => setActiveTab('maintenance')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
              activeTab === 'maintenance'
                ? 'bg-white text-[#5B3FFF] shadow-sm'
                : 'text-[#555B7A] hover:text-[#12163F]'
            }`}
          >
            <Database size={16} aria-hidden="true" />
            <span className="hidden sm:inline">System Maintenance</span>
            <span className="sm:hidden">Maintenance</span>
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
              {hasMoreUsers ? (
                <div className="border-t border-[#DCD5FF] bg-[#F7F5FF] p-3 text-right">
                  <button
                    type="button"
                    onClick={() => void fetchUsers(users.length)}
                    disabled={isFetching}
                    className="rounded-lg bg-[#5B3FFF] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {isFetching ? 'Loading...' : 'Load more users'}
                  </button>
                </div>
              ) : null}
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
        ) : activeTab === 'activity' ? (
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
        ) : (
          <SystemMaintenancePanel
            runs={maintenanceRuns}
            isLoading={isMaintenanceFetching}
            error={maintenanceError}
            needsMigration={maintenanceNeedsMigration}
            onRefresh={() => void fetchMaintenanceRuns()}
          />
        )}
      </section>
    </main>
  )
}

function SystemMaintenancePanel({
  runs,
  isLoading,
  error,
  needsMigration,
  onRefresh,
}: {
  runs: SystemJobRunRow[]
  isLoading: boolean
  error: string | null
  needsMigration: boolean
  onRefresh: () => void
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-[#DCD5FF] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#DCD5FF] bg-gradient-to-r from-[#F7F5FF] to-[#E9FFFC] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-[#12163F]">
            Supabase Maintenance Logs
          </h2>
          <p className="mt-1 text-sm font-medium text-[#555B7A]">
            Latest 50 lightweight maintenance runs. Details are sanitized before storage.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#5B3FFF] bg-white px-3 text-sm font-bold text-[#5B3FFF] transition hover:bg-[#F1ECFF] disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="m-4 rounded-lg border border-[#F45B5B] bg-[#F45B5B]/10 p-3 text-sm font-semibold text-[#8a2626]">
          {error}
        </p>
      ) : null}

      {needsMigration ? (
        <div className="m-4 rounded-lg border border-[#F59E0B]/60 bg-[#FFF4CC] p-4">
          <p className="font-bold text-[#12163F]">
            Maintenance logging is awaiting its database migration.
          </p>
          <p className="mt-1 text-sm font-medium text-[#555B7A]">
            Apply the pending Supabase migrations, then refresh this tab. No application data needs to be changed manually.
          </p>
        </div>
      ) : null}

      {isLoading && runs.length === 0 ? (
        <p className="p-6 text-center text-sm font-semibold text-[#555B7A]">
          Loading maintenance logs...
        </p>
      ) : null}

      {!isLoading && !error && !needsMigration && runs.length === 0 ? (
        <div className="p-6 text-center">
          <p className="font-bold text-[#12163F]">
            No maintenance runs have been logged yet.
          </p>
          <p className="mt-1 text-sm font-medium text-[#555B7A]">
            Run the GitHub Action manually to create the first entry.
          </p>
        </div>
      ) : null}

      {runs.length > 0 ? (
        <div className="grid gap-3 p-4">
          {runs.map((run) => (
            <MaintenanceRunCard key={run.id} run={run} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function MaintenanceRunCard({ run }: { run: SystemJobRunRow }) {
  const details = run.details ?? {}
  const lightweightCheck = asRecord(details.lightweight_check)
  const error = asRecord(details.error)

  return (
    <article className="rounded-lg border border-[#DCD5FF] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[#12163F]">{run.job_name}</h3>
            <MaintenanceStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm font-medium text-[#555B7A]">
            {new Date(run.ran_at).toLocaleString()}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-1 text-xs sm:text-right">
          <MetadataValue label="Source" value={stringValue(details.source)} />
          <MetadataValue label="Trigger" value={stringValue(details.trigger)} />
          <MetadataValue label="Run ID" value={stringValue(details.run_id)} />
          <MetadataValue
            label="Attempt"
            value={stringValue(details.run_attempt)}
          />
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#DCD5FF] bg-[#F7F5FF] px-3 py-2 text-sm font-semibold text-[#12163F]">
        {stringValue(lightweightCheck?.summary) ??
          stringValue(error?.message) ??
          'No check summary recorded.'}
      </div>

      {error ? (
        <p className="mt-2 text-sm font-semibold text-[#8a2626]">
          {stringValue(error.step) ?? 'Maintenance'}: {stringValue(error.message) ?? 'Run failed'}
          {stringValue(error.http_status)
            ? ` (HTTP ${stringValue(error.http_status)})`
            : ''}
        </p>
      ) : null}

    </article>
  )
}

function MaintenanceStatusBadge({ status }: { status: SystemJobRunStatus }) {
  const classes: Record<SystemJobRunStatus, string> = {
    success: 'bg-[#E4FAF3] text-[#146b59]',
    failed: 'bg-[#FDE7E7] text-[#8a2626]',
    skipped: 'bg-[#FFF4CC] text-[#7a5c00]',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${classes[status]}`}>
      {status}
    </span>
  )
}

function MetadataValue({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <span>
      <span className="font-bold text-[#555B7A]">{label}: </span>
      <span className="font-semibold text-[#12163F]">{value ?? '-'}</span>
    </span>
  )
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return null
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
