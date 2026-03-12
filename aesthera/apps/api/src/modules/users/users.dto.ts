import { z } from 'zod'

export const InviteUserDto = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'staff']),
})
export type InviteUserDto = z.infer<typeof InviteUserDto>

export const AcceptInviteDto = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})
export type AcceptInviteDto = z.infer<typeof AcceptInviteDto>

export const UpdateUserDto = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['admin', 'staff']).optional(),
})
export type UpdateUserDto = z.infer<typeof UpdateUserDto>

export const UpdateMeDto = z.object({
  name: z.string().min(2).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
})
export type UpdateMeDto = z.infer<typeof UpdateMeDto>
