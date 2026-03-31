export const PROMOTION_STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  inactive: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
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
