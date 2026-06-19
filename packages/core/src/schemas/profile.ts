import { z } from 'zod'

export const ApiAuthSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string().default('') }),
  z.object({ type: z.literal('basic'), username: z.string().default(''), password: z.string().default('') }),
  z.object({ type: z.literal('api-key'), key: z.string().default(''), value: z.string().default(''), in: z.enum(['header', 'query']).default('header') }),
])

export const ApiProfileConfigSchema = z.object({
  baseUrl: z.string().default(''),
  defaultHeaders: z.record(z.string(), z.string()).default({}),
  auth: ApiAuthSchema.default({ type: 'none' }),
})

export const ProfileSchema = z.object({
  schemaVersion: z.number().default(1),
  name: z.string().min(1),
  variables: z.record(z.string(), z.string()).default({}),
  api: ApiProfileConfigSchema.optional(),
})

export type ApiAuth = z.infer<typeof ApiAuthSchema>
export type ApiProfileConfig = z.infer<typeof ApiProfileConfigSchema>
export type Profile = z.infer<typeof ProfileSchema>
