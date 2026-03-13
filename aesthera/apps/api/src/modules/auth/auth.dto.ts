import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')

// ─── Clinic user auth ─────────────────────────────────────────────────────────

export const RegisterClinicDto = z.object({
  clinicName: z.string().min(2).max(100),
  clinicDocument: z.string().min(14).max(18).optional(), // CNPJ
  adminName: z.string().min(2).max(100),
  email: z.string().email(),
  password: passwordSchema,
  phone: z.string().optional(),
})

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1),
})

export const ForgotPasswordDto = z.object({
  email: z.string().email(),
})

export const ResetPasswordDto = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

// ─── Professional auth ────────────────────────────────────────────────────────

export const ProfessionalLoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegisterClinicDto = z.infer<typeof RegisterClinicDto>
export type LoginDto = z.infer<typeof LoginDto>
export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>
export type ProfessionalLoginDto = z.infer<typeof ProfessionalLoginDto>
