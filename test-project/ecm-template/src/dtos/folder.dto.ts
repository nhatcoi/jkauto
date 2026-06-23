import { z } from 'zod'

export const CreateFolderDto = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional(),
})

export const UpdateFolderDto = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
})

export type CreateFolderInput = z.infer<typeof CreateFolderDto>
export type UpdateFolderInput = z.infer<typeof UpdateFolderDto>
