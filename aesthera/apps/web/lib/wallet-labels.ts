import type {
  WalletOriginType,
  WalletTransactionType,
  WalletEntryType,
  WalletEntryStatus,
} from '@/lib/hooks/use-wallet'

export type { WalletOriginType, WalletTransactionType, WalletEntryType, WalletEntryStatus }

// Record<EnumType, ...> garante cobertura exaustiva em compile-time.
// Se novo valor for adicionado ao enum sem label aqui, o TypeScript apontará erro imediatamente.

export const WALLET_ORIGIN_LABELS: Record<WalletOriginType, { label: string; description: string }> = {
  OVERPAYMENT:        { label: 'Troco de cobrança',   description: 'Excedente pago em relação ao valor da cobrança' },
  GIFT:               { label: 'Presente / Brinde',    description: 'Crédito concedido como presente ou brinde pela clínica' },
  REFUND:             { label: 'Estorno',              description: 'Devolução de valor referente a cancelamento ou ajuste' },
  CASHBACK_PROMOTION: { label: 'Bônus de retorno',     description: 'Cashback gerado por promoção da clínica' },
  PACKAGE_PURCHASE:   { label: 'Compra de pacote',     description: 'Saldo proveniente da compra de pacote de sessões' },
  VOUCHER_SPLIT:      { label: 'Troco de voucher',     description: 'Saldo restante de voucher utilizado parcialmente' },
}

export const WALLET_TRANSACTION_LABELS: Record<WalletTransactionType, string> = {
  CREATE: 'Criação',
  ADJUST: 'Ajuste manual',
  USE:    'Utilização',
  SPLIT:  'Divisão de saldo',
}

export const WALLET_ENTRY_TYPE_LABELS: Record<WalletEntryType, string> = {
  VOUCHER:  'Voucher',
  CREDIT:   'Crédito',
  CASHBACK: 'Cashback',  // enum interno permanece CASHBACK; amplamente conhecido no Brasil
  PACKAGE:  'Pacote',
}

export const WALLET_ENTRY_TYPE_COLORS: Record<WalletEntryType, string> = {
  VOUCHER:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  CREDIT:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  CASHBACK: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PACKAGE:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

export const WALLET_ENTRY_STATUS_CONFIG: Record<WalletEntryStatus, { label: string; variant: 'success' | 'muted' | 'destructive'; className: string }> = {
  ACTIVE:  { label: 'Ativo',     variant: 'success',     className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  USED:    { label: 'Utilizado', variant: 'muted',       className: 'bg-muted text-muted-foreground' },
  EXPIRED: { label: 'Expirado',  variant: 'destructive', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

export const WALLET_PACKAGE_SESSION_STATUS = {
  used:      { label: 'Utilizada',  variant: 'muted'    as const },
  available: { label: 'Disponível', variant: 'success'  as const },
}

/** Retorna label e description para um WalletOriginType, com fallback para enums desconhecidos. */
export function getWalletOriginLabel(value: string): { label: string; description: string; isUnknown: boolean } {
  const known = WALLET_ORIGIN_LABELS[value as WalletOriginType]
  if (known) return { ...known, isUnknown: false }
  return { label: value, description: `Tipo desconhecido: ${value}`, isUnknown: true }
}
