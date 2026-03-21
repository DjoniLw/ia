import { z } from 'zod'

const AddressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
}).optional()

export const CreateProfessionalDto = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().nullish(),
  speciality: z.string().nullish(),
  address: AddressSchema,
})
export type CreateProfessionalDto = z.infer<typeof CreateProfessionalDto>

export const UpdateProfessionalDto = CreateProfessionalDto.partial().extend({
  active: z.boolean().optional(),
  allServices: z.boolean().optional(),
})
export type UpdateProfessionalDto = z.infer<typeof UpdateProfessionalDto>

const WorkingHourItemDto = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.boolean(),
})

export const SetWorkingHoursDto = z.object({
  hours: z.array(WorkingHourItemDto).min(1).max(7),
})
export type SetWorkingHoursDto = z.infer<typeof SetWorkingHoursDto>

export const AssignServicesDto = z.object({
  serviceIds: z.array(z.string().uuid()),
  allServices: z.boolean().optional(), // when true, marks professional as covering all services
})
export type AssignServicesDto = z.infer<typeof AssignServicesDto>

export const ListProfessionalsQuery = z.object({
  name: z.string().optional(),
  active: z
    .string()
    .optional()
    .transform((v) => (v === 'false' ? false : v === 'true' ? true : undefined)),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
})
export type ListProfessionalsQuery = z.infer<typeof ListProfessionalsQuery>
