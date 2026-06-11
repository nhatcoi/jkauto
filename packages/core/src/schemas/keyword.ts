import { z } from 'zod'

export const KeywordParamSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  required: z.boolean().default(false),
  defaultValue: z.string().default(''),
})
export type KeywordParam = z.infer<typeof KeywordParamSchema>

export const CustomKeywordStepSchema = z.object({
  keyword: z.string().min(1),
  objectRef: z.string().default(''),
  input: z.string().default(''),
  expected: z.string().default(''),
})
export type CustomKeywordStep = z.infer<typeof CustomKeywordStepSchema>

export const CustomKeywordSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  params: z.array(KeywordParamSchema).default([]),
  steps: z.array(CustomKeywordStepSchema).default([]),
})
export type CustomKeyword = z.infer<typeof CustomKeywordSchema>
