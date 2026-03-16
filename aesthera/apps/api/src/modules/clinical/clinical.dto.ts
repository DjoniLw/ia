import { z } from 'zod'

export const CreateClinicalRecordDto = z.object({
  customerId: z.string().uuid(),
  professionalId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.enum(['note', 'exam', 'procedure', 'prescription', 'anamnesis']).default('note'),
  performedAt: z.string().datetime().optional().nullable(), // ISO 8601 when exam/procedure was performed
})
export type CreateClinicalRecordDto = z.infer<typeof CreateClinicalRecordDto>

export const UpdateClinicalRecordDto = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(['note', 'exam', 'procedure', 'prescription', 'anamnesis']).optional(),
  performedAt: z.string().datetime().optional().nullable(),
})
export type UpdateClinicalRecordDto = z.infer<typeof UpdateClinicalRecordDto>

export const ListClinicalRecordsQuery = z.object({
  customerId: z.string().uuid().optional(),
  type: z.enum(['note', 'exam', 'procedure', 'prescription', 'anamnesis']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListClinicalRecordsQuery = z.infer<typeof ListClinicalRecordsQuery>
