import { z } from 'zod'

export const CreateAppointmentDto = z.object({
  customerId: z.string().uuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid().optional(), // kept for backward compat
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        price: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .optional(),
  scheduledAt: z.string().datetime(), // ISO 8601
  notes: z.string().optional(),
  price: z.number().int().min(0).optional(), // override total price if needed
  equipmentIds: z.array(z.string().uuid()).optional(), // equipment to use for this appointment
  packageSessionId: z.string().uuid().optional(), // reserve a package session for this appointment
}).refine((data) => data.serviceId || (data.services && data.services.length > 0), {
  message: 'Either serviceId or services array must be provided',
  path: ['serviceId'],
})
export type CreateAppointmentDto = z.infer<typeof CreateAppointmentDto>

export const UpdateAppointmentDto = z.object({
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  price: z.number().int().min(0).optional(),
  equipmentIds: z.array(z.string().uuid()).optional(), // replaces current equipment list
})
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentDto>

export const CancelAppointmentDto = z.object({
  cancellationReason: z.string().optional(),
})
export type CancelAppointmentDto = z.infer<typeof CancelAppointmentDto>

export const ListAppointmentsQuery = z.object({
  professionalId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  status: z.enum(['draft', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  date: z.string().optional(),        // YYYY-MM-DD exact
  dateFrom: z.string().optional(),    // YYYY-MM-DD
  dateTo: z.string().optional(),      // YYYY-MM-DD
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
})
export type ListAppointmentsQuery = z.infer<typeof ListAppointmentsQuery>

export const AvailabilityQuery = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
})
export type AvailabilityQuery = z.infer<typeof AvailabilityQuery>

export const CalendarQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  view: z.enum(['day', 'week']).default('day'),
  professionalId: z.string().uuid().optional(),
})
export type CalendarQuery = z.infer<typeof CalendarQuery>

export const CreateBlockedSlotDto = z.object({
  professionalId: z.string().uuid(),
  reason: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), // null = recurring
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  recurrence: z.enum(['none', 'daily', 'weekly']).default('none'),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
})
export type CreateBlockedSlotDto = z.infer<typeof CreateBlockedSlotDto>
