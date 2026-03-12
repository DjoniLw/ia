import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')

export const RegisterDto = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  document: z.string().min(14).max(18), // CNPJ formatted
  password: passwordSchema,
})

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1),
})

export const VerifyEmailDto = z.object({
  token: z.string().min(1),
})

export const ResendVerificationDto = z.object({
  email: z.string().email(),
})

export const ForgotPasswordDto = z.object({
  email: z.string().email(),
})

export const ResetPasswordDto = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export type RegisterDto = z.infer<typeof RegisterDto>
export type LoginDto = z.infer<typeof LoginDto>
export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>
export type VerifyEmailDto = z.infer<typeof VerifyEmailDto>
export type ResendVerificationDto = z.infer<typeof ResendVerificationDto>
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>
