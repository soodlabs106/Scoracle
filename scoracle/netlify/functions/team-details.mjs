const PULSE_BASE_URL = 'https://footballapi.pulselive.com/football'
const DEFAULT_COMP_SEASON_ID = '841'
const CACHE_TTL_MS = 1000 * 60 * 60 * 6

export async function handler(event) {
  const params = event.queryStringParameters ?? {}
  const teamId = String(params.teamId ?? '').trim()
  const teamName = String(params.teamName ?? '').trim()
  const compSeasonId =
    process.env.PULSE_COMP_SEASON_ID ?? DEFAULT_COMP_SEASON_ID
  const sportsDbKey = process.env.THESPORTSDB_KEY ?? '123'

  if (!teamId || teamId === 'all') {
    return jsonResponse({ error: 'teamId is required' }, 400)
  }

  const cacheKey = `team-details-v2:${compSeasonId}:${teamId}`

  try {
    const cached = await readSupabaseCache(cacheKey)

    if (cached) {
      return jsonResponse(cached)
    }

    const [playersResponse, topScorerResponse] = await Promise.allSettled([
      fetchJson(
        `${PULSE_BASE_URL}/players?compSeasons=${compSeasonId}&teams=${encodeURIComponent(
          teamId,
        )}&page=0&pageSize=100`,
      ),
      fetchJson(
        `${PULSE_BASE_URL}/stats/ranked/players/goals?comps=1&compSeasons=${compSeasonId}&clubs=${encodeURIComponent(
          teamId,
        )}&page=0&pageSize=1`,
      ),
    ])

    let squadSource = 'Premier League Pulse'
    let squad =
      playersResponse.status === 'fulfilled'
        ? normalizePlayers(playersResponse.value, teamId)
        : []

    if (squad.length === 0 && teamName) {
      squad = await fetchSportsDbSquad(teamName, sportsDbKey).catch(() => [])
      if (squad.length > 0) {
        squadSource = 'TheSportsDB'
      }
    }
    const topScorer =
      topScorerResponse.status === 'fulfilled'
        ? normalizeTopScorer(topScorerResponse.value)
        : undefined

    const payload = {
      teamId,
      squad,
      topScorer,
      lastUpdated: new Date().toISOString(),
      source: squadSource,
    }

    await writeSupabaseCache(cacheKey, payload)

    return jsonResponse(payload)
  } catch (error) {
    return jsonResponse(
      {
        error: 'Unable to load team details',
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

function normalizePlayers(response, teamId) {
  const rows = getArrayContent(response)
  const players = rows
    .filter((row) => {
      const currentTeam = row.currentTeam ?? row.player?.currentTeam
      const currentTeamId = String(currentTeam?.id ?? '')
      const currentClubId = String(currentTeam?.club?.id ?? '')
      const teamType = String(currentTeam?.teamType ?? '').toUpperCase()

      return (
        teamType === 'FIRST' &&
        (currentTeamId === teamId || currentClubId === teamId)
      )
    })
    .map((row) => {
      const player = row.player ?? row.owner ?? row.person ?? row
      const id = String(player.id ?? player.playerId ?? row.id ?? '')
      const name =
        player.name?.display ??
        player.name?.full ??
        player.name ??
        player.displayName ??
        player.fullName ??
        row.name?.display ??
        ''

      if (!name) {
        return null
      }

      return {
        id: id || normalizeName(name),
        name,
        position:
          player.info?.positionInfo ??
          player.positionInfo ??
          player.position ??
          row.position ??
          undefined,
      }
    })
    .filter(Boolean)

  return [...new Map(players.map((player) => [normalizeName(player.name), player])).values()]
    .sort((first, second) => first.name.localeCompare(second.name))
}

function normalizeTopScorer(response) {
  const row = response?.stats?.content?.[0] ?? getArrayContent(response)[0]
  const owner = row?.owner ?? row?.player ?? row?.person ?? row
  const name =
    owner?.name?.display ??
    owner?.name?.full ??
    owner?.name ??
    owner?.displayName ??
    owner?.fullName

  if (!name) {
    return undefined
  }

  return {
    name,
    goals: Number(row?.value ?? row?.goals ?? 0),
  }
}

async function fetchSportsDbSquad(teamName, apiKey) {
  const teamResponse = await fetchJson(
    `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(
      apiKey,
    )}/searchteams.php?t=${encodeURIComponent(teamName)}`,
  )
  const team = Array.isArray(teamResponse?.teams)
    ? teamResponse.teams.find(
        (candidate) =>
          candidate?.strSport === 'Soccer' &&
          candidate?.strLeague === 'English Premier League',
      ) ?? teamResponse.teams[0]
    : null

  if (!team?.idTeam) {
    return []
  }

  const response = await fetchJson(
    `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(
      apiKey,
    )}/lookup_all_players.php?id=${encodeURIComponent(team.idTeam)}`,
  )
  const players = Array.isArray(response?.player) ? response.player : []
  const activePlayers = players.filter(
    (player) =>
      player?.strStatus === 'Active' &&
      !String(player?.strPosition ?? '')
        .toLowerCase()
        .includes('coach') &&
      !String(player?.strPosition ?? '')
        .toLowerCase()
        .includes('manager'),
  )
  const rows = activePlayers.length > 0 ? activePlayers : players

  return rows
    .map((player) => {
      const name = player?.strPlayer ?? player?.strName

      if (!name) {
        return null
      }

      return {
        id: String(player.idPlayer ?? normalizeName(name)),
        name,
        position: player.strPosition ?? undefined,
      }
    })
    .filter(Boolean)
    .sort((first, second) => first.name.localeCompare(second.name))
}

function getArrayContent(response) {
  if (Array.isArray(response?.content)) {
    return response.content
  }

  if (Array.isArray(response?.players?.content)) {
    return response.players.content
  }

  if (Array.isArray(response?.players)) {
    return response.players
  }

  if (Array.isArray(response?.content?.content)) {
    return response.content.content
  }

  return []
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
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
      'cache-control': 'public, max-age=300',
    },
    body: JSON.stringify(payload),
  }
}
