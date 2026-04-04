import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

type InfoBannerVariant = 'info' | 'success' | 'warning' | 'error'

interface InfoBannerProps {
  variant?: InfoBannerVariant
  title: string
  description?: string
  className?: string
}

const VARIANT_CONFIG: Record<
  InfoBannerVariant,
  {
    container: string
    icon: string
    title: string
    description: string
    Icon: React.FC<{ className?: string }>
  }
> = {
  info: {
    container: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    description: 'text-blue-800 dark:text-blue-200',
    Icon: Info,
  },
  success: {
    container: 'border-teal-200 bg-teal-50 dark:border-teal-700 dark:bg-teal-900/40',
    icon: 'text-teal-700 dark:text-teal-300',
    title: 'text-teal-900 dark:text-teal-100',
    description: 'text-teal-800 dark:text-teal-200',
    Icon: CheckCircle,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30',
    icon: 'text-amber-700 dark:text-amber-300',
    title: 'text-amber-900 dark:text-amber-100',
    description: 'text-amber-800 dark:text-amber-200',
    Icon: AlertTriangle,
  },
  error: {
    container: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30',
    icon: 'text-red-700 dark:text-red-300',
    title: 'text-red-900 dark:text-red-100',
    description: 'text-red-800 dark:text-red-200',
    Icon: XCircle,
  },
}

export function InfoBanner({ variant = 'info', title, description, className = '' }: InfoBannerProps) {
  const cfg = VARIANT_CONFIG[variant]
  const { Icon } = cfg

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-2.5 ${cfg.container} ${className}`}>
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.icon}`} />
      <div>
        <p className={`text-sm font-semibold leading-snug ${cfg.title}`}>{title}</p>
        {description && (
          <p className={`mt-0.5 text-xs leading-relaxed ${cfg.description}`}>{description}</p>
        )}
      </div>
    </div>
  )
}
