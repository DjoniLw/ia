export const INSTALLMENTS_MAX_MONTH_OPTIONS = [2, 3, 6, 12] as const
export const DUPLICATA_MAX_INSTALLMENT_OPTIONS = [2, 3, 6] as const
export const DUPLICATA_DAYS_INTERVAL_OPTIONS = [15, 30, 60] as const

export interface PaymentMethodConfigShape {
  pixEnabled: boolean
  boletoEnabled: boolean
  cardEnabled: boolean
  installmentsEnabled: boolean
  installmentsMaxMonths: number
  installmentsMinAmount: number
  duplicataEnabled: boolean
  duplicataDaysInterval: number
  duplicataMaxInstallments: number
}

export const DEFAULT_PAYMENT_METHOD_CONFIG: PaymentMethodConfigShape = {
  pixEnabled: true,
  boletoEnabled: true,
  cardEnabled: true,
  installmentsEnabled: false,
  installmentsMaxMonths: 12,
  installmentsMinAmount: 10000,
  duplicataEnabled: false,
  duplicataDaysInterval: 30,
  duplicataMaxInstallments: 6,
}

export function normalizePaymentMethodConfig(
  config?: Partial<PaymentMethodConfigShape> | null,
): PaymentMethodConfigShape {
  return {
    ...DEFAULT_PAYMENT_METHOD_CONFIG,
    ...config,
  }
}

export function buildBillingPaymentMethods(config: PaymentMethodConfigShape): string[] {
  const methods: string[] = []

  if (config.pixEnabled) methods.push('pix')
  if (config.boletoEnabled) methods.push('boleto')
  if (config.cardEnabled) methods.push('card')
  if (config.cardEnabled && config.installmentsEnabled) methods.push('installments')
  if (config.duplicataEnabled) methods.push('duplicata')

  return methods.length > 0 ? methods : ['pix', 'boleto', 'card']
}
