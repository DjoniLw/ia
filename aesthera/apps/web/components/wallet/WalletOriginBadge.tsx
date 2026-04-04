import { AlertCircle } from 'lucide-react'
import { getWalletOriginLabel } from '@/lib/wallet-labels'
import type { WalletOriginType } from '@/lib/wallet-labels'

interface WalletOriginBadgeProps {
  originType: string
  originReference?: string | null
}

const ORIGIN_COLORS: Record<WalletOriginType, string> = {
  OVERPAYMENT:        'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  GIFT:               'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-200',
  REFUND:             'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200',
  CASHBACK_PROMOTION: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200',
  PACKAGE_PURCHASE:   'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
  VOUCHER_SPLIT:      'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
  SERVICE_PRESALE:    'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-200',
}

function getEnrichedLabel(originType: string, originReference?: string | null): string {
  const { label, isUnknown } = getWalletOriginLabel(originType)
  if (isUnknown) return label

  if (originType === 'PACKAGE_PURCHASE' && originReference) {
    return `${label} · ${originReference}`
  }
  if (originType === 'OVERPAYMENT' && originReference) {
    return `${label} · ${originReference}`
  }
  return label
}

export function WalletOriginBadge({ originType, originReference }: WalletOriginBadgeProps) {
  const { label, description, isUnknown } = getWalletOriginLabel(originType)
  const enrichedLabel = getEnrichedLabel(originType, originReference)
  const colorClass = isUnknown
    ? 'bg-muted text-muted-foreground'
    : ORIGIN_COLORS[originType as WalletOriginType] ?? 'bg-muted text-muted-foreground'

  const tooltipText = isUnknown ? `Tipo não reconhecido: ${label}` : description

  return (
    <span
      title={tooltipText}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium cursor-default ${colorClass}`}
    >
      {isUnknown && <AlertCircle className="h-3 w-3 shrink-0" />}
      {enrichedLabel}
    </span>
  )
}
