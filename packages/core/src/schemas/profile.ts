import { z } from 'zod'

export const ProfileSchema = z.object({
  schemaVersion: z.number().default(1),
  name: z.string().min(1),
  variables: z.record(z.string(), z.string()).default({}),
})
export type Profile = z.infer<typeof ProfileSchema>
