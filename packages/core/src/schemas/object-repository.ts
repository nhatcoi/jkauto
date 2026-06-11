import { z } from 'zod'

// ── UI Web Object (existing) ──────────────────────────────────────────────────

export const LocatorStrategySchema = z.enum([
  'testid', 'css', 'xpath', 'text', 'role', 'label', 'placeholder',
])
export type LocatorStrategy = z.infer<typeof LocatorStrategySchema>

export const LocatorSchema = z.object({
  strategy: LocatorStrategySchema,
  value: z.string().min(1),
  priority: z.number().default(0),
})
export type Locator = z.infer<typeof LocatorSchema>

export const ObjectItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  locators: z.array(LocatorSchema).min(1),
})
export type ObjectItem = z.infer<typeof ObjectItemSchema>

export const ObjectRepositorySchema = z.object({
  schemaVersion: z.number().default(1),
  name: z.string().min(1),
  objects: z.array(ObjectItemSchema).default([]),
})
export type ObjectRepository = z.infer<typeof ObjectRepositorySchema>

// ── API Request ───────────────────────────────────────────────────────────────

export const HttpMethodSchema = z.enum([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
])
export type HttpMethod = z.infer<typeof HttpMethodSchema>

export const KeyValueItemSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().default(true),
})
export type KeyValueItem = z.infer<typeof KeyValueItemSchema>

export const AuthConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string().default('') }),
  z.object({
    type: z.literal('basic'),
    username: z.string().default(''),
    password: z.string().default(''),
  }),
  z.object({
    type: z.literal('api-key'),
    key: z.string().default(''),
    value: z.string().default(''),
    in: z.enum(['header', 'query']).default('header'),
  }),
])
export type AuthConfig = z.infer<typeof AuthConfigSchema>

export const BodyConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('raw-json'), content: z.string().default('') }),
  z.object({ type: z.literal('raw-text'), content: z.string().default('') }),
  z.object({ type: z.literal('form-data'), items: z.array(KeyValueItemSchema).default([]) }),
  z.object({ type: z.literal('form-urlencoded'), items: z.array(KeyValueItemSchema).default([]) }),
])
export type BodyConfig = z.infer<typeof BodyConfigSchema>

export const AssertionSchema = z.object({
  id: z.string(),
  target: z.enum(['status', 'header', 'body-json-path', 'response-time']),
  op: z.enum(['eq', 'ne', 'contains', 'not-contains', 'exists', 'not-exists', 'lt', 'gt']),
  path: z.string().optional(),
  expected: z.string().default(''),
})
export type Assertion = z.infer<typeof AssertionSchema>

export const ApiRequestSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  method: HttpMethodSchema.default('GET'),
  url: z.string().default(''),
  params: z.array(KeyValueItemSchema).default([]),
  headers: z.array(KeyValueItemSchema).default([]),
  auth: AuthConfigSchema.default({ type: 'none' }),
  body: BodyConfigSchema.default({ type: 'none' }),
  assertions: z.array(AssertionSchema).default([]),
})
export type ApiRequest = z.infer<typeof ApiRequestSchema>
