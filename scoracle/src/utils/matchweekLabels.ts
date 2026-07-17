export const PRESEASON_MATCHWEEK = 0

export function isPreseasonMatchweek(matchweek: number) {
  return matchweek === PRESEASON_MATCHWEEK
}

export function formatMatchweekLabel(matchweek: number) {
  return isPreseasonMatchweek(matchweek)
    ? 'Pre-season'
    : `Match week ${matchweek}`
}

export function formatCompactMatchweekLabel(matchweek: number) {
  return isPreseasonMatchweek(matchweek) ? 'Pre-season' : `MW ${matchweek}`
}

export function formatDropdownMatchweekLabel(matchweek: number) {
  return isPreseasonMatchweek(matchweek) ? 'PS' : `MW ${matchweek}`
}

export function formatRoundLabel(matchweek: number) {
  return isPreseasonMatchweek(matchweek) ? 'Pre-season' : `MW ${matchweek}`
}
