import { z } from 'zod'

export const SuiteItemSchema = z.object({
  testCaseId: z.string(),
  testCasePath: z.string(),
  enabled: z.boolean().default(true),
  order: z.number(),
})
export type SuiteItem = z.infer<typeof SuiteItemSchema>

export const TestSuiteSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  profile: z.string().default('default'),
  items: z.array(SuiteItemSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type TestSuite = z.infer<typeof TestSuiteSchema>
