import { z } from 'zod'

export const RegisterDto = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer').optional(),
})

export const LoginDto = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const RefreshTokenDto = z.object({
  refreshToken: z.string().uuid(),
})

export const LogoutDto = z.object({
  refreshToken: z.string().uuid(),
})

export type RegisterInput = z.infer<typeof RegisterDto>
export type LoginInput = z.infer<typeof LoginDto>
export type RefreshTokenInput = z.infer<typeof RefreshTokenDto>
