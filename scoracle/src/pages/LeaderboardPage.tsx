import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Medal,
  Minus,
  Trophy,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useAuth } from '../context/useAuth'
import {
  fetchMatchWeekLeaderboard,
  fetchOverallLeaderboard,
  fetchRankMovement,
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
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<ActiveTab>('overall')
  const [overallRows, setOverallRows] = useState<LeaderboardRow[]>([])
  const [weeklyRows, setWeeklyRows] = useState<WeeklyDisplayRow[]>([])
  const [rankTimelineRows, setRankTimelineRows] = useState<RankMovementRow[]>([])
  const [scoredMatchWeeks, setScoredMatchWeeks] = useState<number[]>([])
  const [selectedMatchWeek, setSelectedMatchWeek] = useState<number | null>(null)
  const [isOverallLoading, setIsOverallLoading] = useState(false)
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false)
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
        const [overall, weeks] = await Promise.all([
          fetchOverallLeaderboard(),
          fetchScoredMatchWeeks(),
        ])
        const timeline = await Promise.all(
          weeks.map((matchWeek) => fetchRankMovement(matchWeek)),
        )

        if (!isMounted) {
          return
        }

        setOverallRows(overall)
        setScoredMatchWeeks(weeks)
        setRankTimelineRows(timeline.flat())
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
        const [weekly, movement] = await Promise.all([
          fetchMatchWeekLeaderboard(matchWeek),
          fetchRankMovement(matchWeek),
        ])
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
  }, [selectedMatchWeek, user])

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
      <main className="min-h-screen bg-[#F9F9F9] text-[#333333]">
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
    <main className="min-h-screen bg-[#F9F9F9] text-[#333333]">
      <Header onLogin={() => undefined} onSignup={() => undefined} />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E8F4FA] text-[#3CC8A5]">
              <Trophy className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">Leaderboard</h2>
              <p className="text-sm text-[#5f6664]">
                Track weekly points, exact scores, and overall rank.
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

        {error ? (
          <p className="mb-4 rounded-lg border border-[#F45B5B] bg-[#F45B5B]/10 px-3 py-2 text-sm font-semibold text-[#8a2626]">
            {error}
          </p>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[#DADADA] bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-grid grid-cols-2 rounded-lg border border-[#DADADA] bg-[#F9F9F9] p-1">
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
            <label className="grid gap-1 text-left text-xs font-semibold uppercase text-[#5f6664]">
              Match week
              <select
                value={selectedMatchWeek ?? ''}
                onChange={(event) =>
                  setSelectedMatchWeek(Number(event.target.value))
                }
                disabled={scoredMatchWeeks.length === 0}
                className="h-10 min-w-44 rounded-lg border border-[#DADADA] bg-[#F9F9F9] px-3 text-sm font-semibold normal-case text-[#333333] focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20 disabled:opacity-60"
              >
                {scoredMatchWeeks.length === 0 ? (
                  <option value="">No scored weeks</option>
                ) : null}
                {scoredMatchWeeks.map((matchWeek) => (
                  <option key={matchWeek} value={matchWeek}>
                    MW {matchWeek}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {activeTab === 'overall' ? (
          <>
            <RankTimelineChart
              rows={rankTimelineRows}
              users={overallRows}
              matchWeeks={scoredMatchWeeks}
            />
            <UserSummary
              label="Your overall rank"
              row={currentOverallRow}
              rows={overallRows}
              pointsLabel="Pts"
            />
            <LeaderboardTable
              rows={overallRows}
              currentUserId={user.id}
              isLoading={isOverallLoading}
              emptyMessage="No leaderboard yet. Scores will appear after the first match week is completed and predictions are scored."
              pointsHeader="Pts"
              getPoints={(row) => row.total_points}
            />
          </>
        ) : (
          <>
            <RankTimelineChart
              rows={rankTimelineRows}
              users={overallRows}
              matchWeeks={scoredMatchWeeks}
            />
            <UserSummary
              label={`Your MW ${selectedMatchWeek ?? '-'} rank`}
              row={currentWeeklyRow}
              rows={weeklyRows}
              pointsLabel="Weekly pts"
              isWeekly
            />
            <LeaderboardTable
              rows={weeklyRows}
              currentUserId={user.id}
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
  const width = 820
  const height = 320
  const padding = { top: 28, right: 34, bottom: 48, left: 64 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const colors = ['#F45B5B', '#3CC8A5', '#4DB7E8', '#8a5a00', '#5f6664']
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
    <section className="mb-4 rounded-lg border border-[#DADADA] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Rank movement</h3>
          <p className="text-sm text-[#5f6664]">
            Cumulative rank after each completed match week.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {users.map((user, index) => (
            <span
              key={user.user_id}
              className="inline-flex items-center gap-2 rounded-full border border-[#DADADA] px-2 py-1 text-xs font-bold"
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
          className="relative min-w-[820px]"
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
              stroke="#DADADA"
            />
            <line
              x1={padding.left}
              y1={padding.top + plotHeight}
              x2={padding.left + plotWidth}
              y2={padding.top + plotHeight}
              stroke="#DADADA"
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
          ? 'bg-white text-[#333333] shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
          : 'text-[#5f6664] hover:text-[#333333]'
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
    <section className="mb-4 rounded-lg border border-[#3CC8A5]/45 bg-[#3CC8A5]/10 p-4">
      <p className="text-xs font-bold uppercase text-[#02745d]">{label}</p>
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
    <div className="rounded-lg border border-white/70 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-[#5f6664]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#333333]">{value}</p>
    </div>
  )
}

function LeaderboardTable<T extends LeaderboardRow | WeeklyDisplayRow>({
  rows,
  currentUserId,
  isLoading,
  emptyMessage,
  pointsHeader,
  getPoints,
  showMovement = false,
}: {
  rows: T[]
  currentUserId: string
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
    <section className="overflow-hidden rounded-lg border border-[#DADADA] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#E8F4FA] text-xs uppercase text-[#5f6664]">
            <tr>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Favorite club</th>
              <th className="px-3 py-3 text-right">{pointsHeader}</th>
              <th className="px-3 py-3 text-right">Exact</th>
              <th className="px-3 py-3 text-right">Great</th>
              <th className="px-3 py-3 text-right">Close</th>
              <th className="px-3 py-3 text-right">Played</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DADADA]">
            {rows.map((row, index) => {
              const rank = index + 1
              const isCurrentUser = row.user_id === currentUserId

              return (
                <tr
                  key={`${row.user_id}-${rank}`}
                  className={isCurrentUser ? 'bg-[#FFF4CC]/55' : 'bg-white'}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <RankBadge rank={rank} />
                      {showMovement ? (
                        <MovementBadge
                          movement={(row as WeeklyDisplayRow).movement}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-bold">{row.username}</td>
                  <td className="px-3 py-3 font-semibold text-[#5f6664]">
                    {row.favorite_club ?? 'Not selected'}
                  </td>
                  <td className="px-3 py-3 text-right text-lg font-bold text-[#F45B5B]">
                    {getPoints(row)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <StatBadge value={row.exact_count} tone="gold" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <StatBadge value={row.great_count} tone="green" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <StatBadge value={row.close_count} tone="blue" />
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">
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
      ? 'border-[#EEDFA3] bg-[#FFF4CC] text-[#8a5a00]'
      : rank === 2
        ? 'border-[#DADADA] bg-[#F1F1F1] text-[#5f6664]'
        : rank === 3
          ? 'border-[#E4C4A8] bg-[#FFF0DD] text-[#8a4d19]'
          : 'border-[#DADADA] bg-white text-[#333333]'

  return (
    <span
      className={`inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-full border px-2 text-sm font-bold ${rankTone}`}
    >
      {rank <= 3 ? <Medal className="h-4 w-4" /> : null}
      {rank}
    </span>
  )
}

function MovementBadge({ movement }: { movement?: RankMovementRow }) {
  if (!movement || movement.previous_rank === null) {
    return (
      <span className="rounded-full bg-[#E8F4FA] px-2 py-1 text-xs font-bold text-[#03718a]">
        New
      </span>
    )
  }

  if (!movement.rank_change) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F1F1] px-2 py-1 text-xs font-bold text-[#5f6664]">
        <Minus className="h-3 w-3" />
      </span>
    )
  }

  if (movement.rank_change > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E4FAF3] px-2 py-1 text-xs font-bold text-[#146b59]">
        <ArrowUp className="h-3 w-3" />
        {movement.rank_change}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FDE7E7] px-2 py-1 text-xs font-bold text-[#8a2626]">
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
    gold: 'bg-[#FFF4CC] text-[#8a5a00]',
    green: 'bg-[#E4FAF3] text-[#146b59]',
    blue: 'bg-[#E8F4FA] text-[#03718a]',
  }

  return (
    <span
      className={`inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-bold ${colors[tone]}`}
    >
      {value}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#DADADA] bg-white p-5 text-center text-sm font-semibold text-[#5f6664]">
      {message}
    </div>
  )
}
