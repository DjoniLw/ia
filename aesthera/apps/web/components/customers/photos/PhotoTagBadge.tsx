'use client'

import { cn } from '@/lib/utils'
import { PHOTO_TAG_COLOR } from '@/lib/status-colors'

type PhotoCategory = keyof typeof PHOTO_TAG_COLOR

interface PhotoTagBadgeProps {
  category: PhotoCategory
  className?: string
}

export function PhotoTagBadge({ category, className }: PhotoTagBadgeProps) {
  const config = PHOTO_TAG_COLOR[category]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
