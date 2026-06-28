import { TeamDetailsSchema } from '../../shared/contracts/teamDetails'

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

export async function fetchTeamDetails(teamId: string): Promise<TeamDetails> {
  const params = new URLSearchParams({ teamId })
  const response = await fetch(`/api/team-details?${params.toString()}`).catch(
    () => null,
  )

  if (response?.ok) {
    return TeamDetailsSchema.parse(await response.json()) as TeamDetails
  }

  throw new Error(
    `Team details request failed with ${response?.status ?? 'network error'}`,
  )
}
