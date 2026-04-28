'use client'
import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ──── Context ─────────────────────────────────────────────────────────────────

interface SelectContextValue {
  value: string
  open: boolean
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  handleSelect: (value: string, label: string) => void
  registerLabel: (value: string, label: string) => void
  labelsMap: React.RefObject<Map<string, string>>
  labelVersion: number
  contentId: string
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectCtx() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('Select compound components must be used within <Select>')
  return ctx
}

// ──── Select (root) ───────────────────────────────────────────────────────────

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  children: React.ReactNode
}

export function Select({ value, onValueChange, defaultValue = '', children }: SelectProps) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [labelVersion, setLabelVersion] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const labelsMap = React.useRef<Map<string, string>>(new Map())
  const uid = React.useId()
  const contentId = `select-content-${uid.replace(/:/g, '')}`

  const resolvedValue = isControlled ? (value ?? '') : internalValue

  const handleSelect = React.useCallback(
    (v: string, label: string) => {
      labelsMap.current.set(v, label)
      if (!isControlled) setInternalValue(v)
      onValueChange?.(v)
      setOpen(false)
    },
    [isControlled, onValueChange],
  )

  const registerLabel = React.useCallback((v: string, label: string) => {
    labelsMap.current.set(v, label)
    setLabelVersion((n) => n + 1)
  }, [])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <SelectContext.Provider
      value={{ value: resolvedValue, open, setOpen, handleSelect, registerLabel, labelsMap, labelVersion, contentId }}
    >
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

// ──── SelectTrigger ───────────────────────────────────────────────────────────

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

export function SelectTrigger({ children, className }: SelectTriggerProps) {
  const { open, setOpen, contentId } = useSelectCtx()
  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={contentId}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
      <ChevronDown
        className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')}
      />
    </button>
  )
}

// ──── SelectValue ─────────────────────────────────────────────────────────────

interface SelectValueProps {
  placeholder?: string
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const { value, labelsMap, labelVersion } = useSelectCtx()
  // labelVersion is read here so SelectValue re-renders when a new label is registered
  const label = value && labelVersion >= 0 ? (labelsMap.current.get(value) ?? value) : undefined
  return (
    <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>
      {label ?? placeholder ?? 'Selecione…'}
    </span>
  )
}

// ──── SelectContent ───────────────────────────────────────────────────────────

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

export function SelectContent({ children, className }: SelectContentProps) {
  const { open, contentId } = useSelectCtx()
  if (!open) {
    // Render hidden so SelectItems register their labels even when the dropdown is closed
    return <div className="hidden" aria-hidden="true">{children}</div>
  }
  return (
    <div
      id={contentId}
      role="listbox"
      className={cn(
        'absolute z-50 mt-1 w-full rounded-md border bg-card shadow-lg',
        className,
      )}
    >
      <div className="p-1">{children}</div>
    </div>
  )
}

// ──── SelectItem ──────────────────────────────────────────────────────────────

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function SelectItem({ value, children, className }: SelectItemProps) {
  const ctx = useSelectCtx()
  const isSelected = ctx.value === value
  const label = typeof children === 'string' ? children : value

  // Register label on mount so SelectValue can resolve it
  React.useEffect(() => {
    ctx.registerLabel(value, label)
  }, [value, label, ctx.registerLabel])

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => ctx.handleSelect(value, label)}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none',
        isSelected && 'bg-accent font-medium',
        className,
      )}
    >
      <span className="flex-1 text-left">{children}</span>
      {isSelected && <Check className="ml-2 h-4 w-4 shrink-0" />}
    </button>
  )
}
