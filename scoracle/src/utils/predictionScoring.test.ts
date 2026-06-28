import { describe, expect, it } from 'vitest'
import {
  getPredictionCloseness,
  getPredictionPoints,
  getResult,
} from './predictionScoring'

describe('prediction scoring', () => {
  it.each([
    [2, 1, 'HOME_WIN'],
    [1, 1, 'DRAW'],
    [0, 2, 'AWAY_WIN'],
  ] as const)('classifies %i-%i as %s', (home, away, expected) => {
    expect(getResult(home, away)).toBe(expected)
  })

  it.each([
    [2, 1, 2, 1, 'EXACT', 5],
    [3, 1, 2, 0, 'GREAT', 3],
    [1, 0, 3, 1, 'CLOSE', 2],
    [1, 1, 2, 1, 'NEAR_MISS', 0],
    [4, 0, 0, 2, 'MISS', 0],
    [1, 0, null, null, 'NOT_SCORED', 0],
  ] as const)(
    'scores %s-%s against %s-%s as %s',
    (predHome, predAway, actualHome, actualAway, closeness, points) => {
      const result = getPredictionCloseness(
        predHome,
        predAway,
        actualHome,
        actualAway,
      )
      expect(result).toBe(closeness)
      expect(getPredictionPoints(result)).toBe(points)
    },
  )
})
