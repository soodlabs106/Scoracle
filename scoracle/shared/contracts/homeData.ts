import { z } from 'zod'

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  teamCode: z.string(),
  crestUrl: z.string().optional(),
})

export const FixtureSchema = z.object({
  id: z.string(),
  dbId: z.string().uuid().optional(),
  providerFixtureId: z.string().optional(),
  matchweek: z.number().int(),
  kickoffUtc: z.string(),
  status: z.string(),
  statusPhase: z.string().optional(),
  elapsedMinutes: z.number().int().nullable().optional(),
  venue: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  scorers: z.array(z.string()),
  assists: z.array(z.string()),
  watch: z.string().optional(),
})

const LeaderSchema = z.object({
  id: z.string(),
  playerName: z.string(),
  teamId: z.string(),
  value: z.number(),
  photoUrl: z.string().optional(),
  photoVerified: z.boolean(),
  source: z.string(),
})

export const HomeDataSchema = z.object({
  teams: z.array(TeamSchema),
  standings: z.array(
    z.object({
      teamId: z.string(),
      position: z.number().int(),
      played: z.number().int(),
      won: z.number().int(),
      drawn: z.number().int(),
      lost: z.number().int(),
      goalsFor: z.number().int(),
      goalsAgainst: z.number().int(),
      goalDifference: z.number().int(),
      points: z.number().int(),
    }),
  ),
  fixtures: z.array(FixtureSchema),
  leaderboards: z.object({
    scorers: z.array(LeaderSchema),
    assists: z.array(LeaderSchema),
    cleanSheets: z.array(LeaderSchema),
  }),
  lastUpdated: z.string(),
  sources: z.array(z.string()),
})
