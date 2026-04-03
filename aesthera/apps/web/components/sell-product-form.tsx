'use client'

/**
 * Formulário compartilhado de venda de produto.
 * Utilizado em dois pontos da aplicação:
 *   1. /sales        — Nova Venda (sem produto pré-selecionado, picker habilitado)
 *   2. /products     — Registrar Venda (produto pré-selecionado via `defaultProduct`)
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Search, Tag } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCustomers, useProducts, useSellProduct } from '@/lib/hooks/use-resources'
import { useActivePromotionsForProduct } from '@/lib/hooks/use-promotions'
import { ComboboxSearch, type ComboboxItem } from '@/components/ui/combobox-search'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function parseCurrencyInput(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return 0
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Dinheiro' },
  { value: 'pix',      label: 'PIX' },
  { value: 'card',     label: 'Cartão' },
  { value: 'transfer', label: 'Transferência' },
] as const

const saleSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que 0'),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
})
type SaleFormData = z.infer<typeof saleSchema>

// ──── CustomerSearchInput ──────────────────────────────────────────────────────

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

// ──── Props ────────────────────────────────────────────────────────────────────

export interface DefaultSaleProduct {
  id: string
  name: string
  price: number
  stock: number
  unit: string
  brand?: string | null
}

interface SellProductFormProps {
  onClose: () => void
  /** Quando fornecido, o produto fica pré-selecionado e o picker é ocultado. */
  defaultProduct?: DefaultSaleProduct | null
}

// ──── Form ─────────────────────────────────────────────────────────────────────

export function SellProductForm({ onClose, defaultProduct = null }: SellProductFormProps) {
  const { data: products } = useProducts({ active: 'true', limit: '100' })
  const sell = useSellProduct()

  const [selectedProduct, setSelectedProduct] = useState<ComboboxItem | null>(
    defaultProduct ? { value: defaultProduct.id, label: defaultProduct.name } : null,
  )
  const [productSearch, setProductSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)

  // Múltiplas formas de pagamento
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
    if (defaultProduct) return []
    const q = productSearch.trim().toLowerCase()
    return (products?.items ?? [])
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: `${formatCurrency(p.price)} · Estoque: ${p.stock} ${p.unit}${p.stock <= 0 ? ' — sem estoque' : ''}`,
      }))
  }, [products, productSearch, defaultProduct])

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

  // Dados do produto: defaultProduct se travado, senão buscar na lista
  const selectedProductObj =
    defaultProduct && selectedProductId === defaultProduct.id
      ? defaultProduct
      : products?.items.find((p) => p.id === selectedProductId)

  const unitPrice = selectedProductObj?.price ?? 0

  // Promoções ativas para o produto selecionado
  const { data: activePromotions } = useActivePromotionsForProduct(selectedProductId, !!selectedProductId)

  const specificPromotion = activePromotions?.find(
    (p) => p.applicableProductIds.includes(selectedProductId),
  ) ?? null
  const universalPromotion = activePromotions?.find(
    (p) => p.applicableProductIds.length === 0
  ) ?? null
  const [appliedUniversalPromo, setAppliedUniversalPromo] = useState<typeof universalPromotion>(null)
  const [specificDismissed, setSpecificDismissed] = useState(false)

  useEffect(() => { setAppliedUniversalPromo(null); setSpecificDismissed(false) }, [selectedProductId])

  const autoPromotion = (!specificDismissed && specificPromotion)
    ? specificPromotion
    : appliedUniversalPromo

  const promoDiscount = autoPromotion
    ? autoPromotion.discountType === 'PERCENTAGE'
      ? Math.floor((unitPrice * quantity * autoPromotion.discountValue) / 100)
      : Math.min(autoPromotion.discountValue, unitPrice * quantity)
    : 0

  const manualDiscount = Math.round((discount || 0) * 100)
  const appliedDiscount = promoDiscount > 0 ? promoDiscount : manualDiscount
  const total = Math.max(0, unitPrice * quantity - appliedDiscount)

  const totalPaid = payLines.reduce((sum, l) => sum + parseCurrencyInput(l.amountStr), 0)
  const diffCents = totalPaid - total
  const troco = diffCents > 0 ? diffCents : 0
  const falta = diffCents < 0 ? -diffCents : 0

  async function onSubmit(data: SaleFormData) {
    if (!selectedProduct) return
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
      {/* Produto — header travado ou picker */}
      {defaultProduct ? (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="font-semibold">{defaultProduct.name}</p>
          <p className="text-sm text-muted-foreground">
            {defaultProduct.brand ? `${defaultProduct.brand} · ` : ''}
            Preço: {formatCurrency(defaultProduct.price)} · Estoque: {defaultProduct.stock} {defaultProduct.unit}
          </p>
        </div>
      ) : (
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
      )}

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
          {selectedProductObj && selectedProductObj.stock === 0 && (
            <p className="text-xs text-destructive">Produto sem estoque disponível</p>
          )}
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
          {specificPromotion && !specificDismissed && (
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
                onClick={() => { setAppliedUniversalPromo(null); setSpecificDismissed(false) }}
                className="text-green-700 hover:text-green-900 dark:text-green-400"
              >✕</button>
            </div>
          )}
          {universalPromotion && !appliedUniversalPromo && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-800/60 dark:bg-blue-950/40">
              <span className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
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
                onClick={() => {
                  if (specificPromotion && !specificDismissed) setSpecificDismissed(true)
                  setAppliedUniversalPromo(universalPromotion)
                }}
                className="shrink-0 rounded-full border border-blue-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              >
                {specificPromotion && !specificDismissed ? 'Usar esta' : 'Aplicar'}
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
        <div className="space-y-3">
          {payLines.map((line) => (
            <div key={line.id} className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => updatePayLine(line.id, { method: m.value })}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      line.method === m.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-card text-muted-foreground hover:bg-accent',
                    ].join(' ')}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={line.amountStr}
                  onChange={(e) => updatePayLine(line.id, { amountStr: e.target.value })}
                  placeholder="0,00"
                  className="h-9 flex-1 text-sm"
                />
                {payLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePayLine(line.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >✕</button>
                )}
              </div>
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
          {(isSubmitting || sell.isPending) ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Registrando…</>
          ) : (
            'Registrar venda'
          )}
        </Button>
      </div>
    </form>
  )
}
