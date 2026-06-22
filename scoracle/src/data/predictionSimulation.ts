import type { Fixture, HomeData } from './homeData'
import type { PredictionRow } from '../types/predictions'
import {
  getPredictionCloseness,
  getPredictionPoints,
} from '../utils/predictionScoring'

type SimulatedFixtureScore = {
  actualHome: number
  actualAway: number
  predictedHome: number
  predictedAway: number
}

type PredictionSimulation = {
  enabled?: boolean
  userLabel?: string
  matchWeeks: Record<string, SimulatedFixtureScore[]>
}

const LOCAL_SIMULATION_PATH = '/local-prediction-simulation.json'
let simulationPromise: Promise<PredictionSimulation | null> | null = null

export async function applyPredictionSimulationToHomeData(homeData: HomeData) {
  const simulation = await loadPredictionSimulation()

  if (!simulation?.enabled) {
    return homeData
  }

  return {
    ...homeData,
    fixtures: applySimulatedScores(homeData.fixtures, simulation),
    sources: [...homeData.sources, 'Local prediction simulation'],
  }
}

export async function fetchSimulatedPredictionsForFixtures(
  userId: string,
  fixtures: Fixture[],
) {
  const simulation = await loadPredictionSimulation()

  if (!simulation?.enabled) {
    return null
  }

  const now = new Date().toISOString()
  const rows: PredictionRow[] = []

  for (const fixture of sortFixtures(fixtures)) {
    const weekScores = simulation.matchWeeks[String(fixture.matchweek)]

    if (!weekScores) {
      continue
    }

    const fixtureIndex = fixtures
      .filter((candidate) => candidate.matchweek === fixture.matchweek)
      .sort(
        (first, second) =>
          new Date(first.kickoffUtc).getTime() -
          new Date(second.kickoffUtc).getTime(),
      )
      .findIndex((candidate) => candidate.id === fixture.id)
    const score = weekScores[fixtureIndex]

    if (!score || !fixture.dbId) {
      continue
    }

    const closeness = getPredictionCloseness(
      score.predictedHome,
      score.predictedAway,
      score.actualHome,
      score.actualAway,
    )

    rows.push({
      id: `sim-${fixture.dbId}`,
      user_id: userId,
      fixture_id: fixture.dbId,
      match_week: fixture.matchweek,
      predicted_home_score: score.predictedHome,
      predicted_away_score: score.predictedAway,
      closeness,
      points: getPredictionPoints(closeness),
      is_locked: true,
      created_at: now,
      updated_at: now,
    })
  }

  return rows
}

export async function fetchSimulatedPredictionHistory(
  userId: string,
  homeData: HomeData,
) {
  const simulatedHomeData = await applyPredictionSimulationToHomeData(homeData)
  const predictions = await fetchSimulatedPredictionsForFixtures(
    userId,
    simulatedHomeData.fixtures,
  )

  if (!predictions) {
    return null
  }

  const teamsById = new Map(
    simulatedHomeData.teams.map((team) => [team.id, team]),
  )
  const fixturesByDbId = new Map(
    simulatedHomeData.fixtures
      .filter((fixture) => Boolean(fixture.dbId))
      .map((fixture) => [fixture.dbId as string, fixture]),
  )
  const lockByMatchweek = new Map<number, string>()

  for (const fixture of simulatedHomeData.fixtures) {
    const currentLock = lockByMatchweek.get(fixture.matchweek)

    if (
      !currentLock ||
      new Date(fixture.kickoffUtc).getTime() < new Date(currentLock).getTime()
    ) {
      lockByMatchweek.set(fixture.matchweek, fixture.kickoffUtc)
    }
  }

  return predictions
    .map((prediction) => {
      const fixture = fixturesByDbId.get(prediction.fixture_id)

      return {
        prediction,
        fixture,
        homeTeam: fixture ? teamsById.get(fixture.homeTeamId)?.name : undefined,
        awayTeam: fixture ? teamsById.get(fixture.awayTeamId)?.name : undefined,
        homeTeamCode: fixture
          ? teamsById.get(fixture.homeTeamId)?.teamCode
          : undefined,
        awayTeamCode: fixture
          ? teamsById.get(fixture.awayTeamId)?.teamCode
          : undefined,
        homeTeamCrestUrl: fixture
          ? teamsById.get(fixture.homeTeamId)?.crestUrl
          : undefined,
        awayTeamCrestUrl: fixture
          ? teamsById.get(fixture.awayTeamId)?.crestUrl
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
}

export async function isPredictionSimulationEnabled() {
  const simulation = await loadPredictionSimulation()
  return Boolean(simulation?.enabled)
}

async function loadPredictionSimulation() {
  if (!simulationPromise) {
    simulationPromise = fetch(LOCAL_SIMULATION_PATH, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }

        return (await response.json()) as PredictionSimulation
      })
      .catch(() => null)
  }

  return simulationPromise
}

function applySimulatedScores(
  fixtures: Fixture[],
  simulation: PredictionSimulation,
) {
  const fixtureIndexByWeek = new Map<string, number>()

  return sortFixtures(fixtures).map((fixture) => {
    const weekKey = String(fixture.matchweek)
    const weekScores = simulation.matchWeeks[weekKey]
    const currentIndex = fixtureIndexByWeek.get(weekKey) ?? 0
    fixtureIndexByWeek.set(weekKey, currentIndex + 1)
    const score = weekScores?.[currentIndex]

    if (!score) {
      return fixture
    }

    return {
      ...fixture,
      status: 'Full-time',
      homeScore: score.actualHome,
      awayScore: score.actualAway,
    }
  })
}

function sortFixtures(fixtures: Fixture[]) {
  return [...fixtures].sort(
    (first, second) =>
      first.matchweek - second.matchweek ||
      new Date(first.kickoffUtc).getTime() -
        new Date(second.kickoffUtc).getTime(),
  )
}
