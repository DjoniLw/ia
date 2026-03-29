'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxItem {
  value: string
  label: string
  sublabel?: string
}

interface ComboboxSearchProps {
  value: ComboboxItem | null
  onChange: (item: ComboboxItem | null) => void
  onSearch: (query: string) => void
  items: ComboboxItem[]
  placeholder?: string
  debounceMs?: number
  isLoading?: boolean
  className?: string
}

/**
 * ComboboxSearch — campo de busca com dropdown de resultados.
 *
 * Padrão Aesthera para campos que carregam entidades da API
 * (clientes, serviços, profissionais, insumos etc.).
 *
 * Props:
 * - value / onChange: item selecionado (controlado)
 * - onSearch(query): chamada com debounce ao digitar — o pai é responsável por atualizar `items`
 * - items: lista a exibir no dropdown
 * - placeholder: texto do campo vazio
 * - debounceMs: delay interno (padrão 250ms)
 * - isLoading: exibe "Buscando..." enquanto verdadeiro
 */
export function ComboboxSearch({
  value,
  onChange,
  onSearch,
  items,
  placeholder = 'Buscar…',
  debounceMs = 250,
  isLoading = false,
  className,
}: ComboboxSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  function handleInput(v: string) {
    setQuery(v)
    setOpen(true)
    if (!v) onChange(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(v), debounceMs)
  }

  function handleSelect(item: ComboboxItem) {
    onChange(item)
    setQuery('')
    setOpen(false)
  }

  function handleFocus() {
    setQuery('')
    setOpen(true)
    onSearch('')
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150)
  }

  function handleClear() {
    onChange(null)
    setQuery('')
    onSearch('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex h-8 items-center gap-2 rounded-full border border-input bg-card px-3">
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value && !open ? value.label : query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={value ? value.label : placeholder}
          className="flex-1 bg-transparent text-xs focus:outline-none"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground text-xs"
            aria-label="Limpar seleção"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border bg-background shadow-lg max-h-48 overflow-auto">
          {isLoading ? (
            <p className="p-3 text-xs text-muted-foreground">Buscando...</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Nenhum resultado encontrado</p>
          ) : (
            items.map((item) => (
              <button
                key={item.value}
                type="button"
                className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(item)}
              >
                <span className="font-medium">{item.label}</span>
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
