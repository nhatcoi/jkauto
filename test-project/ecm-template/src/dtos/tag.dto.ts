import { z } from 'zod'

export const CreateTagDto = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#718096').optional(),
})

export const UpdateTagDto = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export type CreateTagInput = z.infer<typeof CreateTagDto>
export type UpdateTagInput = z.infer<typeof UpdateTagDto>
