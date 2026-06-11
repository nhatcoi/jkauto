import { z } from 'zod'

export const ProjectTypeSchema = z.enum(['web', 'mobile', 'desktop', 'api'])
export type ProjectType = z.infer<typeof ProjectTypeSchema>

export const ProjectFormatSchema = z.enum(['json', 'yaml'])
export type ProjectFormat = z.infer<typeof ProjectFormatSchema>

export const ProjectSchema = z.object({
  schemaVersion: z.number().default(1),
  id: z.string(),
  name: z.string().min(1),
  type: ProjectTypeSchema,
  description: z.string().default(''),
  repoUrl: z.string().default(''),
  format: ProjectFormatSchema.default('json'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Project = z.infer<typeof ProjectSchema>
