'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

// ──── Context ─────────────────────────────────────────────────────────────────

interface CollapsibleContextValue {
  open: boolean
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleCtx() {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error('Collapsible compound components must be used within <Collapsible>')
  return ctx
}

// ──── Collapsible (root) ──────────────────────────────────────────────────────

interface CollapsibleProps {
  children: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function Collapsible({
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
}: CollapsibleProps) {
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const resolvedOpen = isControlled ? (open ?? false) : internalOpen

  const setOpen = React.useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === 'function' ? v(resolvedOpen) : v
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, resolvedOpen, onOpenChange],
  )

  return (
    <CollapsibleContext.Provider value={{ open: resolvedOpen, setOpen }}>
      <div className={cn(className)}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

// ──── CollapsibleTrigger ──────────────────────────────────────────────────────

interface CollapsibleTriggerProps {
  children: React.ReactNode
  className?: string
}

export function CollapsibleTrigger({ children, className }: CollapsibleTriggerProps) {
  const { setOpen } = useCollapsibleCtx()
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn('w-full text-left', className)}
    >
      {children}
    </button>
  )
}

// ──── CollapsibleContent ──────────────────────────────────────────────────────

interface CollapsibleContentProps {
  children: React.ReactNode
  className?: string
}

export function CollapsibleContent({ children, className }: CollapsibleContentProps) {
  const { open } = useCollapsibleCtx()
  if (!open) return null
  return <div className={cn(className)}>{children}</div>
}
