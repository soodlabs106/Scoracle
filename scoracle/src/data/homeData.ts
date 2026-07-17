import { HomeDataSchema } from '../../shared/contracts/homeData'
import { supabase } from '../lib/supabaseClient'

export type Team = {
  id: string
  name: string
  shortName: string
  teamCode: string
  crestUrl?: string
}

export type Standing = {
  teamId: string
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export type Fixture = {
  id: string
  dbId?: string
  providerFixtureId?: string
  matchweek: number
  kickoffUtc: string
  status: string
  venue: string
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
  scorers: string[]
  assists: string[]
  watch?: string
}

export type Leader = {
  id: string
  playerName: string
  teamId: string
  value: number
  photoUrl?: string
  photoVerified: boolean
  source: string
}

export type HomeData = {
  teams: Team[]
  standings: Standing[]
  fixtures: Fixture[]
  leaderboards: {
    scorers: Leader[]
    assists: Leader[]
    cleanSheets: Leader[]
  }
  lastUpdated: string
  sources: string[]
}

export const premierLeagueTeams: Team[] = [
  {
    id: '1',
    name: 'Arsenal',
    shortName: 'Arsenal',
    teamCode: 'ARS',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png',
  },
  {
    id: '2',
    name: 'Aston Villa',
    shortName: 'Aston Villa',
    teamCode: 'AVL',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/jykrpv1717309891.png',
  },
  {
    id: '127',
    name: 'Bournemouth',
    shortName: 'Bournemouth',
    teamCode: 'BOU',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/y08nak1534071116.png',
  },
  {
    id: '130',
    name: 'Brentford',
    shortName: 'Brentford',
    teamCode: 'BRE',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/grv1aw1546453779.png',
  },
  {
    id: '131',
    name: 'Brighton & Hove Albion',
    shortName: 'Brighton',
    teamCode: 'BRI',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/ywypts1448810904.png',
  },
  {
    id: '4',
    name: 'Chelsea',
    shortName: 'Chelsea',
    teamCode: 'CHE',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/yvwvtu1448813215.png',
  },
  {
    id: '5',
    name: 'Coventry City',
    shortName: 'Coventry',
    teamCode: 'COV',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/uxyqys1424033798.png',
  },
  {
    id: '6',
    name: 'Crystal Palace',
    shortName: 'Crystal Palace',
    teamCode: 'CRY',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/ia6i3m1656014992.png',
  },
  {
    id: '7',
    name: 'Everton',
    shortName: 'Everton',
    teamCode: 'EVE',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/eqayrf1523184794.png',
  },
  {
    id: '34',
    name: 'Fulham',
    shortName: 'Fulham',
    teamCode: 'FUL',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/xwwvyt1448811086.png',
  },
  {
    id: '41',
    name: 'Hull City',
    shortName: 'Hull',
    teamCode: 'HUL',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/fbqqda1601726113.png',
  },
  {
    id: '8',
    name: 'Ipswich Town',
    shortName: 'Ipswich',
    teamCode: 'IPS',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/mdj1ey1634670785.png',
  },
  {
    id: '9',
    name: 'Leeds United',
    shortName: 'Leeds',
    teamCode: 'LEE',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/jcgrml1756649030.png',
  },
  {
    id: '10',
    name: 'Liverpool',
    shortName: 'Liverpool',
    teamCode: 'LIV',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png',
  },
  {
    id: '11',
    name: 'Manchester City',
    shortName: 'Man City',
    teamCode: 'MCI',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png',
  },
  {
    id: '12',
    name: 'Manchester United',
    shortName: 'Man Utd',
    teamCode: 'MUN',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
  },
  {
    id: '23',
    name: 'Newcastle United',
    shortName: 'Newcastle',
    teamCode: 'NEW',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/lhwuiz1621593302.png',
  },
  {
    id: '15',
    name: "Nottingham Forest",
    shortName: "Nott'm Forest",
    teamCode: 'NFO',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/1i2kvh1719918076.png',
  },
  {
    id: '29',
    name: 'Sunderland',
    shortName: 'Sunderland',
    teamCode: 'SUN',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/tprtus1448813498.png',
  },
  {
    id: '21',
    name: 'Tottenham Hotspur',
    shortName: 'Spurs',
    teamCode: 'TOT',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/dfyfhl1604094109.png',
  },
]

const preseasonTeams: Team[] = [
  {
    id: '195',
    name: 'Wrexham',
    shortName: 'Wrexham',
    teamCode: 'WRX',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/ezpymt1675092551.png',
  },
  {
    id: '371',
    name: 'Rosenborg',
    shortName: 'Rosenborg',
    teamCode: 'RSB',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/z483ps1764866361.png',
  },
  {
    id: '48',
    name: 'Atletico Madrid',
    shortName: 'Atletico',
    teamCode: 'ATM',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/0ulh3q1719984315.png',
  },
  {
    id: '67',
    name: 'Paris Saint Germain',
    shortName: 'PSG',
    teamCode: 'PSG',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/rwqrrq1473504808.png',
  },
  {
    id: '64',
    name: 'Milan',
    shortName: 'Milan',
    teamCode: 'ACM',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/wvspur1448806617.png',
  },
]

const TEAM_CODE_FALLBACKS = new Map(
  [...premierLeagueTeams, ...preseasonTeams].map((team) => [team.id, team.teamCode]),
)
const TEAM_CREST_FALLBACKS = new Map(
  [...premierLeagueTeams, ...preseasonTeams]
    .filter((team) => Boolean(team.crestUrl))
    .map((team) => [team.id, team.crestUrl as string]),
)
const KNOWN_TEAMS_BY_ID = new Map(
  [...premierLeagueTeams, ...preseasonTeams].map((team) => [team.id, team]),
)

export const mockHomeData: HomeData = {
  teams: [...premierLeagueTeams, ...preseasonTeams].map((team) => ({
    ...team,
    crestUrl: premierLeagueTeams.some((candidate) => candidate.id === team.id)
      ? `/team-crests/${team.id}.webp`
      : team.crestUrl,
  })),
  standings: premierLeagueTeams.map((team, index) => ({
    teamId: team.id,
    position: index + 1,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  })),
  fixtures: [
    {
      id: '128731',
      matchweek: 0,
      kickoffUtc: '2026-07-18T15:00:00.000Z',
      status: 'Not played yet',
      venue: 'Helsinki Olympic Stadium, Helsinki',
      homeTeamId: '12',
      awayTeamId: '195',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128834',
      matchweek: 0,
      kickoffUtc: '2026-07-24T16:00:00.000Z',
      status: 'Not played yet',
      venue: 'Lerkendal Stadium, Trondheim',
      homeTeamId: '371',
      awayTeamId: '12',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128836',
      matchweek: 0,
      kickoffUtc: '2026-08-01T13:00:00.000Z',
      status: 'Not played yet',
      venue: 'Strawberry Arena, Stockholm',
      homeTeamId: '12',
      awayTeamId: '48',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128833',
      matchweek: 0,
      kickoffUtc: '2026-08-08T15:00:00.000Z',
      status: 'Not played yet',
      venue: 'Ullevi Stadium, Gothenburg',
      homeTeamId: '67',
      awayTeamId: '12',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128825',
      matchweek: 0,
      kickoffUtc: '2026-08-12T18:30:00.000Z',
      status: 'Not played yet',
      venue: 'Croke Park, Dublin',
      homeTeamId: '9',
      awayTeamId: '12',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128906',
      matchweek: 0,
      kickoffUtc: '2026-08-15T14:00:00.000Z',
      status: 'Not played yet',
      venue: 'Tarczynski Arena, Wroclaw',
      homeTeamId: '64',
      awayTeamId: '12',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128923',
      matchweek: 1,
      kickoffUtc: '2026-08-21T19:00:00.000Z',
      status: 'Not played yet',
      venue: 'Emirates Stadium, London',
      homeTeamId: '1',
      awayTeamId: '5',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128926',
      matchweek: 1,
      kickoffUtc: '2026-08-22T11:30:00.000Z',
      status: 'Not played yet',
      venue: 'MKM Stadium, Hull',
      homeTeamId: '41',
      awayTeamId: '12',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'JioHotstar',
    },
    {
      id: '128925',
      matchweek: 1,
      kickoffUtc: '2026-08-22T14:00:00.000Z',
      status: 'Not played yet',
      venue: 'Hill Dickinson Stadium, Liverpool',
      homeTeamId: '7',
      awayTeamId: '6',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128931',
      matchweek: 1,
      kickoffUtc: '2026-08-23T15:30:00.000Z',
      status: 'Not played yet',
      venue: "St. James' Park, Newcastle",
      homeTeamId: '23',
      awayTeamId: '10',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
    {
      id: '128932',
      matchweek: 1,
      kickoffUtc: '2026-08-24T19:00:00.000Z',
      status: 'Not played yet',
      venue: 'Craven Cottage, London',
      homeTeamId: '34',
      awayTeamId: '4',
      homeScore: null,
      awayScore: null,
      scorers: [],
      assists: [],
      watch: 'TBC',
    },
  ],
  leaderboards: {
    scorers: [],
    assists: [],
    cleanSheets: [],
  },
  lastUpdated: new Date('2026-06-21T00:00:00.000Z').toISOString(),
  sources: ['Local fallback data', 'Premier League Pulse endpoint shape'],
}

export async function fetchHomeData(): Promise<HomeData> {
  const response = await fetch('/api/home-data')

  if (response.ok) {
    return attachFixtureDatabaseIds(
      normalizeHomeData(HomeDataSchema.parse(await response.json()) as HomeData),
    )
  }

  const snapshotResponse = await fetch('/home-data-snapshot.json', {
    cache: 'no-store',
  })

  if (snapshotResponse.ok) {
    return attachFixtureDatabaseIds(
      normalizeHomeData(HomeDataSchema.parse(await snapshotResponse.json()) as HomeData),
    )
  }

  throw new Error(`Home data request failed with ${response.status}`)
}

export async function attachFixtureDatabaseIds(homeData: HomeData) {
  const fixtureIdsNeedingLookup = homeData.fixtures
    .filter((fixture) => !fixture.dbId)
    .map((fixture) => fixture.providerFixtureId ?? fixture.id)

  if (fixtureIdsNeedingLookup.length === 0) {
    return homeData
  }

  const providerFixtureRows = new Map<string, string>()

  for (const chunk of chunkValues(fixtureIdsNeedingLookup, 150)) {
    const { data, error } = await supabase
      .from('fixtures')
      .select('id, provider_fixture_id')
      .eq('provider', 'Premier League Pulse')
      .in('provider_fixture_id', chunk)

    if (error) {
      return homeData
    }

    for (const row of data ?? []) {
      providerFixtureRows.set(String(row.provider_fixture_id), row.id)
    }
  }

  return {
    ...homeData,
    fixtures: homeData.fixtures.map((fixture) => {
      const providerFixtureId = fixture.providerFixtureId ?? fixture.id

      return {
        ...fixture,
        providerFixtureId,
        dbId: fixture.dbId ?? providerFixtureRows.get(providerFixtureId),
      }
    }),
  }
}

export function normalizeHomeData(homeData: HomeData) {
  const normalizedTeams = homeData.teams.map((team) => {
    const normalizedId = normalizeIdentifier(team.id)
    const knownTeam = KNOWN_TEAMS_BY_ID.get(normalizedId)

    return {
      ...team,
      id: normalizedId,
      name: knownTeam?.name ?? team.name,
      shortName: knownTeam?.shortName ?? team.shortName ?? team.name,
      teamCode: normalizeTeamCode(
        knownTeam?.teamCode ?? team.teamCode ?? TEAM_CODE_FALLBACKS.get(normalizedId),
      ),
      crestUrl:
        knownTeam?.crestUrl ??
        team.crestUrl ??
        TEAM_CREST_FALLBACKS.get(normalizedId),
    }
  })
  const normalizedTeamIds = new Set(normalizedTeams.map((team) => team.id))
  const requiredTeamIds = new Set(
    [
      ...homeData.standings.map((standing) => normalizeIdentifier(standing.teamId)),
      ...homeData.fixtures.flatMap((fixture) => [
        normalizeIdentifier(fixture.homeTeamId),
        normalizeIdentifier(fixture.awayTeamId),
      ]),
      ...homeData.leaderboards.scorers.map((leader) => normalizeIdentifier(leader.teamId)),
      ...homeData.leaderboards.assists.map((leader) => normalizeIdentifier(leader.teamId)),
      ...homeData.leaderboards.cleanSheets.map((leader) =>
        normalizeIdentifier(leader.teamId),
      ),
    ].filter(Boolean),
  )
  const missingKnownTeams = Array.from(requiredTeamIds)
    .filter((teamId) => !normalizedTeamIds.has(teamId))
    .map((teamId) => KNOWN_TEAMS_BY_ID.get(teamId))
    .filter((team): team is Team => Boolean(team))

  return {
    ...homeData,
    teams: [...normalizedTeams, ...missingKnownTeams].sort((first, second) =>
      first.name.localeCompare(second.name),
    ),
    standings: homeData.standings.map((standing) => ({
      ...standing,
      teamId: normalizeIdentifier(standing.teamId),
    })),
    fixtures: homeData.fixtures.map((fixture) => ({
      ...fixture,
      id: normalizeIdentifier(fixture.id),
      providerFixtureId: normalizeIdentifier(fixture.providerFixtureId ?? fixture.id),
      homeTeamId: normalizeIdentifier(fixture.homeTeamId),
      awayTeamId: normalizeIdentifier(fixture.awayTeamId),
    })),
    leaderboards: {
      ...homeData.leaderboards,
      scorers: homeData.leaderboards.scorers.map((leader) => ({
        ...leader,
        teamId: normalizeIdentifier(leader.teamId),
      })),
      assists: homeData.leaderboards.assists.map((leader) => ({
        ...leader,
        teamId: normalizeIdentifier(leader.teamId),
      })),
      cleanSheets: homeData.leaderboards.cleanSheets.map((leader) => ({
        ...leader,
        teamId: normalizeIdentifier(leader.teamId),
      })),
    },
  }
}

export function normalizeIdentifier(value: string) {
  return String(value).replace(/\.0$/, '')
}

export function normalizeTeamCode(value?: string) {
  const normalized = String(value ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()

  return normalized || 'TBC'
}

export function chunkValues(values: string[], chunkSize: number) {
  const chunks: string[][] = []

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize))
  }

  return chunks
}
