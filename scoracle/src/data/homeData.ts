export type Team = {
  id: string
  name: string
  shortName: string
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

const teams: Team[] = [
  {
    id: '1',
    name: 'Arsenal',
    shortName: 'Arsenal',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png',
  },
  {
    id: '2',
    name: 'Aston Villa',
    shortName: 'Aston Villa',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/jykrpv1717309891.png',
  },
  {
    id: '127',
    name: 'Bournemouth',
    shortName: 'Bournemouth',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/y08nak1534071116.png',
  },
  {
    id: '130',
    name: 'Brentford',
    shortName: 'Brentford',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/grv1aw1546453779.png',
  },
  {
    id: '131',
    name: 'Brighton & Hove Albion',
    shortName: 'Brighton',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/ywypts1448810904.png',
  },
  {
    id: '4',
    name: 'Chelsea',
    shortName: 'Chelsea',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/yvwvtu1448813215.png',
  },
  {
    id: '5',
    name: 'Coventry City',
    shortName: 'Coventry',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/uxyqys1424033798.png',
  },
  {
    id: '6',
    name: 'Crystal Palace',
    shortName: 'Crystal Palace',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/ia6i3m1656014992.png',
  },
  {
    id: '7',
    name: 'Everton',
    shortName: 'Everton',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/eqayrf1523184794.png',
  },
  {
    id: '34',
    name: 'Fulham',
    shortName: 'Fulham',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/xwwvyt1448811086.png',
  },
  {
    id: '41',
    name: 'Hull City',
    shortName: 'Hull',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/fbqqda1601726113.png',
  },
  {
    id: '8',
    name: 'Ipswich Town',
    shortName: 'Ipswich',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/mdj1ey1634670785.png',
  },
  {
    id: '9',
    name: 'Leeds United',
    shortName: 'Leeds',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/jcgrml1756649030.png',
  },
  {
    id: '10',
    name: 'Liverpool',
    shortName: 'Liverpool',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png',
  },
  {
    id: '11',
    name: 'Manchester City',
    shortName: 'Man City',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png',
  },
  {
    id: '12',
    name: 'Manchester United',
    shortName: 'Man Utd',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
  },
  {
    id: '23',
    name: 'Newcastle United',
    shortName: 'Newcastle',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/lhwuiz1621593302.png',
  },
  {
    id: '15',
    name: "Nottingham Forest",
    shortName: "Nott'm Forest",
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/1i2kvh1719918076.png',
  },
  {
    id: '29',
    name: 'Sunderland',
    shortName: 'Sunderland',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/tprtus1448813498.png',
  },
  {
    id: '21',
    name: 'Tottenham Hotspur',
    shortName: 'Spurs',
    crestUrl:
      'https://r2.thesportsdb.com/images/media/team/badge/dfyfhl1604094109.png',
  },
]

export const mockHomeData: HomeData = {
  teams: teams.map((team) => ({
    ...team,
    crestUrl: `/team-crests/${team.id}.png`,
  })),
  standings: teams.map((team, index) => ({
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
  const response = await fetch('/api/home-data?season=2026')

  if (!response.ok) {
    throw new Error(`Home data request failed with ${response.status}`)
  }

  return (await response.json()) as HomeData
}
