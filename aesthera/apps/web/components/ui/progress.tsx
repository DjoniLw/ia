import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps {
  value?: number
  className?: string
}

export function Progress({ value = 0, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full bg-primary transition-all duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
