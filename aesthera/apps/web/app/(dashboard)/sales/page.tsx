'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Package, Plus, ShoppingCart } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type ProductSale, useCustomers, useProductSales, useProducts, useSellProduct } from '@/lib/hooks/use-resources'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  card: 'Cartão',
  transfer: 'Transferência',
}

// ──── New Sale Schema ──────────────────────────────────────────────────────────

const saleSchema = z.object({
  productId: z.string().min(1, 'Selecione um produto'),
  customerId: z.string().optional(),
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que 0'),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(['cash', 'pix', 'card', 'transfer']).optional(),
  notes: z.string().optional(),
})
type SaleFormData = z.infer<typeof saleSchema>

// ──── New Sale Form ────────────────────────────────────────────────────────────

function NewSaleForm({ onClose }: { onClose: () => void }) {
  const { data: products } = useProducts({ active: 'true', limit: '100' })
  const { data: customers } = useCustomers()
  const sell = useSellProduct()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: { quantity: 1, discount: 0 },
  })

  const selectedProductId = watch('productId')
  const quantity = watch('quantity') || 1
  const discount = watch('discount') || 0

  const selectedProduct = products?.items.find((p) => p.id === selectedProductId)
  const unitPrice = selectedProduct?.price ?? 0
  const total = Math.max(0, unitPrice * quantity - Math.round((discount || 0) * 100))

  async function onSubmit(data: SaleFormData) {
    try {
      await sell.mutateAsync({
        productId: data.productId,
        customerId: data.customerId || null,
        quantity: data.quantity,
        discount: Math.min(Math.round((data.discount || 0) * 100), unitPrice * data.quantity),
        paymentMethod: data.paymentMethod || null,
        notes: data.notes || null,
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
        <select
          {...register('productId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Selecione um produto…</option>
          {products?.items.map((p) => (
            <option key={p.id} value={p.id} disabled={p.stock <= 0}>
              {p.name} — {formatCurrency(p.price)} — Estoque: {p.stock} {p.unit}
              {p.stock <= 0 ? ' (sem estoque)' : ''}
            </option>
          ))}
        </select>
        {errors.productId && <p className="text-xs text-red-500">{errors.productId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="1"
            max={selectedProduct?.stock ?? 999}
            {...register('quantity')}
          />
          {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Desconto (R$)</Label>
          <Input type="number" min="0" step="0.01" {...register('discount')} />
          {errors.discount && <p className="text-xs text-destructive">{errors.discount.message}</p>}
        </div>
      </div>

      {selectedProduct && (
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(unitPrice * quantity)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Desconto</span>
              <span>- {formatCurrency(Math.round((discount || 0) * 100))}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span className="text-green-600">{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Cliente (opcional)</Label>
        <select
          {...register('customerId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sem cliente vinculado</option>
          {customers?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Forma de pagamento</Label>
        <select
          {...register('paymentMethod')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Não informado</option>
          <option value="cash">Dinheiro</option>
          <option value="pix">PIX</option>
          <option value="card">Cartão</option>
          <option value="transfer">Transferência</option>
        </select>
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

export default function SalesPage() {
  const [newSale, setNewSale] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const params: Record<string, string> = {
    page: String(page),
    limit: '20',
    from,
    to,
    ...(debouncedSearch && { search: debouncedSearch }),
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
            className="rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
            className="rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <Input
            placeholder="Buscar por produto ou cliente…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="h-8 w-48 text-sm"
          />
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
                      {sale.paymentMethod ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                        </span>
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

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Página {data.page} de {Math.ceil(data.total / data.limit)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-muted/50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.total / data.limit)}
                className="rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-muted/50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

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
