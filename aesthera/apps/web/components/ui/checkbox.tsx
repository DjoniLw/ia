'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckboxProps {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Checkbox({ id, checked, onCheckedChange, disabled, className }: CheckboxProps) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-gray-300 dark:border-gray-600 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-background',
        className,
      )}
    >
      {checked && <Check className="h-3 w-3 stroke-[3]" />}
    </button>
  )
}
