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
  draft:                'bg-slate-500 text-white dark:bg-slate-600',
  clinic_filled:        'bg-teal-600 text-white dark:bg-teal-700',
  sent_to_client:       'bg-indigo-600 text-white dark:bg-indigo-700',
  client_submitted:     'bg-amber-700 text-white dark:bg-amber-800',
  pending:              'bg-slate-500 text-white dark:bg-slate-600',
  signed:               'bg-emerald-600 text-white dark:bg-emerald-700',
  expired:              'bg-slate-500 text-white dark:bg-slate-600',
  correction_requested: 'bg-orange-700 text-white dark:bg-orange-800',
  cancelled:            'bg-rose-600 text-white dark:bg-rose-700',
}

/** Constante canônica para cores de status de anamnese */
export const ANAMNESIS_STATUS_COLORS = ANAMNESIS_STATUS_COLOR

export const PROMOTION_STATUS_COLOR: Record<string, string> = {
  active:   'bg-emerald-600 text-white dark:bg-emerald-700',
  inactive: 'bg-slate-500 text-white dark:bg-slate-600',
  expired:  'bg-rose-600 text-white dark:bg-rose-700',
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
  APPOINTMENT:     'bg-blue-600 text-white dark:bg-blue-700',
  PRESALE:         'bg-violet-600 text-white dark:bg-violet-700',
  MANUAL:          'bg-slate-500 text-white dark:bg-slate-600',
  PACKAGE_SALE:    'bg-amber-700 text-white dark:bg-amber-800',
  PRODUCT_SALE:    'bg-teal-600 text-white dark:bg-teal-700',
  WALLET_PURCHASE: 'bg-emerald-600 text-white dark:bg-emerald-700',
}

export const BILLING_STATUS_LABEL: Record<string, string> = {
  pending:   'Pendente',
  paid:      'Pago',
  overdue:   'Vencido',
  cancelled: 'Cancelado',
}

export const BILLING_STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-700 text-white dark:bg-amber-800',
  paid:      'bg-emerald-600 text-white dark:bg-emerald-700',
  overdue:   'bg-rose-600 text-white dark:bg-rose-700',
  cancelled: 'bg-slate-500 text-white dark:bg-slate-600',
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
  cash:           'bg-emerald-600 text-white dark:bg-emerald-700',
  pix:            'bg-sky-600 text-white dark:bg-sky-700',
  card:           'bg-violet-600 text-white dark:bg-violet-700',
  transfer:       'bg-blue-600 text-white dark:bg-blue-700',
  wallet_credit:  'bg-amber-700 text-white dark:bg-amber-800',
  wallet_voucher: 'bg-orange-700 text-white dark:bg-orange-800',
}
