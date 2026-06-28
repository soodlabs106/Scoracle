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
const CACHE_TTL_MS = 1000 * 60 * 60 * 6
const KNOWN_TEAM_IDS = new Set([
  '1', '2', '4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '21',
  '23', '29', '34', '41', '127', '130', '131',
])

type NormalizedPlayer = {
  id: string
  name: string
  position?: string
}

type SportsDbTeam = {
  idTeam?: string
  strSport?: string
  strLeague?: string
}

type SportsDbPlayer = {
  idPlayer?: string
  strPlayer?: string
  strName?: string
  strStatus?: string
  strPosition?: string
}

type SportsDbTeamsResponse = { teams?: SportsDbTeam[] }
type SportsDbPlayersResponse = { player?: SportsDbPlayer[] }

export async function handler(event: NetlifyFunctionEvent) {
  const requestId = requestIdFrom(event)

  if (event.httpMethod && event.httpMethod !== 'GET') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', requestId }, 405, 'no-store', requestId)
  }

  const params = event.queryStringParameters ?? {}
  const teamId = String(params.teamId ?? '').trim()
  const teamName = String(params.teamName ?? '').trim()
  const compSeasonId =
    process.env.PULSE_COMP_SEASON_ID ?? DEFAULT_COMP_SEASON_ID
  const sportsDbKey = process.env.THESPORTSDB_KEY ?? '123'

  if (!KNOWN_TEAM_IDS.has(teamId)) {
    return jsonResponse({ error: 'INVALID_TEAM', requestId }, 400, 'no-store', requestId)
  }

  const cacheKey = `team-details-v2:${compSeasonId}:${teamId}`

  try {
    const cached = await readSupabaseCache(cacheKey)

    if (cached?.isFresh) {
      return jsonResponse(cached.payload, 200, 'public, max-age=300, s-maxage=21600', requestId)
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

    logInfo('team_details_refreshed', { requestId, teamId, squad: squad.length })
    return jsonResponse(payload, 200, 'public, max-age=300, s-maxage=21600', requestId)
  } catch (error) {
    const stale = await readSupabaseCache(cacheKey).catch(() => null)

    if (stale?.payload) {
      return jsonResponse(stale.payload, 200, 'public, max-age=60, s-maxage=300', requestId)
    }

    return jsonResponse(
      publicError(error, requestId, 'TEAM_DETAILS_UNAVAILABLE'),
      502,
      'no-store',
      requestId,
    )
  }
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

  const validPlayers = players.filter(
    (player): player is NormalizedPlayer => player !== null,
  )

  return [
    ...new Map<string, NormalizedPlayer>(
      validPlayers.map((player) => [normalizeName(player.name), player]),
    ).values(),
  ]
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
  const teamResponse = await fetchJson<SportsDbTeamsResponse>(
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

  const response = await fetchJson<SportsDbPlayersResponse>(
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

