'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2, Package, Plus, Search, ShoppingCart, Tag } from 'lucide-react'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type ProductSale, useCustomers, useProductSales, useProducts, useSellProduct } from '@/lib/hooks/use-resources'
import { useActivePromotionsForProduct } from '@/lib/hooks/use-promotions'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import { DataPagination } from '@/components/ui/data-pagination'
import { ComboboxSearch, type ComboboxItem } from '@/components/ui/combobox-search'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_BADGE_COLORS } from '@/lib/status-colors'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parseCurrencyInput(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return 0
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

// ──── New Sale Schema ──────────────────────────────────────────────────────────

const saleSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que 0'),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
})
type SaleFormData = z.infer<typeof saleSchema>

// ──── CustomerSearchInput ───────────────────────────────────────────────────────

function CustomerSearchInput({
  value,
  onChange,
  placeholder = 'Buscar cliente…',
}: {
  value: { id: string; name: string } | null
  onChange: (customer: { id: string; name: string } | null) => void
  placeholder?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [debounced, setDebounced] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const { data } = useCustomers(
    debounced.trim().length >= 1 ? { name: debounced.trim(), limit: '20' } : undefined,
  )
  const results = data?.items ?? []

  function updatePos() {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }

  function handleInput(v: string) {
    setSearch(v)
    setOpen(true)
    updatePos()
    if (!v) onChange(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebounced(v), 250)
  }

  function handleSelect(c: { id: string; name: string }) {
    onChange(c)
    setSearch('')
    setDebounced('')
    setOpen(false)
  }

  const dropdown =
    open && search.trim().length >= 1 && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed z-[9999] rounded-md border bg-background shadow-lg max-h-48 overflow-auto"
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          >
            {results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado</p>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(c)}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.phone && (
                    <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <input
          value={value && !open ? value.name : search}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { updatePos(); setSearch(''); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value ? value.name : placeholder}
          className="flex-1 bg-transparent text-sm focus:outline-none"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setSearch('') }}
            className="text-muted-foreground hover:text-foreground text-xs"
          >✕</button>
        )}
      </div>
      {dropdown}
    </div>
  )
}

// ──── New Sale Form ────────────────────────────────────────────────────────────

function NewSaleForm({ onClose }: { onClose: () => void }) {
  const { data: products } = useProducts({ active: 'true', limit: '100' })
  const sell = useSellProduct()

  const [selectedProduct, setSelectedProduct] = useState<ComboboxItem | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)

  // ── Múltiplas formas de pagamento ──────────────────────────────────────────
  const [payLines, setPayLines] = useState([{ id: 1, method: 'cash', amountStr: '' }])
  const nextPayId = useRef(2)

  function updatePayLine(id: number, patch: { method?: string; amountStr?: string }) {
    setPayLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function addPayLine() {
    setPayLines((lines) => [...lines, { id: nextPayId.current++, method: 'cash', amountStr: '' }])
  }
  function removePayLine(id: number) {
    setPayLines((lines) => lines.filter((l) => l.id !== id))
  }

  const productItems = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    return (products?.items ?? [])
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: `${formatCurrency(p.price)} · Estoque: ${p.stock} ${p.unit}${p.stock <= 0 ? ' — sem estoque' : ''}`,
      }))
  }, [products, productSearch])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: { quantity: 1, discount: 0 },
  })

  const selectedProductId = selectedProduct?.value ?? ''
  const quantity = watch('quantity') || 1
  const discount = watch('discount') || 0

  const selectedProductObj = products?.items.find((p) => p.id === selectedProductId)
  const unitPrice = selectedProductObj?.price ?? 0

  // Auto-detect active promotions for the selected product
  const { data: activePromotions } = useActivePromotionsForProduct(selectedProductId, !!selectedProductId)

  // Específica = tem applicableProductIds preenchido → aplica automaticamente
  // Universal = lista vazia → sugestão com botão Aplicar
  const specificPromotion = activePromotions?.find(
    (p) => p.applicableProductIds.includes(selectedProductId)
  ) ?? null
  const universalPromotion = (!specificPromotion
    ? activePromotions?.find((p) => p.applicableProductIds.length === 0)
    : null) ?? null
  const [appliedUniversalPromo, setAppliedUniversalPromo] = useState<typeof universalPromotion>(null)

  // Reseta promoção universal quando muda o produto
  useEffect(() => { setAppliedUniversalPromo(null) }, [selectedProductId])

  const autoPromotion = specificPromotion ?? appliedUniversalPromo

  const promoDiscount = autoPromotion
    ? autoPromotion.discountType === 'PERCENTAGE'
      ? Math.floor((unitPrice * quantity * autoPromotion.discountValue) / 100)
      : Math.min(autoPromotion.discountValue, unitPrice * quantity)
    : 0

  const manualDiscount = Math.round((discount || 0) * 100)
  const appliedDiscount = promoDiscount > 0 ? promoDiscount : manualDiscount
  const total = Math.max(0, unitPrice * quantity - appliedDiscount)

  // ── Totais de pagamento ────────────────────────────────────────────────────
  const totalPaid = payLines.reduce((sum, l) => sum + parseCurrencyInput(l.amountStr), 0)
  const diffCents = totalPaid - total
  const troco = diffCents > 0 ? diffCents : 0
  const falta = diffCents < 0 ? -diffCents : 0

  async function onSubmit(data: SaleFormData) {
    if (!selectedProduct) {
      return
    }
    const activeMethods = payLines
      .filter((l) => parseCurrencyInput(l.amountStr) > 0)
      .map((l) => l.method)
    try {
      await sell.mutateAsync({
        productId: selectedProduct.value,
        customerId: selectedCustomer?.id ?? null,
        quantity: data.quantity,
        discount: Math.min(appliedDiscount, unitPrice * data.quantity),
        paymentMethods: activeMethods,
        notes: autoPromotion
          ? `[Promoção: ${autoPromotion.code}]${data.notes ? ' ' + data.notes : ''}`
          : data.notes || null,
      })
      toast.success('Venda registrada com sucesso!')
      onClose()
    } catch {
      toast.error('Erro ao registrar venda.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Produto *</Label>
        <ComboboxSearch
          value={selectedProduct}
          onChange={setSelectedProduct}
          onSearch={setProductSearch}
          items={productItems}
          placeholder="Buscar produto…"
          className="w-full"
        />
        {!selectedProduct && <p className="text-xs text-red-500">Selecione um produto</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="1"
            max={selectedProductObj?.stock ?? 999}
            {...register('quantity')}
          />
          {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
        </div>
        {!autoPromotion && (
          <div className="space-y-2">
            <Label>Desconto (R$)</Label>
            <Input type="number" min="0" step="0.01" {...register('discount')} />
            {errors.discount && <p className="text-xs text-destructive">{errors.discount.message}</p>}
          </div>
        )}
      </div>

      {selectedProduct && (
        <>
          {specificPromotion && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-100 px-3 py-2 text-xs text-green-800 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-300">
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span>
                Promoção <span className="font-mono font-semibold">{specificPromotion.code}</span> aplicada automaticamente —{' '}
                {specificPromotion.discountType === 'PERCENTAGE'
                  ? `${specificPromotion.discountValue}% de desconto`
                  : `${formatCurrency(specificPromotion.discountValue)} de desconto`}
              </span>
            </div>
          )}
          {appliedUniversalPromo && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-green-300 bg-green-100 px-3 py-2 text-xs text-green-800 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-300">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 shrink-0" />
                Promoção <span className="font-mono font-semibold">{appliedUniversalPromo.code}</span> aplicada
              </span>
              <button
                type="button"
                onClick={() => setAppliedUniversalPromo(null)}
                className="text-green-700 hover:text-green-900 dark:text-green-400"
              >✕</button>
            </div>
          )}
          {universalPromotion && !appliedUniversalPromo && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-700 bg-blue-600 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-white">
                <Tag className="h-3 w-3 shrink-0" />
                Promoção disponível:{' '}
                <span className="font-mono font-semibold">{universalPromotion.code}</span>
                {' — '}
                {universalPromotion.discountType === 'PERCENTAGE'
                  ? `${universalPromotion.discountValue}% de desconto`
                  : `${formatCurrency(universalPromotion.discountValue)} de desconto`}
              </span>
              <button
                type="button"
                onClick={() => setAppliedUniversalPromo(universalPromotion)}
                className="shrink-0 rounded-full border border-white/60 bg-white px-2.5 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                Aplicar
              </button>
            </div>
          )}
          <div className={`rounded-lg px-4 py-3 text-sm ${autoPromotion ? 'border border-green-200 bg-green-100/60 dark:border-green-900/40 dark:bg-green-950/20' : 'bg-muted/40'}`}>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(unitPrice * quantity)}</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex justify-between font-medium text-green-700 dark:text-green-400">
                <span className="flex items-center gap-1">
                  {autoPromotion ? <><Tag className="h-3 w-3" /> Desconto ({autoPromotion.code})</> : 'Desconto'}
                </span>
                <span>- {formatCurrency(appliedDiscount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span className="text-green-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>Cliente (opcional)</Label>
        <CustomerSearchInput
          value={selectedCustomer}
          onChange={setSelectedCustomer}
          placeholder="Sem cliente vinculado — busque pelo nome…"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Forma de pagamento</Label>
          <button
            type="button"
            onClick={addPayLine}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {payLines.map((line) => (
            <div key={line.id} className="flex items-center gap-2">
              <select
                value={line.method}
                onChange={(e) => updatePayLine(line.id, { method: e.target.value })}
                className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="cash">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="card">Cartão</option>
                <option value="transfer">Transferência</option>
              </select>
              <Input
                value={line.amountStr}
                onChange={(e) => updatePayLine(line.id, { amountStr: e.target.value })}
                placeholder="0,00"
                className="h-9 w-28 text-sm"
              />
              {payLines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePayLine(line.id)}
                  className="text-muted-foreground hover:text-destructive"
                >✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Resumo de pagamento */}
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Total da venda</span>
            <span className="font-medium text-foreground">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Total informado</span>
            <span className={totalPaid > 0 ? 'font-medium text-foreground' : ''}>{formatCurrency(totalPaid)}</span>
          </div>
          {falta > 0 && (
            <div className="flex justify-between border-t pt-1 font-semibold text-red-600 dark:text-red-400">
              <span>Faltam</span>
              <span>{formatCurrency(falta)}</span>
            </div>
          )}
          {troco > 0 && (
            <div className="flex justify-between border-t pt-1 font-semibold text-green-600 dark:text-green-400">
              <span>Troco</span>
              <span>{formatCurrency(troco)}</span>
            </div>
          )}
          {totalPaid > 0 && diffCents === 0 && (
            <div className="flex justify-between border-t pt-1 font-semibold text-green-600 dark:text-green-400">
              <span>Pagamento exato</span>
              <span>✓</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input {...register('notes')} placeholder="Observações sobre a venda…" />
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isSubmitting || sell.isPending}>
          {(isSubmitting || sell.isPending) ? 'Registrando…' : 'Registrar venda'}
        </Button>
      </div>
    </form>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

function SalesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [newSale, setNewSale] = useState(false)
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })
  const [search, setSearch] = usePersistedFilter('aesthera-filter-sales-search', searchParams.get('search'), '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const [from, setFrom] = useState(searchParams.get('from') ?? defaultFrom)
  const [to, setTo] = useState(searchParams.get('to') ?? defaultTo)
  const [paymentFilter, setPaymentFilter] = usePersistedFilter('aesthera-filter-sales-payment', searchParams.get('paymentMethod'), '')

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); resetPage() }, 250)
    return () => clearTimeout(timer)
  }, [search])

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    from !== defaultFrom ? p.set('from', from) : p.delete('from')
    to !== defaultTo ? p.set('to', to) : p.delete('to')
    search ? p.set('search', search) : p.delete('search')
    paymentFilter ? p.set('paymentMethod', paymentFilter) : p.delete('paymentMethod')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams, from, to, search, paymentFilter, defaultFrom, defaultTo])

  const isDefaultFilters = from === defaultFrom && to === defaultTo && search === '' && paymentFilter === ''

  function resetFilters() {
    setFrom(defaultFrom)
    setTo(defaultTo)
    setSearch('')
    setDebouncedSearch('')
    setPaymentFilter('')
    resetPage()
  }

  function buildFilterLabel(): string {
    const parts: string[] = []
    const fromDate = new Date(from + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const toDate = new Date(to + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    parts.push(`${fromDate} a ${toDate}`)
    if (debouncedSearch) parts.push(`busca: ${debouncedSearch}`)
    if (paymentFilter) parts.push(`pagamento: ${PAYMENT_METHOD_LABELS[paymentFilter] ?? paymentFilter}`)
    return parts.join(' · ')
  }

  function applyPreset(preset: number | 'today' | '6months' | '1year') {
    const now = new Date()
    const toDate = now.toISOString().slice(0, 10)
    let fromDate: string
    if (preset === 'today') {
      fromDate = toDate
    } else if (preset === '6months') {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 6)
      fromDate = d.toISOString().slice(0, 10)
    } else if (preset === '1year') {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      fromDate = d.toISOString().slice(0, 10)
    } else {
      const d = new Date(now)
      d.setDate(d.getDate() - preset)
      fromDate = d.toISOString().slice(0, 10)
    }
    setFrom(fromDate)
    setTo(toDate)
    resetPage()
  }

  const params: Record<string, string> = {
    ...paginationParams,
    from,
    to,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(paymentFilter && { paymentMethod: paymentFilter }),
  }

  const { data, isLoading } = useProductSales(params)

  const totalRevenue = data?.items.reduce((sum, s) => sum + s.totalPrice, 0) ?? 0
  const totalItems = data?.items.reduce((sum, s) => sum + s.quantity, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Vendas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Registro de vendas de produtos</p>
        </div>
        <Button onClick={() => setNewSale(true)} size="sm" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova venda
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Receita no período</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Vendas realizadas</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{data?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Itens vendidos</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalItems}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3">

        {/* Linha 1: pills por forma de pagamento + busca textual */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 flex-wrap">
            {([
              { value: '', label: 'Todos' },
              { value: 'cash', label: 'Dinheiro' },
              { value: 'pix', label: 'PIX' },
              { value: 'card', label: 'Cartão' },
              { value: 'transfer', label: 'Transferência' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setPaymentFilter(opt.value); resetPage() }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  paymentFilter === opt.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por produto ou cliente…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
              className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Linha 2: presets de data + inputs De/Até */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 flex-wrap">
            {([
              { label: 'Hoje', preset: 'today' },
              { label: '7 dias', preset: 7 },
              { label: '30 dias', preset: 30 },
              { label: '6 meses', preset: '6months' },
              { label: '1 ano', preset: '1year' },
            ] as const).map(({ label, preset }) => (
              <button
                key={label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-input bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">De</label>
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); resetPage() }}
                className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">Até</label>
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); resetPage() }}
                className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Legenda descritiva */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Exibindo {buildFilterLabel()}</span>
          {!isDefaultFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto shrink-0 font-medium text-primary hover:underline"
            >
              Restaurar padrão
            </button>
          )}
        </div>
      </div>

      {/* Sales table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Vendas do período</h3>
          {data && (
            <span className="ml-auto text-xs text-muted-foreground">{data.total} no total</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="hidden sm:table-cell px-5 py-3">Cliente</th>
                  <th className="hidden sm:table-cell px-5 py-3 text-center">Qtd</th>
                  <th className="hidden sm:table-cell px-5 py-3">Pagamento</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((sale) => (
                  <tr key={sale.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{formatDate(sale.soldAt)}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{sale.product.name}</td>
                    <td className="hidden sm:table-cell px-5 py-3 text-muted-foreground">{sale.customer?.name ?? '—'}</td>
                    <td className="hidden sm:table-cell px-5 py-3 text-center text-muted-foreground">
                      {sale.quantity} {sale.product.unit}
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3">
                      {sale.paymentMethods.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sale.paymentMethods.map((m) => (
                            <span key={m} className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_METHOD_BADGE_COLORS[m] ?? 'bg-muted text-muted-foreground'}`}>
                              {PAYMENT_METHOD_LABELS[m] ?? m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-green-600">
                      {formatCurrency(sale.totalPrice)}
                      {sale.discount > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">(-{formatCurrency(sale.discount)})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
      <DataPagination
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* New Sale Dialog */}
      {newSale && (
        <Dialog open onClose={() => setNewSale(false)}>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Nova Venda
          </DialogTitle>
          <div className="mt-4">
            <NewSaleForm onClose={() => setNewSale(false)} />
          </div>
        </Dialog>
      )}
    </div>
  )
}

// ──── Export ───────────────────────────────────────────────────────────────────

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesPageContent />
    </Suspense>
  )
}
