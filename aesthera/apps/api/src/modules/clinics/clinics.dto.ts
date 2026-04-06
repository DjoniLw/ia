import { z } from 'zod'
import {
  DUPLICATA_DAYS_INTERVAL_OPTIONS,
  DUPLICATA_MAX_INSTALLMENT_OPTIONS,
  INSTALLMENTS_MAX_MONTH_OPTIONS,
} from './payment-method-config'

const optionalCnpjSchema = z
  .string()
  .optional()
  .refine((value) => {
    if (value === undefined) return true
    const digits = value.replace(/\D/g, '')
    return digits.length === 0 || digits.length === 14
  }, 'CNPJ deve ter 14 dígitos')

export const UpdateClinicDto = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  document: optionalCnpjSchema,
  timezone: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
  settings: z.record(z.unknown()).optional(),
  chargeVoucherDifference: z.boolean().optional(),
})

export type UpdateClinicDto = z.infer<typeof UpdateClinicDto>

const BusinessHourItemDto = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  isOpen: z.boolean(),
})

export const SetBusinessHoursDto = z.object({
  hours: z.array(BusinessHourItemDto).min(1).max(7),
})

export type SetBusinessHoursDto = z.infer<typeof SetBusinessHoursDto>

function isAllowedNumber(options: readonly number[], value: number) {
  return options.includes(value)
}

export const UpdatePaymentMethodConfigDto = z.object({
  pixEnabled: z.boolean(),
  boletoEnabled: z.boolean(),
  cardEnabled: z.boolean(),
  installmentsEnabled: z.boolean(),
  installmentsMaxMonths: z.coerce
    .number()
    .int()
    .refine((value) => isAllowedNumber(INSTALLMENTS_MAX_MONTH_OPTIONS, value), {
      message: 'Valor inválido para parcelas máximas',
    }),
  installmentsMinAmount: z.number().int().min(100),
  duplicataEnabled: z.boolean(),
  duplicataDaysInterval: z.coerce
    .number()
    .int()
    .refine((value) => isAllowedNumber(DUPLICATA_DAYS_INTERVAL_OPTIONS, value), {
      message: 'Valor inválido para intervalo de dias da duplicata',
    }),
  duplicataMaxInstallments: z.coerce
    .number()
    .int()
    .refine((value) => isAllowedNumber(DUPLICATA_MAX_INSTALLMENT_OPTIONS, value), {
      message: 'Valor inválido para número máximo de parcelas da duplicata',
    }),
})

export type UpdatePaymentMethodConfigDto = z.infer<typeof UpdatePaymentMethodConfigDto>

export const UpdateWhatsappSettingsDto = z.object({
  whatsappInstance: z.string().min(1, 'Nome da instância obrigatório').optional().nullable(),
})
export type UpdateWhatsappSettingsDto = z.infer<typeof UpdateWhatsappSettingsDto>

export const UpdateSmtpSettingsDto = z.object({
  smtpHost: z.string().min(1, 'Servidor obrigatório').optional().nullable(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().min(1, 'Usuário obrigatório').optional().nullable(),
  smtpPass: z.string().min(1, 'Senha obrigatória').optional().nullable(),
  smtpFrom: z.string().min(1, 'Remetente obrigatório').optional().nullable(),
  smtpSecure: z.boolean().optional(),
})
export type UpdateSmtpSettingsDto = z.infer<typeof UpdateSmtpSettingsDto>
