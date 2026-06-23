export type TeamDetailPlayer = {
  id: string
  name: string
  position?: string
}

export type TeamDetailTopScorer = {
  name: string
  goals: number
}

export type TeamDetails = {
  teamId: string
  squad: TeamDetailPlayer[]
  topScorer?: TeamDetailTopScorer
  lastUpdated: string
  source: string
}

export async function fetchTeamDetails(
  teamId: string,
  teamName?: string,
): Promise<TeamDetails> {
  const params = new URLSearchParams({
    teamId,
    cacheBust: Date.now().toString(),
  })

  if (teamName) {
    params.set('teamName', teamName)
  }

  const response = await fetch(`/api/team-details?${params.toString()}`, {
    cache: 'no-store',
  }).catch(() => null)

  if (response?.ok) {
    return (await response.json()) as TeamDetails
  }

  if (teamName) {
    return fetchSportsDbTeamDetails(teamId, teamName)
  }

  throw new Error(
    `Team details request failed with ${response?.status ?? 'network error'}`,
  )
}

async function fetchSportsDbTeamDetails(
  teamId: string,
  teamName: string,
): Promise<TeamDetails> {
  const teamResponse = await fetch(
    `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(
      teamName,
    )}`,
  )

  if (!teamResponse.ok) {
    throw new Error('TheSportsDB team lookup failed')
  }

  const teamData = await teamResponse.json()
  const team = Array.isArray(teamData?.teams)
    ? teamData.teams.find(
        (candidate: { strSport?: string; strLeague?: string }) =>
          candidate.strSport === 'Soccer' &&
          candidate.strLeague === 'English Premier League',
      ) ?? teamData.teams[0]
    : null

  if (!team?.idTeam) {
    throw new Error('TheSportsDB team not found')
  }

  const playersResponse = await fetch(
    `https://www.thesportsdb.com/api/v1/json/123/lookup_all_players.php?id=${encodeURIComponent(
      team.idTeam,
    )}`,
  )

  if (!playersResponse.ok) {
    throw new Error('TheSportsDB player lookup failed')
  }

  const playersData = await playersResponse.json()
  const players = Array.isArray(playersData?.player) ? playersData.player : []
  const activePlayers = players.filter(
    (player: { strStatus?: string; strPosition?: string }) =>
      player.strStatus === 'Active' &&
      !String(player.strPosition ?? '').toLowerCase().includes('coach') &&
      !String(player.strPosition ?? '').toLowerCase().includes('manager'),
  )
  const rows = activePlayers.length > 0 ? activePlayers : players

  return {
    teamId,
    squad: rows
      .map(
        (player: {
          idPlayer?: string
          strPlayer?: string
          strName?: string
          strPosition?: string
        }) => ({
          id: String(player.idPlayer ?? player.strPlayer ?? player.strName),
          name: player.strPlayer ?? player.strName ?? 'Player TBC',
          position: player.strPosition,
        }),
      )
      .filter((player: TeamDetailPlayer) => player.name !== 'Player TBC')
      .sort((first: TeamDetailPlayer, second: TeamDetailPlayer) =>
        first.name.localeCompare(second.name),
      ),
    lastUpdated: new Date().toISOString(),
    source: 'TheSportsDB browser fallback',
  }
}
