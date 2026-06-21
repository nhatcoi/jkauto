import { z } from 'zod'

export const ProjectTypeSchema = z.enum(['web', 'mobile', 'desktop', 'api'])
export type ProjectType = z.infer<typeof ProjectTypeSchema>

// Platform extends ProjectType with 'appium' for native device automation.
// Runtime fallback: testCase.platform ?? project.type.
// For mobile, testCase.runner selects Maestro/Appium at runtime.
export const PlatformSchema = z.enum(['web', 'mobile', 'desktop', 'api', 'appium'])
export type Platform = z.infer<typeof PlatformSchema>

export const ProjectFormatSchema = z.enum(['json', 'yaml'])
export type ProjectFormat = z.infer<typeof ProjectFormatSchema>

export const ProjectSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  type: ProjectTypeSchema,
  icon: z.string().default(''),
  description: z.string().default(''),
  repoUrl: z.string().default(''),
  sourceType: z.enum(['git', 'local']).default('git'),
  sourcePath: z.string().default(''),
  format: ProjectFormatSchema.default('json'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Project = z.infer<typeof ProjectSchema>
