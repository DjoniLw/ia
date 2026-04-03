export const PROMOTION_STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  inactive: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const BILLING_SOURCE_TYPE_LABEL: Record<string, string> = {
  APPOINTMENT: 'Agendamento',
  PRESALE:     'Pré-venda',
  MANUAL:      'Avulso',
}

export const BILLING_SOURCE_TYPE_COLOR: Record<string, string> = {
  APPOINTMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  PRESALE:     'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  MANUAL:      'bg-muted text-muted-foreground',
}

export const SESSION_STATUS_STYLE: Record<string, string> = {
  ABERTO: 'text-muted-foreground/40',
  AGENDADO: 'text-blue-500 dark:text-blue-400',
  FINALIZADO: 'text-green-500 dark:text-green-400',
  EXPIRADO: 'text-amber-600 dark:text-amber-400',
}

export const SESSION_LABEL: Record<string, string> = {
  ABERTO: 'disponível',
  AGENDADO: 'agendada',
  FINALIZADO: 'utilizada',
  EXPIRADO: 'expirada',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:     'Dinheiro',
  pix:      'PIX',
  card:     'Cartão',
  transfer: 'Transferência',
  boleto:   'Boleto',
}

export const PAYMENT_METHOD_BADGE_COLORS: Record<string, string> = {
  cash:     'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  pix:      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  card:     'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  transfer: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
}
