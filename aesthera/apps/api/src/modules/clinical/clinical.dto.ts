import { z } from 'zod'

export const CreateClinicalRecordDto = z.object({
  customerId: z.string().uuid(),
  professionalId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.enum(['note', 'exam', 'procedure', 'prescription']).default('note'),
})
export type CreateClinicalRecordDto = z.infer<typeof CreateClinicalRecordDto>

export const ListClinicalRecordsQuery = z.object({
  customerId: z.string().uuid().optional(),
  type: z.enum(['note', 'exam', 'procedure', 'prescription']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListClinicalRecordsQuery = z.infer<typeof ListClinicalRecordsQuery>
