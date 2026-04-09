export const ANAMNESIS_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  clinic_filled: 'Preenchida pela clínica',
  sent_to_client: 'Enviada ao cliente',
  client_submitted: 'Aguardando revisão',
  pending: 'Pendente',
  signed: 'Assinada',
  expired: 'Expirada',
  correction_requested: 'Correção solicitada',
  cancelled: 'Cancelada',
}

/** @deprecated Use ANAMNESIS_STATUS_COLORS */
export const ANAMNESIS_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300',
  clinic_filled: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  sent_to_client: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  client_submitted: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  signed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  expired: 'bg-muted text-muted-foreground',
  correction_requested: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

/** Constante canônica para cores de status de anamnese */
export const ANAMNESIS_STATUS_COLORS = ANAMNESIS_STATUS_COLOR

export const PROMOTION_STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  inactive: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const BILLING_SOURCE_TYPE_LABEL: Record<string, string> = {
  APPOINTMENT:     'Agendamento',
  PRESALE:         'Pré-venda',
  MANUAL:          'Avulso',
  PACKAGE_SALE:    'Venda de pacote',
  PRODUCT_SALE:    'Venda de produto',
  WALLET_PURCHASE: 'Venda de vale',
}

export const BILLING_SOURCE_TYPE_COLOR: Record<string, string> = {
  APPOINTMENT:     'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  PRESALE:         'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  MANUAL:          'bg-muted text-muted-foreground',
  PACKAGE_SALE:    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  PRODUCT_SALE:    'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  WALLET_PURCHASE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
}

export const BILLING_STATUS_LABEL: Record<string, string> = {
  pending:   'Pendente',
  paid:      'Pago',
  overdue:   'Vencido',
  cancelled: 'Cancelado',
}

export const BILLING_STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  paid:      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  overdue:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  cancelled: 'bg-muted text-muted-foreground',
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
  cash:           'Dinheiro',
  pix:            'Pix',
  card:           'Cartão',
  transfer:       'Transferência',
  boleto:         'Boleto',
  wallet_credit:  'Crédito',
  wallet_voucher: 'Vale Serviço',
}

export const PAYMENT_METHOD_BADGE_COLORS: Record<string, string> = {
  cash:           'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  pix:            'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  card:           'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  transfer:       'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  wallet_credit:  'bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  wallet_voucher: 'bg-orange-200 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
}
