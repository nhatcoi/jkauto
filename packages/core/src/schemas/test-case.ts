import { z } from 'zod'
import { PlatformSchema } from './project'

export const StepSchema = z.object({
  id: z.string(),
  keyword: z.string().min(1),
  description: z.string().default(''),
  objectRef: z.string().default(''),
  input: z.string().default(''),
  expected: z.string().default(''),
  enabled: z.boolean().default(true),
  continueOnFailure: z.boolean().default(false),
  timeout: z.number().nullable().default(null),
})
export type Step = z.infer<typeof StepSchema>

export const TestCaseSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  platform: PlatformSchema.optional(), // fallback = project.type tại runtime
  device: z.string().optional(),       // mobile: e.g. "iPhone 14"; undefined = adapter default
  stepDelayMs: z.number().int().min(0).nullable().default(null), // null = use global setting
  tags: z.array(z.string()).default([]),
  steps: z.array(StepSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type TestCase = z.infer<typeof TestCaseSchema>
