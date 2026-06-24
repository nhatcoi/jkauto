import { z } from 'zod'
import { PlatformSchema } from './project'

export const StepSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
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

export const TestRunnerSchema = z.enum(['playwright', 'maestro', 'appium', 'api'])
export type TestRunner = z.infer<typeof TestRunnerSchema>

export const TestCaseSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  owner: z.string().default(''),
  tags: z.array(z.string()).default([]),
  platform: PlatformSchema.optional(),
  runner: TestRunnerSchema.optional(),
  app: z.object({
    id: z.string().default(''),
    env: z.string().default(''),
    path: z.string().default(''),
  }).default({}),
  config: z.object({
    timeoutMs: z.number().int().min(0).nullable().default(null),
    retry: z.number().int().min(0).default(0),
    stepDelayMs: z.number().int().min(0).nullable().default(null),
  }).default({}),
  variables: z.record(z.string()).default({}),
  dataFile: z.string().optional(),
  stepDelayMs: z.number().int().min(0).nullable().default(null),
  steps: z.array(StepSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type TestCase = z.infer<typeof TestCaseSchema>
