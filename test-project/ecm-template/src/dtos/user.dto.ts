import { z } from 'zod'

export const UpdateUserDto = z.object({
  email: z.string().email().optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
})

export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
})

export type UpdateUserInput = z.infer<typeof UpdateUserDto>
export type ChangePasswordInput = z.infer<typeof ChangePasswordDto>
