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

const AnamnesisSchema = z.object({
  skinType: z.string().optional(),        // Oleosa, Seca, Mista, Normal, Sensível
  allergies: z.string().optional(),       // free text
  medications: z.string().optional(),
  conditions: z.string().optional(),      // doenças / condições
  previousTreatments: z.string().optional(),
  currentTreatments: z.string().optional(),
  observations: z.string().optional(),
  consentSigned: z.boolean().optional(),
  consentDate: z.string().optional(),
}).optional()

export const CreateCustomerDto = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  phone2: z.string().nullish(),
  document: z.string().nullish(),         // CPF
  rg: z.string().nullish(),
  gender: z.string().nullish(),
  birthDate: z.string().nullish(),
  occupation: z.string().nullish(),
  howFound: z.string().nullish(),         // Como nos encontrou
  notes: z.string().nullish(),
  address: AddressSchema,
  anamnesis: AnamnesisSchema,
})
export type CreateCustomerDto = z.infer<typeof CreateCustomerDto>

export const UpdateCustomerDto = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  phone2: z.string().nullish(),
  document: z.string().nullish(),
  rg: z.string().nullish(),
  gender: z.string().nullish(),
  birthDate: z.string().nullish(),
  occupation: z.string().nullish(),
  howFound: z.string().nullish(),
  notes: z.string().nullish(),
  address: AddressSchema,
  anamnesis: AnamnesisSchema,
  bodyDataConsentAt: z.string().datetime().nullish(), // LGPD Art. 11I
})
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerDto>

export const ListCustomersQuery = z.object({
  search: z.string().optional(), // searches name OR document (CPF) OR phone
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
})
export type ListCustomersQuery = z.infer<typeof ListCustomersQuery>

