export type MatchResult = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'

export type PredictionCloseness =
  | 'EXACT'
  | 'GREAT'
  | 'CLOSE'
  | 'NEAR_MISS'
  | 'MISS'
  | 'NOT_SCORED'

export type PredictionClosenessDisplay = {
  label: string
  backgroundColor: string
  textColor: string
}

export function getResult(home: number, away: number): MatchResult {
  if (home > away) {
    return 'HOME_WIN'
  }

  if (home === away) {
    return 'DRAW'
  }

  return 'AWAY_WIN'
}

export function getPredictionCloseness(
  predHome: number,
  predAway: number,
  actualHome: number | null,
  actualAway: number | null,
): PredictionCloseness {
  if (actualHome === null || actualAway === null) {
    return 'NOT_SCORED'
  }

  if (predHome === actualHome && predAway === actualAway) {
    return 'EXACT'
  }

  const predictedResult = getResult(predHome, predAway)
  const actualResult = getResult(actualHome, actualAway)
  const predictedGoalDifference = predHome - predAway
  const actualGoalDifference = actualHome - actualAway

  if (
    predictedResult === actualResult &&
    predictedGoalDifference === actualGoalDifference
  ) {
    return 'GREAT'
  }

  if (predictedResult === actualResult) {
    return 'CLOSE'
  }

  if (Math.abs(predHome - actualHome) + Math.abs(predAway - actualAway) <= 1) {
    return 'NEAR_MISS'
  }

  return 'MISS'
}

export function getPredictionPoints(closeness: PredictionCloseness): number {
  const pointsByCloseness: Record<PredictionCloseness, number> = {
    EXACT: 5,
    GREAT: 3,
    CLOSE: 2,
    NEAR_MISS: 0,
    MISS: 0,
    NOT_SCORED: 0,
  }

  return pointsByCloseness[closeness]
}

export function getPredictionClosenessDisplay(
  closeness: PredictionCloseness,
): PredictionClosenessDisplay {
  const displays: Record<PredictionCloseness, PredictionClosenessDisplay> = {
    EXACT: {
      label: 'Exact',
      backgroundColor: '#FFF4CC',
      textColor: '#6d5600',
    },
    GREAT: {
      label: 'Great call',
      backgroundColor: '#E4FAF3',
      textColor: '#146b59',
    },
    CLOSE: {
      label: 'Close',
      backgroundColor: '#E8F4FA',
      textColor: '#03718a',
    },
    NEAR_MISS: {
      label: 'Near miss',
      backgroundColor: '#FFF0DD',
      textColor: '#8a5200',
    },
    MISS: {
      label: 'Miss',
      backgroundColor: '#FDE7E7',
      textColor: '#8a2626',
    },
    NOT_SCORED: {
      label: 'Not scored',
      backgroundColor: '#F1F1F1',
      textColor: '#5f6664',
    },
  }

  return displays[closeness]
}
