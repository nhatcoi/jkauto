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

export const MobileTestTypeSchema = z.enum(['normal', 'yaml', 'appium'])
export type MobileTestType = z.infer<typeof MobileTestTypeSchema>

export const TestCaseSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  platform: PlatformSchema.optional(),
  mobileTestType: MobileTestTypeSchema.optional(), // when platform='mobile': 'normal'|'yaml'|'appium'
  mobileYaml: z.string().optional(),              // raw Maestro YAML, used when mobileTestType='yaml'
  stepDelayMs: z.number().int().min(0).nullable().default(null),
  tags: z.array(z.string()).default([]),
  steps: z.array(StepSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type TestCase = z.infer<typeof TestCaseSchema>
