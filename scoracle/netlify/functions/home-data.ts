import {
  fetchJson,
  jsonResponse,
  logInfo,
  publicError,
  requestIdFrom,
} from '../core/http.ts'
import type { NetlifyFunctionEvent } from '../core/types.ts'

const PULSE_BASE_URL = 'https://footballapi.pulselive.com/football'
const DEFAULT_COMP_SEASON_ID = '841'
const DEFAULT_LEADERBOARD_FALLBACK_COMP_SEASON_ID = '777'
const PRESEASON_COMP_SEASON_ID = '831'
const MANCHESTER_UNITED_TEAM_ID = '12'
const PRESEASON_MATCHWEEK = 0
const CACHE_TTL_MS = 1000 * 60 * 30
const FALLBACK_CRESTS_BY_PULSE_ID = new Map([
  ['1', '/team-crests/1.webp'],
  ['2', '/team-crests/2.webp'],
  ['48', '/team-crests/48.png'],
  ['127', '/team-crests/127.webp'],
  ['130', '/team-crests/130.webp'],
  ['131', '/team-crests/131.webp'],
  ['64', '/team-crests/64.png'],
  ['67', '/team-crests/67.png'],
  ['4', '/team-crests/4.webp'],
  ['5', '/team-crests/5.webp'],
  ['6', '/team-crests/6.webp'],
  ['7', '/team-crests/7.webp'],
  ['34', '/team-crests/34.webp'],
  ['41', '/team-crests/41.webp'],
  ['371', '/team-crests/371.png'],
  ['8', '/team-crests/8.webp'],
  ['9', '/team-crests/9.webp'],
  ['10', '/team-crests/10.webp'],
  ['11', '/team-crests/11.webp'],
  ['12', '/team-crests/12.webp'],
  ['23', '/team-crests/23.webp'],
  ['195', '/team-crests/195.png'],
  ['15', '/team-crests/15.webp'],
  ['29', '/team-crests/29.webp'],
  ['21', '/team-crests/21.webp'],
])
const FALLBACK_PLAYER_PHOTOS_BY_NAME = new Map([
  ['erlinghaaland', '/player-photos/erling-haaland.webp'],
  ['brunofernandes', '/player-photos/bruno-fernandes.webp'],
  ['davidraya', '/player-photos/david-raya.webp'],
])
const FALLBACK_TEAM_CODES_BY_PULSE_ID = new Map([
  ['1', 'ARS'],
  ['2', 'AVL'],
  ['48', 'ATM'],
  ['127', 'BOU'],
  ['130', 'BRE'],
  ['131', 'BRI'],
  ['64', 'ACM'],
  ['67', 'PSG'],
  ['4', 'CHE'],
  ['5', 'COV'],
  ['6', 'CRY'],
  ['7', 'EVE'],
  ['34', 'FUL'],
  ['41', 'HUL'],
  ['195', 'WRX'],
  ['371', 'RSB'],
  ['8', 'IPS'],
  ['9', 'LEE'],
  ['10', 'LIV'],
  ['11', 'MCI'],
  ['12', 'MUN'],
  ['23', 'NEW'],
  ['15', 'NFO'],
  ['29', 'SUN'],
  ['21', 'TOT'],
])

type PulseRankedPlayer = {
  rank?: number
  value?: number
  owner?: {
    id?: number | string
    playerId?: number | string
    name?: { display?: string }
    currentTeam?: unknown
  }
}

type PulseRankedResponse = {
  stats?: { content?: PulseRankedPlayer[] }
}

export async function handler(event: NetlifyFunctionEvent) {
  const requestId = requestIdFrom(event)

  if (event.httpMethod && event.httpMethod !== 'GET') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', requestId }, 405, 'no-store', requestId)
  }

  const season = process.env.SCORACLE_SEASON ?? '2026'
  const compSeasonId =
    process.env.PULSE_COMP_SEASON_ID ?? DEFAULT_COMP_SEASON_ID
  const cacheKey = `home-data-v6:${season}:${compSeasonId}`
  const forceRefresh = isAuthorizedRefresh(event)

  try {
    const cached = await readSupabaseCache(cacheKey)

    if (cached?.isFresh && !forceRefresh && hasFixtureDatabaseIds(cached.payload)) {
      logInfo('home_data_cache_hit', { requestId, cacheKey })
      return jsonResponse(
        cached.payload,
        200,
        'public, max-age=60, s-maxage=300, stale-while-revalidate=1800',
        requestId,
      )
    }

    if (
      cached?.payload &&
      !cached.isFresh &&
      !forceRefresh &&
      hasFixtureDatabaseIds(cached.payload)
    ) {
      const refreshQueued = await queueBackgroundRefresh(cacheKey, requestId)

      if (refreshQueued) {
        logInfo('home_data_stale_while_revalidate', { requestId, cacheKey })
        return jsonResponse(
          {
            ...cached.payload,
            sources: [
              ...new Set([
                ...(cached.payload.sources ?? []),
                'Refreshing provider data in background',
              ]),
            ],
          },
          200,
          'public, max-age=30, s-maxage=60, stale-while-revalidate=1800',
          requestId,
        )
      }
    }

    const [standingsResponse, fixturesResponse, preseasonFixturesResponse] = await Promise.all([
      fetchJson(
        `${PULSE_BASE_URL}/standings?comps=1&compSeasons=${compSeasonId}&page=0&pageSize=20`,
      ),
      fetchJson(
        `${PULSE_BASE_URL}/fixtures?comps=1&compSeasons=${compSeasonId}&page=0&pageSize=380&sort=asc`,
      ),
      fetchJson(
        `${PULSE_BASE_URL}/fixtures?teams=${MANCHESTER_UNITED_TEAM_ID}&compSeasons=${PRESEASON_COMP_SEASON_ID}&page=0&pageSize=20&sort=asc`,
      ),
    ])

    const teamsById = new Map()
    const standings = normalizeStandings(standingsResponse, teamsById)
    const fixtures = mergeFixtures(
      normalizeFixtures(fixturesResponse, teamsById),
      normalizeFixtures(preseasonFixturesResponse, teamsById, {
        matchweekOverride: PRESEASON_MATCHWEEK,
      }),
    )
    const teams = Array.from(teamsById.values())
      .map((team) => ({
        ...team,
        crestUrl: FALLBACK_CRESTS_BY_PULSE_ID.get(team.id),
      }))
      .sort((first, second) => first.name.localeCompare(second.name))

    const [scorersResult, assistsResult, cleanSheetsResult] = await Promise.allSettled([
      fetchPulseLeadersWithFallback('goals', compSeasonId, teamsById),
      fetchPulseLeadersWithFallback('goal_assist', compSeasonId, teamsById),
      fetchPulseLeadersWithFallback('clean_sheet', compSeasonId, teamsById),
    ])
    const scorers = settledValue(scorersResult)
    const assists = settledValue(assistsResult)
    const cleanSheets = settledValue(cleanSheetsResult)

    const syncedFixtures = await syncHomeDataToSupabase({
      season,
      teams,
      fixtures,
    })

    const payload = {
      teams,
      standings,
      fixtures: syncedFixtures,
      leaderboards: {
        scorers: await enrichPlayerPhotos(scorers),
        assists: await enrichPlayerPhotos(assists),
        cleanSheets: await enrichPlayerPhotos(cleanSheets),
      },
      lastUpdated: new Date().toISOString(),
      sources: [
        'Premier League Pulse',
        'Premier League Pulse preseason friendlies',
        'Local static image cache',
        process.env.API_FOOTBALL_KEY ? 'API-Football configured as fallback' : '',
      ].filter(Boolean),
    }

    await writeSupabaseCache(cacheKey, payload)
    await pruneOperationalData().catch(() => undefined)

    logInfo('home_data_refreshed', {
      requestId,
      fixtures: payload.fixtures.length,
      teams: payload.teams.length,
    })
    return jsonResponse(
      payload,
      200,
      'public, max-age=60, s-maxage=300, stale-while-revalidate=1800',
      requestId,
    )
  } catch (error) {
    const stale = await readSupabaseCache(cacheKey).catch(() => null)

    if (stale?.payload && hasFixtureDatabaseIds(stale.payload)) {
      logInfo('home_data_stale_fallback', { requestId, cacheKey })
      return jsonResponse(
        {
          ...stale.payload,
          sources: [...new Set([...(stale.payload.sources ?? []), 'Stale cache fallback'])],
        },
        200,
        'public, max-age=30, s-maxage=60',
        requestId,
      )
    }

    return jsonResponse(
      publicError(error, requestId, 'HOME_DATA_UNAVAILABLE'),
      502,
      'no-store',
      requestId,
    )
  }
}

function isAuthorizedRefresh(event) {
  const expected = process.env.INTERNAL_REFRESH_SECRET
  const provided =
    event.headers?.['x-scoracle-refresh-token'] ??
    event.headers?.['X-Scoracle-Refresh-Token']
  return Boolean(expected && provided && provided === expected)
}

async function queueBackgroundRefresh(cacheKey, requestId) {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL
  const secret = process.env.INTERNAL_REFRESH_SECRET

  if (!siteUrl || !secret || !(await tryAcquireSyncLease(cacheKey))) {
    return false
  }

  try {
    const response = await fetch(
      `${siteUrl.replace(/\/$/, '')}/.netlify/functions/home-data-refresh-background`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-scoracle-refresh-token': secret,
          'x-parent-request-id': requestId,
        },
      },
    )

    if (!response.ok) {
      await releaseSyncLease(cacheKey)
      return false
    }

    return true
  } catch {
    await releaseSyncLease(cacheKey)
    return false
  }
}

async function tryAcquireSyncLease(cacheKey) {
  const config = getSupabaseConfig()

  if (!config) {
    return false
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/try_acquire_sync_lease`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ requested_lease_key: cacheKey, lease_seconds: 300 }),
  })

  return response.ok && (await response.json()) === true
}

export async function releaseSyncLease(cacheKey) {
  const config = getSupabaseConfig()

  if (!config) {
    return
  }

  await fetch(`${config.url}/rest/v1/rpc/release_sync_lease`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ requested_lease_key: cacheKey }),
  })
}

function settledValue(result) {
  return result.status === 'fulfilled' ? result.value : []
}

function normalizeStandings(response, teamsById) {
  const entries = response?.tables?.[0]?.entries ?? []

  return entries.map((entry) => {
    const team = normalizePulseTeam(entry.team)
    const overall = entry.overall ?? {}
    teamsById.set(team.id, team)

    return {
      teamId: team.id,
      position: Number(entry.position ?? 0),
      played: Number(overall.played ?? 0),
      won: Number(overall.won ?? 0),
      drawn: Number(overall.drawn ?? 0),
      lost: Number(overall.lost ?? 0),
      goalsFor: Number(overall.goalsFor ?? 0),
      goalsAgainst: Number(overall.goalsAgainst ?? 0),
      goalDifference: Number(overall.goalsDifference ?? 0),
      points: Number(overall.points ?? 0),
    }
  })
}

function normalizeFixtures(
  response,
  teamsById,
  options: { matchweekOverride?: number } = {},
) {
  const fixtures = response?.content ?? []
  const matchweekOverride = options.matchweekOverride

  return fixtures
    .map((fixture) => {
      const homeTeam = normalizePulseTeam(fixture.teams?.[0]?.team)
      const awayTeam = normalizePulseTeam(fixture.teams?.[1]?.team)

      teamsById.set(homeTeam.id, homeTeam)
      teamsById.set(awayTeam.id, awayTeam)

      return {
        id: String(fixture.id),
        matchweek: Number(matchweekOverride ?? fixture.gameweek?.gameweek ?? 0),
        kickoffUtc: new Date(getFixtureKickoffMillis(fixture)).toISOString(),
        status: normalizeStatus(fixture.status),
        venue: [fixture.ground?.name, fixture.ground?.city]
          .filter(Boolean)
          .join(', '),
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: getTeamGoals(fixture, homeTeam.id),
        awayScore: getTeamGoals(fixture, awayTeam.id),
        scorers: getGoalNames(fixture.goals),
        assists: getAssistNames(fixture.goals),
        watch: 'TBC',
      }
    })
    .sort(
      (first, second) =>
        new Date(first.kickoffUtc).getTime() -
        new Date(second.kickoffUtc).getTime(),
    )
}

function mergeFixtures(...fixtureGroups) {
  const fixturesById = new Map()

  for (const group of fixtureGroups) {
    for (const fixture of group) {
      fixturesById.set(fixture.id, fixture)
    }
  }

  return Array.from(fixturesById.values()).sort(
    (first, second) =>
      new Date(first.kickoffUtc).getTime() -
      new Date(second.kickoffUtc).getTime(),
  )
}

function normalizePulseTeam(team) {
  const id = String(team?.id ?? 'unknown')
  const club = team?.club ?? {}
  const teamCode = normalizeTeamCode(
    team?.teamCode ??
      team?.teamCodeDisplay ??
      team?.shortCode ??
      team?.abbreviation ??
      team?.tla ??
      club.teamCode ??
      club.teamCodeDisplay ??
      club.shortCode ??
      club.abbreviation ??
      club.tla ??
      FALLBACK_TEAM_CODES_BY_PULSE_ID.get(id),
  )

  return {
    id,
    name: team?.name ?? club.name ?? 'TBC',
    shortName: team?.shortName ?? club.shortName ?? team?.name ?? 'TBC',
    teamCode,
  }
}

function getFixtureKickoffMillis(fixture) {
  const kickoffMillis = Number(
    fixture.kickoff?.millis ?? fixture.provisionalKickoff?.millis ?? 0,
  )

  return kickoffMillis > 0 ? kickoffMillis : Date.now()
}

async function fetchPulseLeadersWithFallback(statKey, compSeasonId, teamsById) {
  const currentSeasonLeaders = await fetchPulseLeaders(
    statKey,
    compSeasonId,
    teamsById,
    'Premier League Pulse 2026/27',
  )

  if (currentSeasonLeaders.length > 0) {
    return currentSeasonLeaders
  }

  const fallbackCompSeasonId =
    process.env.PULSE_LEADERBOARD_FALLBACK_COMP_SEASON_ID ??
    DEFAULT_LEADERBOARD_FALLBACK_COMP_SEASON_ID

  return fetchPulseLeaders(
    statKey,
    fallbackCompSeasonId,
    teamsById,
    'Premier League Pulse latest completed leaderboard',
  )
}

async function fetchPulseLeaders(statKey, compSeasonId, teamsById, sourceLabel) {
  const response = await fetchJson<PulseRankedResponse>(
    `${PULSE_BASE_URL}/stats/ranked/players/${statKey}?comps=1&compSeasons=${compSeasonId}&page=0&pageSize=20`,
  )
  const rows = response?.stats?.content ?? []

  return rows.map((row) => {
    const owner = row.owner ?? {}
    const team = normalizePulseTeam(owner.currentTeam)
    teamsById.set(team.id, team)

    return {
      id: `${statKey}-${owner.id ?? owner.playerId ?? row.rank}`,
      playerName: owner.name?.display ?? 'Player TBC',
      teamId: team.id,
      value: Number(row.value ?? 0),
      photoVerified: false,
      source: sourceLabel,
    }
  })
}

async function enrichPlayerPhotos(leaders) {
  const enriched = []

  for (const leader of leaders.slice(0, 10)) {
    enriched.push(withLocalPlayerPhoto(leader))
  }

  return enriched
}

function withLocalPlayerPhoto(leader) {
  const fallbackPhoto = FALLBACK_PLAYER_PHOTOS_BY_NAME.get(
    normalizeName(leader.playerName),
  )

  if (fallbackPhoto) {
    return {
      ...leader,
      photoUrl: fallbackPhoto,
      photoVerified: true,
      source: `${leader.source}, local static image cache`,
    }
  }

  return leader
}

function getTeamGoals(fixture, teamId) {
  if (fixture.status === 'U') {
    return null
  }

  return (fixture.goals ?? []).filter(
    (goal) => String(goal.team?.id ?? goal.teamId) === teamId,
  ).length
}

function getGoalNames(goals = []) {
  return goals
    .map((goal) => goal.person?.name?.display ?? goal.scorer?.name?.display)
    .filter(Boolean)
}

function getAssistNames(goals = []) {
  return goals
    .map((goal) => goal.assist?.name?.display ?? goal.assists?.[0]?.name?.display)
    .filter(Boolean)
}

function normalizeStatus(status) {
  const statuses = {
    U: 'Not played yet',
    L: 'Live',
    C: 'Full-time',
    P: 'Postponed',
  }

  return statuses[status] ?? status ?? 'TBC'
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/football club|fc|afc/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeTeamCode(value) {
  const code = String(value ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()

  return code || 'TBC'
}

async function readSupabaseCache(requestKey) {
  const config = getSupabaseConfig()

  if (!config) {
    return null
  }

  const key = encodeURIComponent(requestKey)
  const response = await fetch(
    `${config.url}/rest/v1/home_data_cache?select=payload,expires_at&request_key=eq.${key}&limit=1`,
    {
      headers: supabaseHeaders(config),
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = await response.json()
  const row = rows?.[0]

  if (!row) {
    return null
  }

  return {
    payload: row.payload,
    isFresh: new Date(row.expires_at).getTime() > Date.now(),
  }
}

function hasFixtureDatabaseIds(payload) {
  const fixtures = payload?.fixtures ?? []

  return fixtures.length === 0 || fixtures.every((fixture) => fixture.dbId)
}

async function writeSupabaseCache(requestKey, payload) {
  const config = getSupabaseConfig()

  if (!config) {
    return
  }

  await fetch(`${config.url}/rest/v1/home_data_cache`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config),
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      request_key: requestKey,
      payload,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  })
}

async function pruneOperationalData() {
  const config = getSupabaseConfig()

  if (!config) {
    return
  }

  await fetch(`${config.url}/rest/v1/rpc/prune_operational_data`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ retention_days: 90 }),
  })
}

async function syncHomeDataToSupabase({ season, teams, fixtures }) {
  const config = getSupabaseConfig()

  if (!config) {
    return fixtures
  }

  const teamRows = await upsertSupabaseRows(
    config,
    'teams',
    'pulse_team_id',
    teams.map((team) => ({
      canonical_name: team.name,
      short_name: team.shortName,
      team_code: team.teamCode,
      pulse_team_id: team.id,
      crest_url: team.crestUrl ?? null,
      logo_url: team.crestUrl ?? null,
      updated_at: new Date().toISOString(),
    })),
  )
  const teamsByPulseId = new Map(
    teamRows.map((team) => [String(team.pulse_team_id), team.id]),
  )

  const fixtureRows = await upsertSupabaseRows(
    config,
    'fixtures',
    'provider,provider_fixture_id',
    fixtures
      .map((fixture) => {
        const homeTeamDbId = teamsByPulseId.get(fixture.homeTeamId)
        const awayTeamDbId = teamsByPulseId.get(fixture.awayTeamId)

        if (!homeTeamDbId || !awayTeamDbId) {
          return null
        }

        return {
          season,
          provider: 'Premier League Pulse',
          provider_fixture_id: fixture.id,
          matchweek: fixture.matchweek,
          kickoff_utc: fixture.kickoffUtc,
          status: fixture.status,
          venue: fixture.venue,
          home_team_id: homeTeamDbId,
          away_team_id: awayTeamDbId,
          home_score: fixture.homeScore,
          away_score: fixture.awayScore,
          scorers: fixture.scorers,
          assists: fixture.assists,
          raw_payload: {},
          updated_at: new Date().toISOString(),
        }
      })
      .filter(Boolean),
  )
  const fixturesByProviderId = new Map(
    fixtureRows.map((fixture) => [String(fixture.provider_fixture_id), fixture]),
  )

  return fixtures.map((fixture) => {
    const syncedFixture = fixturesByProviderId.get(fixture.id)

    return {
      ...fixture,
      dbId: syncedFixture?.id,
      providerFixtureId: fixture.id,
    }
  })
}

async function upsertSupabaseRows(config, table, onConflict, rows) {
  if (rows.length === 0) {
    return []
  }

  const response = await fetch(
    `${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Supabase ${table} sync failed: ${details}`)
  }

  return (await response.json()) as Array<Record<string, unknown>>
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return { url, serviceRoleKey }
}

function supabaseHeaders(config) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
  }
}

