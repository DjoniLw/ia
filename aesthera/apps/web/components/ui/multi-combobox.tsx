'use client'

import { useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComboboxItem } from './combobox-search'

export interface MultiComboboxProps {
  values: string[]
  onChange: (values: string[]) => void
  items: ComboboxItem[]
  placeholder?: string
  isLoading?: boolean
  className?: string
}

export function MultiCombobox({
  values,
  onChange,
  items,
  placeholder = 'Buscar…',
  isLoading,
  className,
}: MultiComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = items.filter(
    (item) =>
      !values.includes(item.value) &&
      (!query.trim() || item.label.toLowerCase().includes(query.trim().toLowerCase())),
  )

  const chipLabels = values.map((val) => ({
    value: val,
    label: items.find((i) => i.value === val)?.label ?? val,
  }))

  function addItem(item: ComboboxItem) {
    onChange([...values, item.value])
    setQuery('')
    inputRef.current?.focus()
  }

  function removeItem(value: string) {
    onChange(values.filter((v) => v !== value))
  }

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false)
    }
  }

  const showDropdown = open && (filtered.length > 0 || isLoading || query.trim().length > 0)

  return (
    <div ref={containerRef} className={cn('relative', className)} onBlur={handleBlur}>
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 cursor-text',
          'focus-within:ring-2 focus-within:ring-primary focus-within:border-primary',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {chipLabels.map(({ value, label }) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
          >
            {label}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); removeItem(value) }}
              className="ml-0.5 text-primary/60 hover:text-primary"
              aria-label={`Remover ${label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={values.length === 0 ? placeholder : ''}
          className="min-w-24 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {query.trim() ? 'Nenhum resultado' : 'Todos já selecionados'}
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addItem(item)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
              >
                {item.label}
                {item.sublabel && (
                  <span className="ml-2 text-muted-foreground">{item.sublabel}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
