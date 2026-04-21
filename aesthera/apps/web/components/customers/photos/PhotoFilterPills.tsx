'use client'

import { cn } from '@/lib/utils'
import { PHOTO_TAG_COLOR } from '@/lib/status-colors'

type PhotoCategory = keyof typeof PHOTO_TAG_COLOR

const FILTER_OPTIONS: Array<{ value: PhotoCategory | 'all'; label: string }> = [
  { value: 'all',           label: 'Todas' },
  { value: 'BEFORE_PHOTO',  label: 'Antes' },
  { value: 'AFTER_PHOTO',   label: 'Depois' },
  { value: 'PROGRESS_PHOTO', label: 'Progresso' },
  { value: 'GALLERY_PHOTO', label: 'Sem classificação' },
]

interface PhotoFilterPillsProps {
  value: PhotoCategory | 'all'
  onChange: (value: PhotoCategory | 'all') => void
  takenAtFrom?: string
  takenAtTo?: string
  onDateFromChange?: (value: string) => void
  onDateToChange?: (value: string) => void
  className?: string
}

export function PhotoFilterPills({
  value,
  onChange,
  takenAtFrom,
  takenAtTo,
  onDateFromChange,
  onDateToChange,
  className,
}: PhotoFilterPillsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            value === opt.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:border-primary/60',
          )}
        >
          {opt.label}
        </button>
      ))}

      {onDateFromChange && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">De</span>
          <input
            type="date"
            value={takenAtFrom ?? ''}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
          />
        </div>
      )}

      {onDateToChange && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={takenAtTo ?? ''}
            onChange={(e) => onDateToChange(e.target.value)}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
          />
        </div>
      )}
    </div>
  )
}
