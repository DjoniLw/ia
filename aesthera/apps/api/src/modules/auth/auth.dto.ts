import { z } from 'zod'

export const VerifyEmailDto = z.object({
  token: z.string().min(1),
})
export type VerifyEmailDto = z.infer<typeof VerifyEmailDto>

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')

// ─── Clinic user auth ─────────────────────────────────────────────────────────

const optionalCnpjSchema = z
  .string()
  .optional()
  .transform((value) => {
    const digits = value?.replace(/\D/g, '') ?? ''
    return digits.length > 0 ? digits : undefined
  })
  .refine((value) => value === undefined || value.length === 14, 'CNPJ deve ter 14 dígitos')

export const RegisterClinicDto = z.object({
  clinicName: z.string().min(2).max(100),
  clinicDocument: optionalCnpjSchema,
  adminName: z.string().min(2).max(100),
  email: z.string().email(),
  password: passwordSchema,
  phone: z.string().optional(),
  confirmTransfer: z.boolean().optional(),
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

export const ResendVerificationDto = z.object({
  email: z.string().email(),
})

export const ResendTransferDto = z.object({
  email: z.string().email(),
})

export const RecoverAccessDto = z.object({
  email: z.string().email(),
})

export const TransferTokenActionDto = z.object({
  token: z.string().min(1),
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegisterClinicDto = z.infer<typeof RegisterClinicDto>
export type LoginDto = z.infer<typeof LoginDto>
export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>
export type ProfessionalLoginDto = z.infer<typeof ProfessionalLoginDto>
export type RecoverAccessDto = z.infer<typeof RecoverAccessDto>
export type ResendVerificationDto = z.infer<typeof ResendVerificationDto>
export type ResendTransferDto = z.infer<typeof ResendTransferDto>
export type TransferTokenActionDto = z.infer<typeof TransferTokenActionDto>
