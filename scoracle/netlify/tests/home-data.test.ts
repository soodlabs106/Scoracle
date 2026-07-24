import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../functions/home-data.ts'

const originalEnv = { ...process.env }

describe('home-data preseason merge', () => {
  beforeEach(() => {
    process.env.SCORACLE_SEASON = '2026'
    process.env.PULSE_COMP_SEASON_ID = '841'
    process.env.PULSE_LEADERBOARD_FALLBACK_COMP_SEASON_ID = '777'
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('merges preseason fixtures, keeps league-only standings, and adds non-PL crest fallbacks', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes('/home_data_cache?')) {
        return jsonResponse([])
      }

      if (url.includes('/standings?')) {
        return jsonResponse({
          tables: [{
            entries: [{
              position: 1,
              team: {
                id: '1',
                name: 'Arsenal',
                shortName: 'Arsenal',
              },
              overall: {
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalsDifference: 0,
                points: 0,
              },
            }],
          }],
        })
      }

      if (url.includes('/fixtures?comps=1&compSeasons=841')) {
        return jsonResponse({
          content: [
            pulseFixture({
              id: '128923',
              gameweek: 1,
              kickoffMillis: Date.parse('2026-08-21T19:00:00.000Z'),
              homeTeam: { id: '1', name: 'Arsenal', shortName: 'Arsenal' },
              awayTeam: { id: '12', name: 'Manchester United', shortName: 'Man Utd' },
              status: 'L',
              phase: '1',
              clockSecs: 4020,
              teamScores: [1, 0],
            }),
          ],
        })
      }

      if (url.includes('/fixtures?teams=12&compSeasons=831')) {
        return jsonResponse({
          content: [
            pulseFixture({
              id: '128731',
              gameweek: 0,
              kickoffMillis: Date.parse('2026-07-18T15:00:00.000Z'),
              homeTeam: { id: '12', name: 'Manchester United', shortName: 'Man Utd' },
              awayTeam: { id: '195', name: 'Wrexham', shortName: 'Wrexham' },
              status: 'C',
              phase: 'F',
              clockSecs: 5520,
              teamScores: [0, 1],
              goals: [
                {
                  team: { id: '195' },
                  person: { name: { display: 'Sam Smith' } },
                  assist: { name: { display: 'Alex Jones' } },
                },
              ],
            }),
          ],
        })
      }

      if (url.includes('/football/fixtures/128731')) {
        return jsonResponse({
          teamLists: [
            {
              lineup: [],
              substitutes: [],
            },
            {
              lineup: [
                {
                  id: 14980,
                  name: { display: 'Sam Smith' },
                },
                {
                  id: 24353,
                  name: { display: "Lewis O'Brien" },
                },
              ],
              substitutes: [],
            },
          ],
          events: [
            {
              type: 'G',
              personId: 14980,
              assistId: 24353,
            },
          ],
        })
      }

      if (url.includes('/stats/ranked/players/')) {
        return jsonResponse({ stats: { content: [] } })
      }

      if (url.includes('/rest/v1/teams?on_conflict=')) {
        const body = JSON.parse(String(options?.body ?? '[]')) as Array<{
          pulse_team_id: string
        }>

        return jsonResponse(
          body.map((row, index) => ({
            id: `team-db-${index + 1}`,
            pulse_team_id: row.pulse_team_id,
          })),
        )
      }

      if (url.includes('/rest/v1/fixtures?on_conflict=')) {
        const body = JSON.parse(String(options?.body ?? '[]')) as Array<{
          provider_fixture_id: string
        }>

        return jsonResponse(
          body.map((row, index) => ({
            id: `fixture-db-${index + 1}`,
            provider_fixture_id: row.provider_fixture_id,
          })),
        )
      }

      if (url.includes('/rest/v1/home_data_cache') && options?.method === 'POST') {
        return jsonResponse({})
      }

      if (url.includes('/rest/v1/rpc/prune_operational_data')) {
        return jsonResponse(true)
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const result = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
    })
    const payload = JSON.parse(result.body)

    expect(result.statusCode).toBe(200)
    expect(payload.standings).toHaveLength(1)
    expect(payload.standings[0].teamId).toBe('1')
    expect(payload.fixtures.map((fixture: { matchweek: number }) => fixture.matchweek)).toEqual([0, 1])
    expect(payload.fixtures[0]).toMatchObject({
      id: '128731',
      matchweek: 0,
      homeTeamId: '12',
      awayTeamId: '195',
      dbId: 'fixture-db-1',
      providerFixtureId: '128731',
      status: 'FT',
      statusPhase: 'FULL_TIME',
      elapsedMinutes: null,
      homeScore: 0,
      awayScore: 1,
      scorers: ['Sam Smith'],
      assists: ["Lewis O'Brien"],
    })
    expect(payload.fixtures[1]).toMatchObject({
      id: '128923',
      matchweek: 1,
      dbId: 'fixture-db-2',
      providerFixtureId: '128923',
      status: "67'",
      statusPhase: 'LIVE',
      elapsedMinutes: 67,
      homeScore: 1,
      awayScore: 0,
    })
    expect(payload.teams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '195',
          name: 'Wrexham',
          teamCode: 'WRX',
          crestUrl: '/team-crests/195.png',
        }),
      ]),
    )
  })
})

function pulseFixture({
  id,
  gameweek,
  kickoffMillis,
  homeTeam,
  awayTeam,
  status = 'U',
  phase = '0',
  clockSecs,
  teamScores = [undefined, undefined],
  goals = [],
}: {
  id: string
  gameweek: number
  kickoffMillis: number
  homeTeam: { id: string; name: string; shortName: string }
  awayTeam: { id: string; name: string; shortName: string }
  status?: string
  phase?: string
  clockSecs?: number
  teamScores?: Array<number | undefined>
  goals?: unknown[]
}) {
  return {
    id,
    gameweek: { gameweek },
    kickoff: { millis: kickoffMillis },
    status,
    phase,
    ground: {
      name: 'Test Stadium',
      city: 'Test City',
    },
    teams: [
      { team: homeTeam, score: teamScores[0] },
      { team: awayTeam, score: teamScores[1] },
    ],
    clock: clockSecs === undefined ? undefined : { secs: clockSecs },
    goals,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
