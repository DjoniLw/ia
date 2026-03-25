import { AlertCircle } from 'lucide-react'
import { getWalletOriginLabel } from '@/lib/wallet-labels'
import type { WalletOriginType } from '@/lib/wallet-labels'

interface WalletOriginBadgeProps {
  originType: string
  originReference?: string | null
}

const ORIGIN_COLORS: Record<WalletOriginType, string> = {
  OVERPAYMENT:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  GIFT:               'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  REFUND:             'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  CASHBACK_PROMOTION: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PACKAGE_PURCHASE:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  VOUCHER_SPLIT:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
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
