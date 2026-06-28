import { z } from 'zod'

export const TeamDetailsSchema = z.object({
  teamId: z.string(),
  squad: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      position: z.string().optional(),
    }),
  ),
  topScorer: z
    .object({
      name: z.string(),
      goals: z.number(),
    })
    .optional(),
  lastUpdated: z.string(),
  source: z.string(),
})
