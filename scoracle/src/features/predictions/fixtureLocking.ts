import type { Fixture } from '../../data/homeData'

export function getPredictionDraftKey(fixture: Fixture) {
  return fixture.dbId ?? `provider:${fixture.providerFixtureId ?? fixture.id}`
}

export function getFixtureLockInfo(fixture: Fixture) {
  if (fixture.homeScore !== null && fixture.awayScore !== null) {
    return { isLocked: true, lockAt: new Date(fixture.kickoffUtc) }
  }

  const kickoffAt = new Date(fixture.kickoffUtc).getTime()
  const lockAt = new Date(kickoffAt)

  return {
    isLocked: Date.now() >= lockAt.getTime(),
    lockAt,
  }
}

export function getPredictionGroupLockInfo(
  fixtures: Fixture[],
  lockInfoByFixtureId: Map<string, { isLocked: boolean; lockAt: Date | null }>,
) {
  if (fixtures.length === 0) {
    return {
      allLocked: true,
      hasLockedFixtures: true,
    }
  }

  const lockStates = fixtures.map(
    (fixture) => lockInfoByFixtureId.get(fixture.id)?.isLocked ?? true,
  )

  return {
    allLocked: lockStates.every(Boolean),
    hasLockedFixtures: lockStates.some(Boolean),
  }
}

export function getDefaultPredictionMatchweek(fixtures: Fixture[]) {
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
      const earliestFixtureLockAt = Math.min(
        ...weekFixtures.map(
          (fixture) => new Date(fixture.kickoffUtc).getTime(),
        ),
      )

      return { matchweek, firstKickoff, earliestFixtureLockAt }
    })
    .sort((first, second) => first.firstKickoff - second.firstKickoff)

  const now = Date.now()
  const nextUnlocked = weeks.find((week) => now < week.earliestFixtureLockAt)

  if (nextUnlocked) {
    return nextUnlocked.matchweek
  }

  const nextNotStarted = weeks.find((week) => now < week.firstKickoff)

  if (nextNotStarted) {
    return nextNotStarted.matchweek
  }

  return weeks.at(-1)?.matchweek ?? 1
}
