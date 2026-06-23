import { z } from 'zod'

export const CreateDocumentDto = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).default('').optional(),
  folderId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string()).default([]).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft').optional(),
})

export const UpdateDocumentDto = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  folderId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export const UploadVersionDto = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
})

export type CreateDocumentInput = z.infer<typeof CreateDocumentDto>
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentDto>
export type UploadVersionInput = z.infer<typeof UploadVersionDto>
