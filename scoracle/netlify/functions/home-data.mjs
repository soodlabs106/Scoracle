const PULSE_BASE_URL = 'https://footballapi.pulselive.com/football'
const DEFAULT_COMP_SEASON_ID = '841'
const DEFAULT_LEADERBOARD_FALLBACK_COMP_SEASON_ID = '777'
const CACHE_TTL_MS = 1000 * 60 * 30
const FALLBACK_CRESTS_BY_PULSE_ID = new Map([
  ['1', '/team-crests/1.png'],
  ['2', '/team-crests/2.png'],
  ['127', '/team-crests/127.png'],
  ['130', '/team-crests/130.png'],
  ['131', '/team-crests/131.png'],
  ['4', '/team-crests/4.png'],
  ['5', '/team-crests/5.png'],
  ['6', '/team-crests/6.png'],
  ['7', '/team-crests/7.png'],
  ['34', '/team-crests/34.png'],
  ['41', '/team-crests/41.png'],
  ['8', '/team-crests/8.png'],
  ['9', '/team-crests/9.png'],
  ['10', '/team-crests/10.png'],
  ['11', '/team-crests/11.png'],
  ['12', '/team-crests/12.png'],
  ['23', '/team-crests/23.png'],
  ['15', '/team-crests/15.png'],
  ['29', '/team-crests/29.png'],
  ['21', '/team-crests/21.png'],
])
const FALLBACK_PLAYER_PHOTOS_BY_NAME = new Map([
  ['erlinghaaland', '/player-photos/erling-haaland.png'],
  ['brunofernandes', '/player-photos/bruno-fernandes.png'],
  ['davidraya', '/player-photos/david-raya.png'],
])
const FALLBACK_TEAM_CODES_BY_PULSE_ID = new Map([
  ['1', 'ARS'],
  ['2', 'AVL'],
  ['127', 'BOU'],
  ['130', 'BRE'],
  ['131', 'BRI'],
  ['4', 'CHE'],
  ['5', 'COV'],
  ['6', 'CRY'],
  ['7', 'EVE'],
  ['34', 'FUL'],
  ['41', 'HUL'],
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

export async function handler(event) {
  const params = event.queryStringParameters ?? {}
  const season = params.season ?? process.env.SCORACLE_SEASON ?? '2026'
  const compSeasonId =
    process.env.PULSE_COMP_SEASON_ID ?? DEFAULT_COMP_SEASON_ID
  const cacheKey = `home-data-v4:${season}:${compSeasonId}`

  try {
    const cached = await readSupabaseCache(cacheKey)

    if (cached && hasFixtureDatabaseIds(cached)) {
      return jsonResponse(cached)
    }

    const [standingsResponse, fixturesResponse] = await Promise.all([
      fetchJson(
        `${PULSE_BASE_URL}/standings?comps=1&compSeasons=${compSeasonId}&page=0&pageSize=20`,
      ),
      fetchJson(
        `${PULSE_BASE_URL}/fixtures?comps=1&compSeasons=${compSeasonId}&page=0&pageSize=380&sort=asc`,
      ),
    ])

    const teamsById = new Map()
    const standings = normalizeStandings(standingsResponse, teamsById)
    const fixtures = normalizeFixtures(fixturesResponse, teamsById)
    const teams = Array.from(teamsById.values())
      .map((team) => ({
        ...team,
        crestUrl: FALLBACK_CRESTS_BY_PULSE_ID.get(team.id),
      }))
      .sort((first, second) => first.name.localeCompare(second.name))

    const [scorers, assists, cleanSheets] = await Promise.all([
      fetchPulseLeadersWithFallback('goals', compSeasonId, teamsById),
      fetchPulseLeadersWithFallback('goal_assist', compSeasonId, teamsById),
      fetchPulseLeadersWithFallback('clean_sheet', compSeasonId, teamsById),
    ])

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
        'Local static image cache',
        process.env.API_FOOTBALL_KEY ? 'API-Football configured as fallback' : '',
      ].filter(Boolean),
    }

    await writeSupabaseCache(cacheKey, payload)

    return jsonResponse(payload)
  } catch (error) {
    return jsonResponse(
      {
        error: 'Unable to load Scoracle home data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      502,
    )
  }
}

async function fetchJson(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`)
  }

  return response.json()
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

function normalizeFixtures(response, teamsById) {
  const fixtures = response?.content ?? []

  return fixtures
    .map((fixture) => {
      const homeTeam = normalizePulseTeam(fixture.teams?.[0]?.team)
      const awayTeam = normalizePulseTeam(fixture.teams?.[1]?.team)

      teamsById.set(homeTeam.id, homeTeam)
      teamsById.set(awayTeam.id, awayTeam)

      return {
        id: String(fixture.id),
        matchweek: Number(fixture.gameweek?.gameweek ?? 0),
        kickoffUtc: new Date(Number(fixture.kickoff?.millis ?? 0)).toISOString(),
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
  const response = await fetchJson(
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

  const now = encodeURIComponent(new Date().toISOString())
  const key = encodeURIComponent(requestKey)
  const response = await fetch(
    `${config.url}/rest/v1/home_data_cache?select=payload&request_key=eq.${key}&expires_at=gt.${now}&limit=1`,
    {
      headers: supabaseHeaders(config),
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = await response.json()
  return rows?.[0]?.payload ?? null
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

  return response.json()
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

function jsonResponse(payload, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(payload),
  }
}
