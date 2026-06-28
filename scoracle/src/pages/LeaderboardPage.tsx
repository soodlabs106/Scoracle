import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Medal,
  Minus,
  Trophy,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { FilterDropdown } from '../components/ui/FilterDropdown'
import { useAuth } from '../context/useAuth'
import {
  fetchMatchWeekLeaderboard,
  fetchOverallLeaderboard,
  fetchRankTimeline,
  fetchScoredMatchWeeks,
} from '../data/leaderboard'
import type {
  LeaderboardRow,
  MatchWeekLeaderboardRow,
  RankMovementRow,
} from '../types/leaderboard'

type ActiveTab = 'overall' | 'matchweek'

type WeeklyDisplayRow = MatchWeekLeaderboardRow & {
  movement?: RankMovementRow
}

export function LeaderboardPage() {
  const { user, profile, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<ActiveTab>('overall')
  const [overallRows, setOverallRows] = useState<LeaderboardRow[]>([])
  const [weeklyRows, setWeeklyRows] = useState<WeeklyDisplayRow[]>([])
  const [rankTimelineRows, setRankTimelineRows] = useState<RankMovementRow[]>([])
  const [scoredMatchWeeks, setScoredMatchWeeks] = useState<number[]>([])
  const [selectedMatchWeek, setSelectedMatchWeek] = useState<number | null>(null)
  const [isMatchWeekMenuOpen, setIsMatchWeekMenuOpen] = useState(false)
  const [isOverallLoading, setIsOverallLoading] = useState(false)
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false)
  const [isRankingOpen, setIsRankingOpen] = useState(true)
  const [isGraphOpen, setIsGraphOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      return
    }

    let isMounted = true

    async function loadInitialData() {
      setIsOverallLoading(true)
      setIsWeeklyLoading(true)
      setError(null)

      try {
        const [overall, weeks, timeline] = await Promise.all([
          fetchOverallLeaderboard(),
          fetchScoredMatchWeeks(),
          fetchRankTimeline(),
        ])

        if (!isMounted) {
          return
        }

        setOverallRows(overall)
        setScoredMatchWeeks(weeks)
        setRankTimelineRows(timeline)
        setSelectedMatchWeek((current) => current ?? weeks[0] ?? null)
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Could not load leaderboard.',
          )
        }
      } finally {
        if (isMounted) {
          setIsOverallLoading(false)
          setIsWeeklyLoading(false)
        }
      }
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    if (!user || selectedMatchWeek === null) {
      return
    }

    let isMounted = true
    const matchWeek = selectedMatchWeek

    async function loadWeeklyData() {
      setIsWeeklyLoading(true)
      setError(null)

      try {
        const weekly = await fetchMatchWeekLeaderboard(matchWeek)
        const movement = rankTimelineRows.filter(
          (row) => row.match_week === matchWeek,
        )
        const movementByUser = new Map(
          movement.map((row) => [row.user_id, row]),
        )

        if (isMounted) {
          setWeeklyRows(
            weekly.map((row) => ({
              ...row,
              movement: movementByUser.get(row.user_id),
            })),
          )
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Could not load match-week leaderboard.',
          )
        }
      } finally {
        if (isMounted) {
          setIsWeeklyLoading(false)
        }
      }
    }

    void loadWeeklyData()

    return () => {
      isMounted = false
    }
  }, [rankTimelineRows, selectedMatchWeek, user])

  const currentOverallRow = useMemo(
    () => overallRows.find((row) => row.user_id === user?.id),
    [overallRows, user?.id],
  )
  const currentWeeklyRow = useMemo(
    () => weeklyRows.find((row) => row.user_id === user?.id),
    [weeklyRows, user?.id],
  )

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#F7F5FF] text-[#12163F]">
        <Header onLogin={() => undefined} onSignup={() => undefined} />
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState message="Loading leaderboard..." />
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen bg-[#F7F5FF] text-[#12163F]">
      <Header onLogin={() => undefined} onSignup={() => undefined} />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mb-5 pr-12">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F1ECFF] text-[#5B3FFF]">
              <Trophy className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">Leaderboard</h2>
              <p className="text-sm font-medium text-[#555B7A]">
                Track weekly points, exact scores, and overall rank.
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#5B3FFF] bg-white text-[#5B3FFF] transition-all duration-200 hover:bg-[#F1ECFF]"
            aria-label="Back to predictions"
            title="Back to predictions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-[#F45B5B] bg-[#F45B5B]/10 px-3 py-2 text-sm font-semibold text-[#8a2626]">
            {error}
          </p>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[#DCD5FF] bg-white p-3 shadow-[0_12px_32px_rgba(18,22,63,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-grid grid-cols-2 rounded-lg border border-[#DCD5FF] bg-[#F7F5FF] p-1">
            <TabButton
              label="Overall"
              isActive={activeTab === 'overall'}
              onClick={() => setActiveTab('overall')}
            />
            <TabButton
              label="Match week"
              isActive={activeTab === 'matchweek'}
              onClick={() => setActiveTab('matchweek')}
            />
          </div>

          {activeTab === 'matchweek' ? (
            <div className="w-full sm:w-44">
              <FilterDropdown
                label="Match week"
                selectedValue={selectedMatchWeek?.toString() ?? ''}
                selectedLabel={
                  selectedMatchWeek === null ? 'No scored weeks' : `MW ${selectedMatchWeek}`
                }
                isOpen={isMatchWeekMenuOpen}
                disabled={scoredMatchWeeks.length === 0}
                options={
                  scoredMatchWeeks.length === 0
                    ? [{ value: '', label: 'No scored weeks', disabled: true }]
                    : scoredMatchWeeks.map((matchWeek) => ({
                        value: matchWeek.toString(),
                        label: `MW ${matchWeek}`,
                      }))
                }
                onOpenChange={setIsMatchWeekMenuOpen}
                onSelect={(value) => setSelectedMatchWeek(Number(value))}
              />
            </div>
          ) : null}
        </div>

        {activeTab === 'overall' ? (
          <>
            <UserSummary
              label="Your overall rank"
              row={currentOverallRow}
              rows={overallRows}
              pointsLabel="Pts"
            />
            <MobileAccordionSection
              title="Ranking table"
              isOpen={isRankingOpen}
              onToggle={() => setIsRankingOpen((value) => !value)}
            >
              <LeaderboardTable
                rows={overallRows}
                currentUserId={user.id}
                currentUsername={profile?.username ?? null}
                isLoading={isOverallLoading}
                emptyMessage="No leaderboard yet. Scores will appear after the first match week is completed and predictions are scored."
                pointsHeader="Pts"
                getPoints={(row) => row.total_points}
              />
            </MobileAccordionSection>
            <MobileAccordionSection
              title="Rank movement"
              isOpen={isGraphOpen}
              onToggle={() => setIsGraphOpen((value) => !value)}
            >
              <RankTimelineChart
                rows={rankTimelineRows}
                users={overallRows}
                matchWeeks={scoredMatchWeeks}
              />
            </MobileAccordionSection>
          </>
        ) : (
          <>
            <UserSummary
              label={`Your MW ${selectedMatchWeek ?? '-'} rank`}
              row={currentWeeklyRow}
              rows={weeklyRows}
              pointsLabel="Weekly pts"
              isWeekly
            />
            <MobileAccordionSection
              title="Ranking table"
              isOpen={isRankingOpen}
              onToggle={() => setIsRankingOpen((value) => !value)}
            >
              <LeaderboardTable
                rows={weeklyRows}
                currentUserId={user.id}
                currentUsername={profile?.username ?? null}
                isLoading={isWeeklyLoading}
                emptyMessage={
                  scoredMatchWeeks.length === 0
                    ? 'No leaderboard yet. Scores will appear after the first match week is completed and predictions are scored.'
                    : 'No scored predictions for this match week yet.'
                }
                pointsHeader="Weekly pts"
                getPoints={(row) => row.total_points}
                showMovement
              />
            </MobileAccordionSection>
            <MobileAccordionSection
              title="Rank movement"
              isOpen={isGraphOpen}
              onToggle={() => setIsGraphOpen((value) => !value)}
            >
              <RankTimelineChart
                rows={rankTimelineRows}
                users={overallRows}
                matchWeeks={scoredMatchWeeks}
              />
            </MobileAccordionSection>
          </>
        )}
      </section>
    </main>
  )
}

function RankTimelineChart({
  rows,
  users,
  matchWeeks,
}: {
  rows: RankMovementRow[]
  users: LeaderboardRow[]
  matchWeeks: number[]
}) {
  const weeks = [...matchWeeks].sort((first, second) => first - second)
  const usersById = new Map(users.map((user) => [user.user_id, user]))
  const userIds = users.map((user) => user.user_id)
  const maxRank = Math.max(3, users.length)
  const width = 680
  const height = 300
  const padding = { top: 28, right: 28, bottom: 46, left: 54 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const colors = ['#FF2D9A', '#5B3FFF', '#18D6C9', '#2F6BFF', '#555B7A']
  const rowsByUserWeek = new Map(
    rows.map((row) => [`${row.user_id}:${row.match_week}`, row]),
  )

  if (weeks.length === 0 || users.length === 0) {
    return null
  }

  function pointFor(userId: string, matchWeek: number) {
    const weekIndex = weeks.indexOf(matchWeek)
    const row = rowsByUserWeek.get(`${userId}:${matchWeek}`)

    if (!row) {
      return null
    }

    const x =
      padding.left +
      (weeks.length === 1 ? plotWidth / 2 : (weekIndex / (weeks.length - 1)) * plotWidth)
    const y =
      padding.top +
      (maxRank === 1 ? 0 : ((row.current_rank - 1) / (maxRank - 1)) * plotHeight)

    return { x, y, row }
  }

  return (
    <section className="mb-4 rounded-lg border border-[#DCD5FF] bg-white p-4 shadow-[0_12px_32px_rgba(18,22,63,0.08)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Rank movement</h3>
          <p className="text-sm font-medium text-[#555B7A]">
            Cumulative rank after each completed match week.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {users.map((user, index) => (
            <span
              key={user.user_id}
              className="inline-flex items-center gap-2 rounded-full border border-[#DCD5FF] bg-[#F7F5FF] px-2 py-1 text-xs font-bold text-[#12163F]"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              {user.username}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div
          className="relative min-w-[640px]"
          style={{ width, height }}
          aria-label="Rank movement line graph"
        >
          <svg
            width={width}
            height={height}
            role="img"
            aria-hidden="true"
            className="absolute inset-0"
          >
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + plotHeight}
              stroke="#DCD5FF"
            />
            <line
              x1={padding.left}
              y1={padding.top + plotHeight}
              x2={padding.left + plotWidth}
              y2={padding.top + plotHeight}
              stroke="#DCD5FF"
            />

            {Array.from({ length: maxRank }, (_, index) => {
              const rank = index + 1
              const y =
                padding.top +
                ((rank - 1) / Math.max(1, maxRank - 1)) * plotHeight

              return (
                <g key={rank}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + plotWidth}
                    y2={y}
                    stroke="#F1F1F1"
                  />
                  <text
                    x={padding.left - 14}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-[#5f6664] text-xs font-bold"
                  >
                    {rank}
                  </text>
                </g>
              )
            })}

            {weeks.map((matchWeek) => {
              const point = pointFor(userIds[0], matchWeek)
              const x =
                point?.x ??
                padding.left +
                  (weeks.length === 1
                    ? plotWidth / 2
                    : (weeks.indexOf(matchWeek) / (weeks.length - 1)) * plotWidth)

              return (
                <g key={matchWeek}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + plotHeight}
                    stroke="#F1F1F1"
                  />
                  <text
                    x={x}
                    y={height - 18}
                    textAnchor="middle"
                    className="fill-[#5f6664] text-xs font-bold"
                  >
                    MW {matchWeek}
                  </text>
                </g>
              )
            })}

            <text
              x={22}
              y={padding.top + plotHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 22 ${padding.top + plotHeight / 2})`}
              className="fill-[#5f6664] text-xs font-bold uppercase"
            >
              Rank
            </text>

            {userIds.map((userId, userIndex) => {
              const points = weeks
                .map((matchWeek) => pointFor(userId, matchWeek))
                .filter(Boolean) as Array<{
                x: number
                y: number
                row: RankMovementRow
              }>

              return (
                <polyline
                  key={userId}
                  points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={colors[userIndex % colors.length]}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            })}
          </svg>

          {userIds.flatMap((userId, userIndex) => {
            const user = usersById.get(userId)

            return weeks.map((matchWeek) => {
              const point = pointFor(userId, matchWeek)

              if (!point || !user) {
                return null
              }

              return (
                <div
                  key={`${userId}-${matchWeek}`}
                  className="absolute flex h-11 w-11 items-center justify-center rounded-full border-2 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
                  style={{
                    left: point.x,
                    top: point.y,
                    transform: 'translate(-50%, -50%)',
                    borderColor: colors[userIndex % colors.length],
                  }}
                  title={`${user.username}, MW ${matchWeek}, rank ${point.row.current_rank}`}
                >
                  <ChartAvatar user={user} />
                </div>
              )
            })
          })}
        </div>
      </div>
    </section>
  )
}

function MobileAccordionSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg border border-[#DADADA] bg-white px-3 py-3 text-left text-sm font-bold text-[#333333] shadow-[0_4px_12px_rgba(0,0,0,0.06)] lg:hidden"
        aria-expanded={isOpen}
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`${isOpen ? 'mt-3 block' : 'hidden'} lg:mt-0 lg:block`}>
        {children}
      </div>
    </section>
  )
}

function ChartAvatar({ user }: { user: LeaderboardRow }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="h-9 w-9 rounded-full object-cover"
      />
    )
  }

  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F4FA] text-xs font-bold text-[#03718a]">
      {initials(user.username)}
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

function normalizeLeaderboardUsername(username: string) {
  return username.toLowerCase().replace(/\s+/g, '')
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
        isActive
          ? 'bg-white text-[#5B3FFF] shadow-[0_8px_18px_rgba(91,63,255,0.12)]'
          : 'text-[#555B7A] hover:text-[#12163F]'
      }`}
    >
      {label}
    </button>
  )
}

function UserSummary({
  label,
  row,
  rows,
  pointsLabel,
  isWeekly = false,
}: {
  label: string
  row?: LeaderboardRow | WeeklyDisplayRow
  rows: Array<LeaderboardRow | WeeklyDisplayRow>
  pointsLabel: string
  isWeekly?: boolean
}) {
  if (!row) {
    return null
  }

  const rank = rows.findIndex((candidate) => candidate.user_id === row.user_id) + 1
  const points = isWeekly
    ? (row as WeeklyDisplayRow).total_points
    : row.total_points

  return (
    <section className="mb-4 rounded-lg border border-[#DCD5FF] bg-gradient-to-br from-[#F1ECFF] to-[#E9FFFC] p-4 shadow-[0_12px_32px_rgba(18,22,63,0.08)]">
      <p className="text-xs font-bold uppercase text-[#5B3FFF]">{label}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        <SummaryValue label="Rank" value={`#${rank}`} />
        <SummaryValue label={pointsLabel} value={points.toString()} />
        <SummaryValue label="Exact" value={row.exact_count.toString()} />
        <SummaryValue label="Great" value={row.great_count.toString()} />
      </div>
    </section>
  )
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[#555B7A]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[#12163F]">{value}</p>
    </div>
  )
}

function LeaderboardTable<T extends LeaderboardRow | WeeklyDisplayRow>({
  rows,
  currentUserId,
  currentUsername,
  isLoading,
  emptyMessage,
  pointsHeader,
  getPoints,
  showMovement = false,
}: {
  rows: T[]
  currentUserId: string
  currentUsername: string | null
  isLoading: boolean
  emptyMessage: string
  pointsHeader: string
  getPoints: (row: T) => number
  showMovement?: boolean
}) {
  if (isLoading) {
    return <EmptyState message="Loading leaderboard..." />
  }

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#DCD5FF] bg-white shadow-[0_12px_32px_rgba(18,22,63,0.08)]">
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left text-xs sm:text-sm">
          <thead className="bg-gradient-to-r from-[#5B3FFF] to-[#FF2D9A] text-[10px] uppercase text-white sm:text-xs">
            <tr>
              <th className="w-[22%] px-1.5 py-3 sm:px-3">Rank</th>
              <th className="w-[29%] px-1.5 py-3 sm:px-3">User</th>
              <th className="hidden w-[20%] px-3 py-3 md:table-cell">
                Favorite club
              </th>
              <th className="w-[14%] px-1.5 py-3 text-right sm:px-3">
                {pointsHeader}
              </th>
              <th className="w-[11%] px-1.5 py-3 text-right sm:px-3">
                <span className="hidden sm:inline">Exact</span>
                <span className="sm:hidden">Ex</span>
              </th>
              <th className="w-[11%] px-1.5 py-3 text-right sm:px-3">
                <span className="hidden sm:inline">Great</span>
                <span className="sm:hidden">Gr</span>
              </th>
              <th className="w-[13%] px-1.5 py-3 text-right sm:px-3">
                <span className="hidden sm:inline">Close</span>
                <span className="sm:hidden">Cl</span>
              </th>
              <th className="hidden w-[10%] px-3 py-3 text-right sm:table-cell">
                Played
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCD5FF]">
            {rows.map((row, index) => {
              const rank = index + 1
              const isCurrentUser =
                row.user_id === currentUserId ||
                (currentUsername !== null &&
                  normalizeLeaderboardUsername(row.username) ===
                    normalizeLeaderboardUsername(currentUsername))

              return (
                <tr
                  key={`${row.user_id}-${rank}`}
                  className={
                    isCurrentUser
                      ? 'bg-gradient-to-r from-[#F1ECFF] to-[#E9FFFC]'
                      : 'bg-white'
                  }
                >
                  <td className="px-1.5 py-3 sm:px-3">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <RankBadge rank={rank} />
                      {showMovement ? (
                        <MovementBadge
                          movement={(row as WeeklyDisplayRow).movement}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="truncate px-1.5 py-3 font-bold sm:px-3">
                    {row.username}
                  </td>
                  <td className="hidden px-3 py-3 font-semibold text-[#555B7A] md:table-cell">
                    {row.favorite_club ?? 'Not selected'}
                  </td>
                  <td className="px-1.5 py-3 text-right text-sm font-extrabold text-[#FF2D9A] sm:px-3 sm:text-lg">
                    {getPoints(row)}
                  </td>
                  <td className="px-1.5 py-3 text-right sm:px-3">
                    <StatBadge value={row.exact_count} tone="gold" />
                  </td>
                  <td className="px-1.5 py-3 text-right sm:px-3">
                    <StatBadge value={row.great_count} tone="green" />
                  </td>
                  <td className="px-1.5 py-3 text-right sm:px-3">
                    <StatBadge value={row.close_count} tone="blue" />
                  </td>
                  <td className="hidden px-3 py-3 text-right font-semibold sm:table-cell">
                    {row.scored_predictions}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const rankTone =
    rank === 1
      ? 'border-transparent bg-gradient-to-br from-[#FF2D9A] to-[#5B3FFF] text-white'
      : rank === 2
        ? 'border-[#DCD5FF] bg-[#F1ECFF] text-[#5B3FFF]'
        : rank === 3
          ? 'border-[#18D6C9]/45 bg-[#E9FFFC] text-[#2F6BFF]'
          : 'border-[#DCD5FF] bg-white text-[#12163F]'

  return (
    <span
      className={`inline-flex h-7 min-w-8 items-center justify-center gap-1 rounded-full border px-1.5 text-xs font-bold sm:h-8 sm:min-w-10 sm:px-2 sm:text-sm ${rankTone}`}
    >
      {rank <= 3 ? <Medal className="hidden h-4 w-4 sm:block" /> : null}
      {rank}
    </span>
  )
}

function MovementBadge({ movement }: { movement?: RankMovementRow }) {
  if (!movement || movement.previous_rank === null) {
    return (
      <span className="rounded-full bg-[#E9FFFC] px-1.5 py-1 text-[10px] font-bold text-[#2F6BFF] sm:px-2 sm:text-xs">
        New
      </span>
    )
  }

  if (!movement.rank_change) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F1ECFF] px-1.5 py-1 text-[10px] font-bold text-[#555B7A] sm:px-2 sm:text-xs">
        <Minus className="h-3 w-3" />
      </span>
    )
  }

  if (movement.rank_change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#E4FAF3] px-1.5 py-1 text-[10px] font-bold text-[#146b59] sm:gap-1 sm:px-2 sm:text-xs">
        <ArrowUp className="h-3 w-3" />
        {movement.rank_change}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FDE7E7] px-1.5 py-1 text-[10px] font-bold text-[#8a2626] sm:gap-1 sm:px-2 sm:text-xs">
      <ArrowDown className="h-3 w-3" />
      {Math.abs(movement.rank_change)}
    </span>
  )
}

function StatBadge({
  value,
  tone,
}: {
  value: number
  tone: 'gold' | 'green' | 'blue'
}) {
  const colors = {
    gold: 'bg-[#FFF4CC] text-[#12163F]',
    green: 'bg-[#E9FFFC] text-[#12163F]',
    blue: 'bg-[#F1ECFF] text-[#5B3FFF]',
  }

  return (
    <span
      className={`inline-flex min-w-6 justify-center rounded-full px-1.5 py-1 text-[10px] font-bold sm:min-w-8 sm:px-2 sm:text-xs ${colors[tone]}`}
    >
      {value}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#DCD5FF] bg-white p-5 text-center text-sm font-semibold text-[#555B7A]">
      {message}
    </div>
  )
}
