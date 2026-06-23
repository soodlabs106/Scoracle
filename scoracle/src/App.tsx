import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Clock3,
  Goal,
  LockKeyhole,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react'
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal'
import { LoginModal } from './components/auth/LoginModal'
import { SignupModal } from './components/auth/SignupModal'
import { Header } from './components/layout/Header'
import {
  FilterDropdown,
  type FilterDropdownOption,
} from './components/ui/FilterDropdown'
import { useAuth } from './context/useAuth'
import {
  fetchHomeData,
  mockHomeData,
  type Fixture,
  type HomeData,
  type Leader,
  type Team,
} from './data/homeData'
import {
  applyPredictionSimulationToHomeData,
  fetchSimulatedPredictionsForFixtures,
} from './data/predictionSimulation'
import { supabase } from './lib/supabaseClient'
import type { PredictionDraft, PredictionRow } from './types/predictions'
import {
  getPredictionCloseness,
  getPredictionClosenessDisplay,
  getPredictionPoints,
  type PredictionCloseness,
} from './utils/predictionScoring'

const IST_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  month: 'long',
  year: 'numeric',
})

type ModalKind = 'login' | 'signup' | 'forgot' | null
type PredictionMessageTone = 'error' | 'success' | 'info'

function App() {
  const { profile, user } = useAuth()
  const [homeData, setHomeData] = useState<HomeData>(mockHomeData)
  const [isLoading, setIsLoading] = useState(true)
  const [dataNotice, setDataNotice] = useState('Loading live home data')
  const [selectedClubId, setSelectedClubId] = useState('all')
  const [selectedMatchweek, setSelectedMatchweek] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [isClubMenuOpen, setIsClubMenuOpen] = useState(false)
  const [isMatchweekMenuOpen, setIsMatchweekMenuOpen] = useState(false)
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false)
  const [isPredictionMatchweekMenuOpen, setIsPredictionMatchweekMenuOpen] =
    useState(false)
  const [isMobileStandingsOpen, setIsMobileStandingsOpen] = useState(false)
  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [selectedPredictionMatchweek, setSelectedPredictionMatchweek] =
    useState('')
  const [predictionsByFixtureId, setPredictionsByFixtureId] = useState<
    Map<string, PredictionRow>
  >(new Map())
  const [predictionDrafts, setPredictionDrafts] = useState<
    Record<string, PredictionDraft>
  >({})
  const [dirtyFixtureIds, setDirtyFixtureIds] = useState<Set<string>>(new Set())
  const [isPredictionsLoading, setIsPredictionsLoading] = useState(false)
  const [isSavingPredictions, setIsSavingPredictions] = useState(false)
  const [deletingPredictionId, setDeletingPredictionId] = useState<string | null>(
    null,
  )
  const [predictionMessage, setPredictionMessage] = useState<{
    tone: PredictionMessageTone
    text: string
  } | null>(null)

  const teamsById = useMemo(
    () => new Map(homeData.teams.map((team) => [team.id, team])),
    [homeData.teams],
  )

  const selectedClub = teamsById.get(selectedClubId)

  const matchweeks = useMemo(
    () =>
      Array.from(new Set(homeData.fixtures.map((fixture) => fixture.matchweek)))
        .filter(Boolean)
        .sort((a, b) => a - b),
    [homeData.fixtures],
  )

  const months = useMemo(
    () =>
      Array.from(
        new Set(
          homeData.fixtures.map((fixture) =>
            getFixtureMonthKey(fixture.kickoffUtc),
          ),
        ),
      ).sort(),
    [homeData.fixtures],
  )

  const filteredFixtures = useMemo(
    () =>
      homeData.fixtures
        .filter((fixture) => {
          const clubMatches =
            selectedClubId === 'all' ||
            fixture.homeTeamId === selectedClubId ||
            fixture.awayTeamId === selectedClubId
          const matchweekMatches =
            selectedMatchweek === 'all' ||
            fixture.matchweek.toString() === selectedMatchweek
          const monthMatches =
            selectedMonth === 'all' ||
            getFixtureMonthKey(fixture.kickoffUtc) === selectedMonth

          return clubMatches && matchweekMatches && monthMatches
        })
        .sort(
          (first, second) =>
            new Date(first.kickoffUtc).getTime() -
            new Date(second.kickoffUtc).getTime(),
        ),
    [homeData.fixtures, selectedClubId, selectedMatchweek, selectedMonth],
  )

  const isPredictionMode = Boolean(profile && user)
  const defaultPredictionMatchweek = useMemo(
    () => getDefaultPredictionMatchweek(homeData.fixtures),
    [homeData.fixtures],
  )
  const activePredictionMatchweek =
    selectedPredictionMatchweek || defaultPredictionMatchweek.toString()
  const predictionMatchweekNumber = Number(activePredictionMatchweek)
  const predictionFixtures = useMemo(
    () =>
      homeData.fixtures
        .filter((fixture) => fixture.matchweek === predictionMatchweekNumber)
        .sort(
          (first, second) =>
            new Date(first.kickoffUtc).getTime() -
            new Date(second.kickoffUtc).getTime(),
        ),
    [homeData.fixtures, predictionMatchweekNumber],
  )
  const predictionLockInfo = useMemo(
    () => getMatchweekLockInfo(predictionFixtures),
    [predictionFixtures],
  )

  const scopedLeaderboards = useMemo(
    () => ({
      scorers: scopeLeaders(homeData.leaderboards.scorers, selectedClubId),
      assists: scopeLeaders(homeData.leaderboards.assists, selectedClubId),
      cleanSheets: scopeLeaders(
        homeData.leaderboards.cleanSheets,
        selectedClubId,
      ),
    }),
    [homeData.leaderboards, selectedClubId],
  )

  useEffect(() => {
    let isMounted = true

    fetchHomeData()
      .then((data) => applyPredictionSimulationToHomeData(data))
      .then((data) => {
        if (!isMounted) {
          return
        }

        setHomeData(data)
        setDataNotice(
          data.sources.includes('Local prediction simulation')
            ? 'Local prediction simulation loaded'
            : 'Live provider data loaded',
        )
      })
      .catch(async () => {
        if (!isMounted) {
          return
        }

        const simulatedMockHomeData =
          await applyPredictionSimulationToHomeData(mockHomeData)
        setHomeData(simulatedMockHomeData)
        setDataNotice(
          simulatedMockHomeData.sources.includes('Local prediction simulation')
            ? 'Local prediction simulation loaded'
            : 'Using local fallback data until the backend is running',
        )
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!user || !activePredictionMatchweek) {
      return
    }

    let isMounted = true
    const currentUser = user

    async function loadPredictions() {
      setIsPredictionsLoading(true)
      setPredictionMessage(null)

      try {
        const simulatedPredictions = await fetchSimulatedPredictionsForFixtures(
          currentUser.id,
          predictionFixtures,
        )

        if (simulatedPredictions) {
          if (!isMounted) {
            return
          }

          const nextPredictions = new Map(
            simulatedPredictions.map((prediction) => [
              prediction.fixture_id,
              prediction,
            ]),
          )
          const nextDrafts: Record<string, PredictionDraft> = {}

          for (const fixture of predictionFixtures) {
            const draftKey = getPredictionDraftKey(fixture)
            const prediction = fixture.dbId
              ? nextPredictions.get(fixture.dbId)
              : undefined
            nextDrafts[draftKey] = prediction
              ? {
                  home: prediction.predicted_home_score.toString(),
                  away: prediction.predicted_away_score.toString(),
                }
              : { home: '', away: '' }
          }

          setPredictionsByFixtureId(nextPredictions)
          setPredictionDrafts(nextDrafts)
          setDirtyFixtureIds(new Set())
          return
        }

        await supabase.rpc('score_my_predictions_for_completed_fixtures')

        const { data, error } = await supabase
          .from('predictions')
          .select(
            'id, user_id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at, updated_at',
          )
          .eq('user_id', currentUser.id)
          .eq('match_week', Number(activePredictionMatchweek))

        if (error) {
          throw error
        }

        if (!isMounted) {
          return
        }

        const predictionRows = (data ?? []) as PredictionRow[]
        const nextPredictions = new Map(
          predictionRows.map((prediction) => [
            prediction.fixture_id,
            prediction,
          ]),
        )
        const nextDrafts: Record<string, PredictionDraft> = {}

        for (const fixture of predictionFixtures) {
          const draftKey = getPredictionDraftKey(fixture)
          const prediction = fixture.dbId
            ? nextPredictions.get(fixture.dbId)
            : undefined
          nextDrafts[draftKey] = prediction
            ? {
                home: prediction.predicted_home_score.toString(),
                away: prediction.predicted_away_score.toString(),
              }
            : { home: '', away: '' }
        }

        setPredictionsByFixtureId(nextPredictions)
        setPredictionDrafts(nextDrafts)
        setDirtyFixtureIds(new Set())
      } catch (error) {
        if (isMounted) {
          setPredictionMessage({
            tone: 'error',
            text:
              error instanceof Error
                ? error.message
                : 'Could not load predictions.',
          })
        }
      } finally {
        if (isMounted) {
          setIsPredictionsLoading(false)
        }
      }
    }

    loadPredictions()

    return () => {
      isMounted = false
    }
  }, [activePredictionMatchweek, predictionFixtures, user])

  function updatePredictionDraft(
    fixtureKey: string,
    side: keyof PredictionDraft,
    value: string,
  ) {
    const nextValue = value.replace(/\D/g, '').slice(0, 2)

    setPredictionDrafts((current) => ({
      ...current,
      [fixtureKey]: {
        home: current[fixtureKey]?.home ?? '',
        away: current[fixtureKey]?.away ?? '',
        [side]: nextValue,
      },
    }))
    setDirtyFixtureIds((current) => {
      const next = new Set(current)
      next.add(fixtureKey)
      return next
    })
  }

  async function savePredictions() {
    if (!user) {
      setPredictionMessage({
        tone: 'error',
        text: 'Log in before saving predictions.',
      })
      return
    }

    if (predictionLockInfo.isLocked) {
      setPredictionMessage({
        tone: 'error',
        text: 'Predictions locked for this match week.',
      })
      return
    }

    let fixturesForSave = predictionFixtures
    const hasUnsyncedDirtyFixture = fixturesForSave.some(
      (fixture) =>
        !fixture.dbId && dirtyFixtureIds.has(getPredictionDraftKey(fixture)),
    )

    if (hasUnsyncedDirtyFixture) {
      setPredictionMessage({
        tone: 'info',
        text: 'Refreshing fixture sync before saving...',
      })

      try {
        const freshHomeData = await fetchHomeData()
        setHomeData(freshHomeData)
        fixturesForSave = freshHomeData.fixtures.filter(
          (fixture) => fixture.matchweek === predictionMatchweekNumber,
        )
      } catch {
        setPredictionMessage({
          tone: 'error',
          text: 'Fixture sync is still loading. Try again in a moment.',
        })
        return
      }
    }

    const changedFixtures = fixturesForSave.filter(
      (fixture) => dirtyFixtureIds.has(getPredictionDraftKey(fixture)),
    )

    if (changedFixtures.length === 0) {
      setPredictionMessage({
        tone: 'info',
        text: 'No prediction changes to save.',
      })
      return
    }

    const rows = []

    for (const fixture of changedFixtures) {
      if (!fixture.dbId) {
        setPredictionMessage({
          tone: 'error',
          text: 'Fixture sync is still loading. Try again in a moment.',
        })
        return
      }

      const draft = predictionDrafts[getPredictionDraftKey(fixture)]

      if (!draft?.home || !draft.away) {
        setPredictionMessage({
          tone: 'error',
          text: 'Add both home and away scores before saving.',
        })
        return
      }

      const predictedHome = Number(draft.home)
      const predictedAway = Number(draft.away)

      if (
        !Number.isInteger(predictedHome) ||
        !Number.isInteger(predictedAway) ||
        predictedHome < 0 ||
        predictedHome > 99 ||
        predictedAway < 0 ||
        predictedAway > 99
      ) {
        setPredictionMessage({
          tone: 'error',
          text: 'Scores must be whole numbers from 0 to 99.',
        })
        return
      }

      const closeness = getPredictionCloseness(
        predictedHome,
        predictedAway,
        fixture.homeScore,
        fixture.awayScore,
      )

      rows.push({
        user_id: user.id,
        fixture_id: fixture.dbId,
        match_week: fixture.matchweek,
        predicted_home_score: predictedHome,
        predicted_away_score: predictedAway,
        closeness,
        points: getPredictionPoints(closeness),
        is_locked: false,
      })
    }

    setIsSavingPredictions(true)
    setPredictionMessage(null)

    try {
      const { data, error } = await supabase
        .from('predictions')
        .upsert(rows, { onConflict: 'user_id,fixture_id' })
        .select(
          'id, user_id, fixture_id, match_week, predicted_home_score, predicted_away_score, closeness, points, is_locked, created_at, updated_at',
        )

      if (error) {
        throw error
      }

      const savedPredictions = (data ?? []) as PredictionRow[]
      setPredictionsByFixtureId((current) => {
        const next = new Map(current)

        for (const prediction of savedPredictions) {
          next.set(prediction.fixture_id, prediction)
        }

        return next
      })
      setDirtyFixtureIds(new Set())
      setPredictionMessage({
        tone: 'success',
        text: 'Predictions saved.',
      })
    } catch (error) {
      setPredictionMessage({
        tone: 'error',
        text:
          error instanceof Error ? error.message : 'Could not save predictions.',
      })
    } finally {
      setIsSavingPredictions(false)
    }
  }

  async function deletePrediction(fixture: Fixture, prediction?: PredictionRow) {
    if (!prediction) {
      return
    }

    if (predictionLockInfo.isLocked) {
      setPredictionMessage({
        tone: 'error',
        text: 'Predictions locked for this match week.',
      })
      return
    }

    setDeletingPredictionId(prediction.id)
    setPredictionMessage(null)

    try {
      const { error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', prediction.id)

      if (error) {
        throw error
      }

      const draftKey = getPredictionDraftKey(fixture)
      setPredictionsByFixtureId((current) => {
        const next = new Map(current)
        next.delete(prediction.fixture_id)
        return next
      })
      setPredictionDrafts((current) => ({
        ...current,
        [draftKey]: { home: '', away: '' },
      }))
      setDirtyFixtureIds((current) => {
        const next = new Set(current)
        next.delete(draftKey)
        return next
      })
      setPredictionMessage({
        tone: 'success',
        text: 'Prediction deleted.',
      })
    } catch (error) {
      setPredictionMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Could not delete prediction.',
      })
    } finally {
      setDeletingPredictionId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#F9F9F9] text-[#333333]">
      <Header
        onLogin={() => setModalKind('login')}
        onSignup={() => setModalKind('signup')}
      />

      <section className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(330px,0.95fr)_minmax(460px,1.55fr)_minmax(230px,0.65fr)] lg:px-8">
        <section className="rounded-lg border border-[#DADADA] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)] lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileStandingsOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={isMobileStandingsOpen}
          >
            <span className="inline-flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-5 w-5 text-[#3CC8A5]" />
              Premier League Table
            </span>
            <span className="rounded-full bg-[#E8F4FA] px-3 py-1 text-xs font-bold uppercase text-[#03718a]">
              {isMobileStandingsOpen ? 'Hide' : 'Show'}
            </span>
          </button>
          {isMobileStandingsOpen ? (
            <div className="mt-4">
              <StandingsTable
                standings={homeData.standings}
                teamsById={teamsById}
              />
            </div>
          ) : null}
        </section>

        <aside className="hidden rounded-lg border border-[#DADADA] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)] lg:block">
          <SectionTitle icon={<Trophy className="h-5 w-5" />} title="Table" />
          <StandingsTable standings={homeData.standings} teamsById={teamsById} />
        </aside>

        <section className="flex min-h-0 flex-col gap-4 self-start lg:sticky lg:top-5 lg:max-h-[calc(100vh-40px)]">
          <div className="shrink-0 rounded-lg border border-[#DADADA] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionTitle
                  icon={<CalendarDays className="h-5 w-5" />}
                  title={isPredictionMode ? 'Predictions' : 'Fixtures'}
                />
                <p className="mt-1 text-sm text-[#5f6664]">
                  {isPredictionMode
                    ? 'Enter score predictions for the selected match week.'
                    : 'Ordered by kickoff. All times shown in IST.'}
                </p>
              </div>
              <DataStatusIndicator isLoading={isLoading} label={dataNotice} />
            </div>

            {isPredictionMode ? (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2">
                <FilterDropdown
                  label="Match week"
                  selectedValue={activePredictionMatchweek}
                  selectedLabel={`Match week ${activePredictionMatchweek}`}
                  isOpen={isPredictionMatchweekMenuOpen}
                  options={matchweeks.map((matchweek) => ({
                    value: matchweek.toString(),
                    label: `Match week ${matchweek}`,
                  }))}
                  onOpenChange={(nextIsOpen) => {
                    setIsPredictionMatchweekMenuOpen(nextIsOpen)
                    if (nextIsOpen) {
                      setIsClubMenuOpen(false)
                      setIsMatchweekMenuOpen(false)
                      setIsMonthMenuOpen(false)
                    }
                  }}
                  onSelect={(value) => {
                    setSelectedPredictionMatchweek(value)
                  }}
                />
                <span
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${
                    predictionLockInfo.isLocked
                      ? 'border-[#F45B5B] bg-[#F45B5B]/10 text-[#8a2626]'
                      : 'border-[#3CC8A5] bg-[#3CC8A5]/10 text-[#146b59]'
                  }`}
                >
                  <LockKeyhole className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {predictionLockInfo.isLocked ? 'Locked' : 'Open'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={savePredictions}
                  disabled={
                    isSavingPredictions ||
                    isPredictionsLoading ||
                    predictionLockInfo.isLocked
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#3CC8A5] px-3 text-sm font-semibold text-white transition hover:bg-[#F45B5B] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isSavingPredictions ? 'Saving...' : 'Save Predictions'}
                  </span>
                  <span className="sm:hidden">
                    {isSavingPredictions ? '...' : 'Save'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-[minmax(0,1.2fr)_minmax(88px,0.8fr)_minmax(88px,0.8fr)] items-end gap-2">
                <ClubFilter
                  teams={homeData.teams}
                  selectedClubId={selectedClubId}
                  isOpen={isClubMenuOpen}
                  onOpenChange={(nextIsOpen) => {
                    setIsClubMenuOpen(nextIsOpen)
                    if (nextIsOpen) {
                      setIsMatchweekMenuOpen(false)
                      setIsMonthMenuOpen(false)
                      setIsPredictionMatchweekMenuOpen(false)
                    }
                  }}
                  onSelect={(teamId) => {
                    setSelectedClubId(teamId)
                  }}
                />
                <FilterDropdown
                  label="MW"
                  selectedValue={selectedMatchweek}
                  selectedLabel={
                    selectedMatchweek === 'all' ? 'All' : `MW ${selectedMatchweek}`
                  }
                  isOpen={isMatchweekMenuOpen}
                  options={[
                    { value: 'all', label: 'All' },
                    ...matchweeks.map((matchweek) => ({
                      value: matchweek.toString(),
                      label: `MW ${matchweek}`,
                    })),
                  ]}
                  onOpenChange={(nextIsOpen) => {
                    setIsMatchweekMenuOpen(nextIsOpen)
                    if (nextIsOpen) {
                      setIsClubMenuOpen(false)
                      setIsMonthMenuOpen(false)
                      setIsPredictionMatchweekMenuOpen(false)
                    }
                  }}
                  onSelect={(value) => {
                    setSelectedMatchweek(value)
                  }}
                />
                <FilterDropdown
                  label="Month"
                  selectedValue={selectedMonth}
                  selectedLabel={
                    selectedMonth === 'all' ? 'All' : formatMonth(selectedMonth)
                  }
                  isOpen={isMonthMenuOpen}
                  options={[
                    { value: 'all', label: 'All' },
                    ...months.map((month) => ({
                      value: month,
                      label: formatMonth(month),
                    })),
                  ]}
                  onOpenChange={(nextIsOpen) => {
                    setIsMonthMenuOpen(nextIsOpen)
                    if (nextIsOpen) {
                      setIsClubMenuOpen(false)
                      setIsMatchweekMenuOpen(false)
                      setIsPredictionMatchweekMenuOpen(false)
                    }
                  }}
                  onSelect={(value) => {
                    setSelectedMonth(value)
                  }}
                />
              </div>
            )}

            {predictionMessage ? (
              <p
                className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  predictionMessage.tone === 'success'
                    ? 'border-[#3CC8A5] bg-[#3CC8A5]/10 text-[#146b59]'
                    : predictionMessage.tone === 'info'
                      ? 'border-[#4DB7E8] bg-[#E8F4FA] text-[#333333]'
                      : 'border-[#F45B5B] bg-[#F45B5B]/10 text-[#8a2626]'
                }`}
              >
                {predictionMessage.text}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 lg:overflow-y-auto lg:pr-2">
            {isPredictionsLoading ? (
              <EmptyState message="Loading your saved predictions..." />
            ) : (isPredictionMode ? predictionFixtures : filteredFixtures)
                .length > 0 ? (
              (isPredictionMode ? predictionFixtures : filteredFixtures).map((fixture) => {
                const draftKey = getPredictionDraftKey(fixture)

                return (
                  <FixtureCard
                    key={fixture.id}
                    fixture={fixture}
                    teamsById={teamsById}
                    predictionMode={isPredictionMode}
                    prediction={
                      fixture.dbId
                        ? predictionsByFixtureId.get(fixture.dbId)
                        : undefined
                    }
                    draft={predictionDrafts[draftKey]}
                    isMatchweekLocked={predictionLockInfo.isLocked}
                    deletingPredictionId={deletingPredictionId}
                    onPredictionChange={(side, value) =>
                      updatePredictionDraft(draftKey, side, value)
                    }
                    onDeletePrediction={(prediction) =>
                      deletePrediction(fixture, prediction)
                    }
                  />
                )
              })
            ) : (
              <EmptyState message="No fixtures match these filters." />
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <LeaderboardCard
            title={leaderTitle('Top Scorer', selectedClub)}
            label="Goals"
            icon={<Goal className="h-5 w-5" />}
            leaders={scopedLeaderboards.scorers}
            teamsById={teamsById}
          />
          <LeaderboardCard
            title={leaderTitle('Most Assists', selectedClub)}
            label="Assists"
            icon={<UserRound className="h-5 w-5" />}
            leaders={scopedLeaderboards.assists}
            teamsById={teamsById}
          />
          <LeaderboardCard
            title={leaderTitle('Clean Sheets', selectedClub)}
            label="Clean sheets"
            icon={<ShieldCheck className="h-5 w-5" />}
            leaders={scopedLeaderboards.cleanSheets}
            teamsById={teamsById}
          />
        </aside>
      </section>

      {modalKind === 'login' ? (
        <LoginModal
          onClose={() => setModalKind(null)}
          onSwitchToSignup={() => setModalKind('signup')}
          onForgotPassword={() => setModalKind('forgot')}
        />
      ) : null}
      {modalKind === 'signup' ? (
        <SignupModal
          onClose={() => setModalKind(null)}
          onSwitchToLogin={() => setModalKind('login')}
        />
      ) : null}
      {modalKind === 'forgot' ? (
        <ForgotPasswordModal
          onClose={() => setModalKind(null)}
          onSwitchToLogin={() => setModalKind('login')}
        />
      ) : null}
    </main>
  )
}

function SectionTitle({
  icon,
  title,
}: {
  icon: ReactNode
  title: string
}) {
  return (
    <div className="flex items-center gap-2 text-left">
      <span className="text-[#3CC8A5]">{icon}</span>
      <h2 className="text-xl font-semibold text-[#333333]">{title}</h2>
    </div>
  )
}

function DataStatusIndicator({
  isLoading,
  label,
}: {
  isLoading: boolean
  label: string
}) {
  const statusLabel = isLoading ? 'Loading live provider data' : label

  return (
    <span
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#EEDFA3] bg-[#FFF4CC] text-base shadow-sm"
      aria-label={statusLabel}
      title={statusLabel}
      role="status"
    >
      <span className={isLoading ? 'animate-spin' : ''} aria-hidden="true">
        ⚽
      </span>
      {!isLoading ? (
        <span
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#3CC8A5] text-[10px] font-black text-white"
          aria-hidden="true"
        >
          ✓
        </span>
      ) : null}
    </span>
  )
}

function ClubFilter({
  teams,
  selectedClubId,
  isOpen,
  onOpenChange,
  onSelect,
}: {
  teams: Team[]
  selectedClubId: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (teamId: string) => void
}) {
  const selectedTeam = teams.find((team) => team.id === selectedClubId)
  const options: FilterDropdownOption[] = [
    { value: 'all', label: 'All clubs' },
    ...teams.map((team) => ({ value: team.id, label: team.name })),
  ]

  return (
    <FilterDropdown
      label="Club"
      selectedValue={selectedClubId}
      selectedLabel={selectedTeam?.name ?? 'All'}
      options={options}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onSelect={onSelect}
      renderSelected={() => (
        <span className="flex min-w-0 items-center gap-2">
          <TeamBadge team={selectedTeam} />
          <span className="truncate">{selectedTeam?.name ?? 'All'}</span>
        </span>
      )}
      renderOption={(option) => {
        const team =
          option.value === 'all'
            ? undefined
            : teams.find((candidate) => candidate.id === option.value)

        return (
          <span className="flex min-w-0 items-center gap-2">
            <TeamBadge team={team} />
            <span className="truncate">{option.label}</span>
          </span>
        )
      }}
    />
  )
}

function StandingsTable({
  standings,
  teamsById,
}: {
  standings: HomeData['standings']
  teamsById: Map<string, Team>
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-[#DADADA]">
      <table className="w-full table-fixed text-left text-xs">
        <thead className="bg-[#E8F4FA] text-[#333333]">
          <tr>
            <th className="w-8 px-2 py-2 font-semibold">#</th>
            <th className="px-2 py-2 font-semibold">Club</th>
            <th className="w-8 px-1 py-2 text-center font-semibold">P</th>
            <th className="w-8 px-1 py-2 text-center font-semibold">W</th>
            <th className="w-8 px-1 py-2 text-center font-semibold">D</th>
            <th className="w-8 px-1 py-2 text-center font-semibold">L</th>
            <th className="w-9 px-1 py-2 text-center font-semibold">GD</th>
            <th className="w-9 px-1 py-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DADADA] bg-white">
          {standings.map((standing) => {
            const team = teamsById.get(standing.teamId)

            return (
              <tr key={standing.teamId}>
                <td className="px-2 py-2 font-semibold text-[#5f6664]">
                  {standing.position}
                </td>
                <td className="min-w-0 px-2 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamBadge team={team} small />
                    <span className="font-semibold leading-tight">
                      {team?.name ?? 'TBC'}
                    </span>
                  </div>
                </td>
                <td className="px-1 py-2 text-center">{standing.played}</td>
                <td className="px-1 py-2 text-center">{standing.won}</td>
                <td className="px-1 py-2 text-center">{standing.drawn}</td>
                <td className="px-1 py-2 text-center">{standing.lost}</td>
                <td className="px-1 py-2 text-center">
                  {standing.goalDifference}
                </td>
                <td className="px-1 py-2 text-center font-bold">
                  {standing.points}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FixtureCard({
  fixture,
  teamsById,
  predictionMode = false,
  prediction,
  draft,
  isMatchweekLocked = false,
  deletingPredictionId,
  onPredictionChange,
  onDeletePrediction,
}: {
  fixture: Fixture
  teamsById: Map<string, Team>
  predictionMode?: boolean
  prediction?: PredictionRow
  draft?: PredictionDraft
  isMatchweekLocked?: boolean
  deletingPredictionId?: string | null
  onPredictionChange?: (side: keyof PredictionDraft, value: string) => void
  onDeletePrediction?: (prediction: PredictionRow) => void
}) {
  const homeTeam = teamsById.get(fixture.homeTeamId)
  const awayTeam = teamsById.get(fixture.awayTeamId)
  const kickoff = formatKickoff(fixture.kickoffUtc)
  const displayPrediction = getFixturePredictionDisplay(fixture, prediction)

  return (
    <article className="overflow-hidden rounded-lg border border-[#DADADA] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div
        className={`relative grid border-l-8 border-[#3CC8A5] xl:grid-cols-[minmax(290px,1.65fr)_minmax(130px,0.72fr)_minmax(170px,0.9fr)] ${
          predictionMode
            ? 'gap-2 p-2.5 sm:p-3 xl:gap-4'
            : 'gap-3 p-3 sm:p-4 xl:gap-4'
        }`}
      >
        <span className="absolute right-3 top-3 z-10 rounded-full bg-[#E8F4FA] px-3 py-1 text-xs font-semibold uppercase text-[#03718a] sm:right-4 sm:top-4">
          MW {fixture.matchweek}
        </span>
        <div className="space-y-3 pr-0 pt-8 xl:pt-1">
          <FixtureTeamRow
            team={homeTeam}
            score={fixture.homeScore}
            isHome
          />
          <div className="text-center text-xs font-bold uppercase text-[#5f6664]">
            vs
          </div>
          <FixtureTeamRow team={awayTeam} score={fixture.awayScore} />
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 ${
              predictionMode ? 'hidden lg:flex' : ''
            }`}
          >
            <p className="text-base font-bold">{kickoff.date}</p>
            <p className="flex items-center gap-1 text-sm text-[#5f6664]">
              <Clock3 className="h-4 w-4" />
              {kickoff.time} IST
            </p>
          </div>
        </div>

        <div
          className={`space-y-3 pt-1 text-sm ${
            predictionMode ? 'hidden lg:block' : 'hidden xl:block'
          }`}
        >
          <Fact label="Venue" value={fixture.venue} />
          <Fact label="Round" value={`MW ${fixture.matchweek}`} />
          <Fact label="Status" value={fixture.status} />
        </div>

        <div
          className={
            predictionMode
              ? 'space-y-2 pt-0 text-sm'
              : 'hidden space-y-3 pt-1 text-sm xl:block'
          }
        >
          {predictionMode ? (
            <div className="mt-0 lg:mt-6">
              <PredictionPanel
                fixture={fixture}
                draft={draft}
                prediction={prediction}
                display={displayPrediction}
                isLocked={isMatchweekLocked}
                isDeleting={deletingPredictionId === prediction?.id}
                onChange={onPredictionChange}
                onDelete={onDeletePrediction}
              />
            </div>
          ) : (
            <>
              <Fact
                label="Scorers"
                value={
                  fixture.scorers.length
                    ? fixture.scorers.join(', ')
                    : 'Available after full-time'
                }
              />
              <Fact
                label="Assists"
                value={
                  fixture.assists.length
                    ? fixture.assists.join(', ')
                    : 'Available after full-time'
                }
              />
            </>
          )}
        </div>
      </div>
    </article>
  )
}

function PredictionPanel({
  fixture,
  draft,
  prediction,
  display,
  isLocked,
  isDeleting,
  onChange,
  onDelete,
}: {
  fixture: Fixture
  draft?: PredictionDraft
  prediction?: PredictionRow
  display: ReturnType<typeof getFixturePredictionDisplay>
  isLocked: boolean
  isDeleting: boolean
  onChange?: (side: keyof PredictionDraft, value: string) => void
  onDelete?: (prediction: PredictionRow) => void
}) {
  const hasActual = fixture.homeScore !== null && fixture.awayScore !== null
  const isSavedNotScored = Boolean(prediction && !hasActual)
  const predictionDisplay = getPredictionClosenessDisplay(display.closeness)

  return (
    <div className="rounded-lg border border-[#DADADA] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-[#5f6664]">
            Your prediction
          </p>
          {prediction && !isLocked ? (
            <button
              type="button"
              onClick={() => onDelete?.(prediction)}
              disabled={isDeleting}
              className="inline-flex items-center justify-center text-[#8a2626] transition hover:text-[#F45B5B] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Delete saved prediction"
              title="Delete saved prediction"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        {isLocked ? (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F45B5B]/10 text-[#8a2626]"
            aria-label="Predictions locked"
            title="Predictions locked"
          >
            <LockKeyhole className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ScoreInput
          label={`${fixture.homeTeamId} home score`}
          value={draft?.home ?? ''}
          disabled={isLocked || !onChange}
          isPendingSaved={isSavedNotScored}
          onChange={(value) => onChange?.('home', value)}
        />
        <span className="font-bold text-[#5f6664]">-</span>
        <ScoreInput
          label={`${fixture.awayTeamId} away score`}
          value={draft?.away ?? ''}
          disabled={isLocked || !onChange}
          isPendingSaved={isSavedNotScored}
          onChange={(value) => onChange?.('away', value)}
        />
        {hasActual ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-white/70 px-2 py-1 text-xs font-bold"
            style={{
              backgroundColor: predictionDisplay.backgroundColor,
              color: predictionDisplay.textColor,
            }}
          >
            {predictionDisplay.label}
            <span>+{display.points}</span>
          </span>
        ) : null}
      </div>

      {/*
        <div
          className="mt-3 rounded-lg border border-white/70 px-3 py-2 text-sm"
          style={{
            backgroundColor: predictionDisplay.backgroundColor,
            color: predictionDisplay.textColor,
          }}
        >
          <p>
            <span className="font-bold">{predictionDisplay.label}</span>
            <span> · +{display.points} pts</span>
          </p>
        </div>
      */}
    </div>
  )
}

function ScoreInput({
  label,
  value,
  disabled,
  isPendingSaved = false,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  isPendingSaved?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        value={value}
        inputMode="numeric"
        maxLength={2}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-14 rounded-lg border bg-white text-center text-base font-bold focus:border-[#3CC8A5] focus:outline-none focus:ring-2 focus:ring-[#3CC8A5]/20 disabled:bg-[#F1F1F1] disabled:text-[#5f6664] ${
          isPendingSaved ? 'border-[#F59E0B]' : 'border-[#DADADA]'
        }`}
      />
    </label>
  )
}

function FixtureTeamRow({
  team,
  score,
  isHome = false,
}: {
  team?: Team
  score: number | null
  isHome?: boolean
}) {
  return (
    <div className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_44px] items-center gap-3 rounded-lg border border-[#DADADA] bg-[#F9F9F9] px-3 py-2">
      <div className="flex min-w-0 items-center gap-3 text-left">
        <TeamBadge team={team} />
        <span className="min-w-0 flex-1 truncate text-left text-base font-semibold leading-snug">
          {team?.name ?? (isHome ? 'Home club' : 'Away club')}
        </span>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#DADADA]/60 text-sm font-bold">
        {score ?? '-'}
      </div>
    </div>
  )
}

function LeaderboardCard({
  title,
  label,
  icon,
  leaders,
  teamsById,
}: {
  title: string
  label: string
  icon: ReactNode
  leaders: Leader[]
  teamsById: Map<string, Team>
}) {
  const topLeader = leaders[0]
  const topTeam = topLeader ? teamsById.get(topLeader.teamId) : undefined

  return (
    <section className="rounded-lg border border-[#DADADA] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <SectionTitle icon={icon} title={title} />

      {topLeader ? (
        <div className="mt-4">
          <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-lg bg-[#E8F4FA] p-3">
            <PlayerPhoto leader={topLeader} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-tight">
                {topLeader.playerName}
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-[#5f6664]">
                <TeamBadge team={topTeam} small />
                <span className="leading-tight">{topTeam?.name ?? 'Club TBC'}</span>
              </div>
            </div>
            <div className="col-span-2 rounded-lg bg-white px-3 py-2 text-center">
              <p className="text-2xl font-bold text-[#F45B5B]">
                {topLeader.value}
              </p>
              <p className="text-xs font-semibold uppercase text-[#5f6664]">
                {label}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {leaders.slice(1, 3).map((leader, index) => {
              const team = teamsById.get(leader.teamId)

              return (
                <div
                  key={leader.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#DADADA] px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 font-bold text-[#3CC8A5]">
                      {index + 2}
                    </span>
                    <TeamBadge team={team} small />
                    <span className="truncate font-semibold">
                      {leader.playerName}
                    </span>
                  </div>
                  <span className="font-bold">{leader.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <EmptyState message="Available after the first verified 2026/27 data sync." />
      )}
    </section>
  )
}

function PlayerPhoto({ leader }: { leader: Leader }) {
  if (leader.photoUrl) {
    return (
      <img
        src={leader.photoUrl}
        alt={leader.playerName}
        className="h-16 w-16 rounded-lg object-cover"
      />
    )
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-[#3CC8A5]">
      <UserRound className="h-8 w-8" />
    </div>
  )
}

function TeamBadge({
  team,
  small = false,
}: {
  team?: Team
  small?: boolean
}) {
  const size = small ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'

  if (team?.crestUrl) {
    return (
      <img
        src={team.crestUrl}
        alt=""
        className={`${size} shrink-0 rounded-full object-contain`}
      />
    )
  }

  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[#3CC8A5]/15 font-bold text-[#02745d]`}
    >
      {team ? initials(team.shortName) : 'PL'}
    </span>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#DADADA] pb-2 last:border-b-0">
      <p className="text-xs font-semibold uppercase text-[#5f6664]">{label}</p>
      <p className="mt-1 font-semibold text-[#333333]">{value}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#DADADA] bg-white p-5 text-center text-sm font-semibold text-[#5f6664]">
      {message}
    </div>
  )
}

function scopeLeaders(leaders: Leader[], selectedClubId: string) {
  if (selectedClubId === 'all') {
    return leaders
  }

  return leaders.filter((leader) => leader.teamId === selectedClubId)
}

function leaderTitle(label: string, selectedClub?: Team) {
  return selectedClub ? `${label}: ${selectedClub.shortName}` : label
}

function getFixturePredictionDisplay(
  fixture: Fixture,
  prediction?: PredictionRow,
) {
  if (!prediction) {
    return {
      closeness: 'NOT_SCORED' as PredictionCloseness,
      points: 0,
      predictionText: '-',
    }
  }

  const closeness =
    prediction.closeness ??
    getPredictionCloseness(
      prediction.predicted_home_score,
      prediction.predicted_away_score,
      fixture.homeScore,
      fixture.awayScore,
    )

  return {
    closeness,
    points: prediction.points ?? getPredictionPoints(closeness),
    predictionText: `${prediction.predicted_home_score} - ${prediction.predicted_away_score}`,
  }
}

function getPredictionDraftKey(fixture: Fixture) {
  return fixture.dbId ?? `provider:${fixture.providerFixtureId ?? fixture.id}`
}

function getMatchweekLockInfo(fixtures: Fixture[]) {
  if (fixtures.length === 0) {
    return { isLocked: true, lockAt: null as Date | null }
  }

  if (
    fixtures.every(
      (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
    )
  ) {
    return { isLocked: true, lockAt: new Date() }
  }

  const firstKickoff = Math.min(
    ...fixtures.map((fixture) => new Date(fixture.kickoffUtc).getTime()),
  )
  const lockAt = new Date(firstKickoff - 24 * 60 * 60 * 1000)

  return {
    isLocked: Date.now() >= lockAt.getTime(),
    lockAt,
  }
}

function getDefaultPredictionMatchweek(fixtures: Fixture[]) {
  const grouped = new Map<number, Fixture[]>()

  for (const fixture of fixtures) {
    grouped.set(fixture.matchweek, [
      ...(grouped.get(fixture.matchweek) ?? []),
      fixture,
    ])
  }

  const weeks = Array.from(grouped.entries())
    .map(([matchweek, weekFixtures]) => {
      const firstKickoff = Math.min(
        ...weekFixtures.map((fixture) => new Date(fixture.kickoffUtc).getTime()),
      )
      const lockAt = firstKickoff - 24 * 60 * 60 * 1000

      return { matchweek, firstKickoff, lockAt }
    })
    .sort((first, second) => first.firstKickoff - second.firstKickoff)

  const now = Date.now()
  const nextUnlocked = weeks.find((week) => now < week.lockAt)

  if (nextUnlocked) {
    return nextUnlocked.matchweek
  }

  const nextNotStarted = weeks.find((week) => now < week.firstKickoff)

  if (nextNotStarted) {
    return nextNotStarted.matchweek
  }

  return weeks.at(-1)?.matchweek ?? 1
}

function formatKickoff(kickoffUtc: string) {
  const parts = Object.fromEntries(
    IST_FORMATTER.formatToParts(new Date(kickoffUtc)).map((part) => [
      part.type,
      part.value,
    ]),
  )

  return {
    date: `${parts.weekday}, ${parts.day} ${parts.month}, ${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

function getFixtureMonthKey(kickoffUtc: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(kickoffUtc))
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const monthLabel = MONTH_FORMATTER.format(
    new Date(Date.UTC(year, month - 1, 1)),
  ).slice(0, 3)
  const yearLabel = year.toString().slice(-2)

  return `${monthLabel} '${yearLabel}`
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
}

export default App
