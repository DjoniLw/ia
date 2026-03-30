'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ChevronDown, Info, Package, Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type Product,
  useCreateProduct,
  useCustomers,
  useDeleteProduct,
  useProductSales,
  useProducts,
  useSellProduct,
  useUpdateProduct,
} from '@/lib/hooks/use-resources'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import { DataPagination } from '@/components/ui/data-pagination'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function parseCurrencyInput(value: string): number {
  return Math.round(parseFloat(value.replace(',', '.')) * 100) || 0
}

// ──── Product Schema ───────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.string().min(1, 'Preço obrigatório'),
  costPrice: z.string().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  unit: z.string().default('un'),
  ncm: z.string().max(10).optional(),
  cest: z.string().max(9).optional(),
  cfop: z.string().max(5).optional(),
})
type ProductFormData = z.infer<typeof productSchema>

// ──── Product Form ─────────────────────────────────────────────────────────────

function ProductForm({
  defaultValues,
  onSave,
  isPending,
  onDirtyChange,
}: {
  defaultValues?: Partial<ProductFormData>
  onSave: (data: ProductFormData) => Promise<void>
  isPending: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues,
  })

  const [fiscalOpen, setFiscalOpen] = useState(false)

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input {...register('name')} placeholder="Creme hidratante facial" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input {...register('category')} placeholder="Hidratantes, Óleos…" />
        </div>
        <div className="space-y-2">
          <Label>Marca</Label>
          <Input {...register('brand')} placeholder="Ex: Vichy" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <textarea
          {...register('description')}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          placeholder="Descrição do produto…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Preço de venda (R$) *</Label>
          <Input {...register('price')} placeholder="59,90" inputMode="decimal" />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Custo (R$)</Label>
          <Input {...register('costPrice')} placeholder="30,00" inputMode="decimal" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Estoque atual</Label>
          <Input {...register('stock')} type="number" min={0} />
        </div>
        <div className="space-y-2">
          <Label>Estoque mínimo</Label>
          <Input {...register('minStock')} type="number" min={0} />
        </div>
        <div className="space-y-2">
          <Label>Unidade</Label>
          <select {...register('unit')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="un">un</option>
            <option value="ml">ml</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="l">l</option>
            <option value="cx">cx</option>
            <option value="amp">amp</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>SKU / Referência</Label>
          <Input {...register('sku')} placeholder="PROD-001" />
        </div>
        <div className="space-y-2">
          <Label>Código de barras</Label>
          <Input {...register('barcode')} placeholder="7891234567890" />
        </div>
      </div>

      <Collapsible open={fiscalOpen} onOpenChange={setFiscalOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1">
          <ChevronDown
            className={`h-4 w-4 transition-transform ${fiscalOpen ? 'rotate-0' : '-rotate-90'}`}
          />
          Dados fiscais (opcional)
        </CollapsibleTrigger>
        <CollapsibleContent className="grid grid-cols-3 gap-3 pt-3">
          <div className="space-y-2">
            <Label>NCM</Label>
            <Input {...register('ncm')} placeholder="00000000" maxLength={10} />
          </div>
          <div className="space-y-2">
            <Label>CEST</Label>
            <Input {...register('cest')} placeholder="0000000" maxLength={9} />
          </div>
          <div className="space-y-2">
            <Label>CFOP</Label>
            <Input {...register('cfop')} placeholder="5102" maxLength={5} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

// ──── Sell Dialog ──────────────────────────────────────────────────────────────

const sellSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que 0'),
  customerId: z.string().optional(),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
})
type SellFormData = z.infer<typeof sellSchema>

function SellDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const sell = useSellProduct()
  const { data: customers } = useCustomers()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SellFormData>({
    resolver: zodResolver(sellSchema),
    defaultValues: { quantity: 1, discount: 0 },
  })

  const qty = watch('quantity') || 0
  const disc = watch('discount') || 0
  const total = Math.max(0, product.price * qty - Math.round(disc * 100))

  async function onSell(data: SellFormData) {
    try {
      await sell.mutateAsync({
        productId: product.id,
        customerId: data.customerId || null,
        quantity: data.quantity,
        discount: Math.round((data.discount || 0) * 100),
        notes: data.notes || null,
      })
      toast.success('Venda registrada com sucesso')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao registrar venda')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSell)} className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="font-semibold">{product.name}</p>
        <p className="text-sm text-muted-foreground">
          {product.brand ? `${product.brand} · ` : ''}
          Preço: {formatCurrency(product.price)} · Estoque: {product.stock} {product.unit}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input {...register('quantity')} type="number" min={1} max={product.stock} />
          {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Desconto (R$)</Label>
          <Input {...register('discount')} type="number" min={0} step={0.01} placeholder="0,00" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cliente (opcional)</Label>
        <select {...register('customerId')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Venda avulsa</option>
          {customers?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input {...register('notes')} placeholder="Observação opcional…" />
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-3">
        <span className="font-medium">Total</span>
        <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={sell.isPending}>
          {sell.isPending ? 'Registrando…' : 'Confirmar Venda'}
        </Button>
      </div>
    </form>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

type PageTab = 'catalog' | 'sales'

type ProductStatusFilter = 'all' | 'active' | 'inactive'
const PRODUCT_STATUS_LABELS: Record<ProductStatusFilter, string> = { all: 'Todos', active: 'Ativos', inactive: 'Inativos' }

function ProductsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const catalogPagination = usePaginatedQuery({ defaultPageSize: 20, paramPrefix: 'catalog' })
  const salesPagination = usePaginatedQuery({ defaultPageSize: 20, paramPrefix: 'sale' })

  const [tab, setTab] = useState<PageTab>('catalog')
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [selling, setSelling] = useState<Product | null>(null)

  // ── Catalog Filters ──
  const [productSearch, setProductSearch] = usePersistedFilter('aesthera-filter-products-search', searchParams.get('q'), '')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState(productSearch)
  const [productStatusFilter, setProductStatusFilter] = usePersistedFilter<ProductStatusFilter>('aesthera-filter-products-status', searchParams.get('status') as ProductStatusFilter | null, 'all')

  const isDefaultProductFilters = productSearch === '' && productStatusFilter === 'all'

  function resetProductFilters() {
    setProductSearch('')
    setProductStatusFilter('all')
    catalogPagination.resetPage()
  }

  function buildProductFilterLabel(): string {
    const parts: string[] = []
    const statusMap: Record<ProductStatusFilter, string> = { all: 'todos', active: 'apenas ativos', inactive: 'apenas inativos' }
    parts.push(statusMap[productStatusFilter])
    if (productSearch) parts.push(`busca: ${productSearch}`)
    return parts.join(' · ')
  }

  // Debounce product search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedProductSearch(productSearch); catalogPagination.resetPage() }, 250)
    return () => clearTimeout(t)
  }, [productSearch])

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    productSearch ? p.set('q', productSearch) : p.delete('q')
    productStatusFilter !== 'all' ? p.set('status', productStatusFilter) : p.delete('status')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams, productSearch, productStatusFilter])

  const catalogParams: Record<string, string> = {
    ...catalogPagination.paginationParams,
    ...(debouncedProductSearch && { search: debouncedProductSearch }),
    ...(productStatusFilter === 'active' && { active: 'true' }),
    ...(productStatusFilter === 'inactive' && { active: 'false' }),
  }
  const salesParams: Record<string, string> = {
    ...salesPagination.paginationParams,
  }

  const { data: products, isLoading } = useProducts(catalogParams)
  const { data: sales, isLoading: salesLoading } = useProductSales(salesParams)
  const { data: lowStockData } = useProducts({ active: 'true', limit: '200' })
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct(editing?.id ?? '')
  const deleteProduct = useDeleteProduct()

  async function handleCreate(formData: ProductFormData) {
    try {
      await createProduct.mutateAsync({
        name: formData.name,
        description: formData.description ?? null,
        category: formData.category ?? null,
        brand: formData.brand ?? null,
        sku: formData.sku ?? null,
        barcode: formData.barcode ?? null,
        price: parseCurrencyInput(formData.price),
        costPrice: formData.costPrice ? parseCurrencyInput(formData.costPrice) : null,
        stock: formData.stock ?? 0,
        minStock: formData.minStock ?? 0,
        unit: formData.unit ?? 'un',
        imageUrl: null,
        ncm: formData.ncm ?? null,
        cest: formData.cest ?? null,
        cfop: formData.cfop ?? null,
      } as Parameters<typeof createProduct.mutateAsync>[0])
      toast.success('Produto criado')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar produto')
    }
  }

  async function handleUpdate(formData: ProductFormData) {
    try {
      await updateProduct.mutateAsync({
        name: formData.name,
        description: formData.description ?? null,
        category: formData.category ?? null,
        brand: formData.brand ?? null,
        sku: formData.sku ?? null,
        barcode: formData.barcode ?? null,
        price: parseCurrencyInput(formData.price),
        costPrice: formData.costPrice ? parseCurrencyInput(formData.costPrice) : null,
        stock: formData.stock ?? 0,
        minStock: formData.minStock ?? 0,
        unit: formData.unit ?? 'un',
        ncm: formData.ncm ?? null,
        cest: formData.cest ?? null,
        cfop: formData.cfop ?? null,
      })
      toast.success('Produto atualizado')
      setEditing(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao atualizar produto')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct.mutateAsync(id)
      toast.success('Produto removido')
      setDeleting(null)
    } catch {
      toast.error('Erro ao remover produto')
    }
  }

  const lowStock = (lowStockData?.items ?? []).filter((p) => p.stock <= p.minStock && p.active)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Produtos</h2>
          <p className="text-sm text-muted-foreground">Catálogo e vendas de produtos</p>
        </div>
        {tab === 'catalog' && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
          <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {lowStock.length} produto(s) com estoque baixo ou zerado:{' '}
            <span className="font-medium">{lowStock.map((p) => p.name).join(', ')}</span>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-lg border overflow-hidden w-fit">
        {(['catalog', 'sales'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {t === 'catalog' ? <><Package className="h-4 w-4" /> Catálogo</> : <><ShoppingCart className="h-4 w-4" /> Vendas</>}
          </button>
        ))}
      </div>

      {/* Product catalog */}
      {tab === 'catalog' && (
        <>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por nome…"
                className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {(['all', 'active', 'inactive'] as ProductStatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => { setProductStatusFilter(s); catalogPagination.resetPage() }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  productStatusFilter === s
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {PRODUCT_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Exibindo {buildProductFilterLabel()}</span>
            {!isDefaultProductFilters && (
              <button type="button" onClick={resetProductFilters} className="ml-auto shrink-0 font-medium text-primary hover:underline">
                Restaurar padrão
              </button>
            )}
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 pl-4 pr-2 text-left font-medium">Nome</th>
                <th className="hidden sm:table-cell px-2 py-3 text-left font-medium">Categoria</th>
                <th className="hidden sm:table-cell px-2 py-3 text-left font-medium">Marca</th>
                <th className="px-2 py-3 text-right font-medium">Preço</th>
                <th className="px-2 py-3 text-right font-medium">Estoque</th>
                <th className="hidden sm:table-cell px-2 py-3 text-center font-medium">Status</th>
                <th className="px-2 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && !(products?.items?.length) && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
              {(products?.items ?? []).map((p) => {
                const isLow = p.stock <= p.minStock
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pl-4 pr-2 font-medium">
                      {p.name}
                      {p.sku && <span className="ml-1 text-xs text-muted-foreground">#{p.sku}</span>}
                    </td>
                    <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                    <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">{p.brand ?? '—'}</td>
                    <td className="px-2 py-3 text-right font-medium">{formatCurrency(p.price)}</td>
                    <td className={`px-2 py-3 text-right font-medium ${isLow ? 'text-amber-700' : ''}`}>
                      {p.stock} {p.unit}
                      {isLow && <span className="ml-1 text-xs">(baixo)</span>}
                    </td>
                    <td className="hidden sm:table-cell px-2 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                        {p.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Vender produto"
                          aria-label="Vender produto"
                          className="text-green-700 hover:text-green-800"
                          onClick={() => setSelling(p)}
                          disabled={!p.active || p.stock <= 0}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Editar produto" aria-label="Editar produto" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Remover produto"
                          aria-label="Remover produto"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>

        <DataPagination
          page={catalogPagination.page}
          pageSize={catalogPagination.pageSize}
          total={products?.total ?? 0}
          onPageChange={catalogPagination.setPage}
          onPageSizeChange={catalogPagination.setPageSize}
        />
        </>
      )}

      {/* Sales history */}
      {tab === 'sales' && (
        <>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 pl-4 pr-2 text-left font-medium">Data</th>
                <th className="px-2 py-3 text-left font-medium">Produto</th>
                <th className="hidden sm:table-cell px-2 py-3 text-left font-medium">Cliente</th>
                <th className="hidden sm:table-cell px-2 py-3 text-right font-medium">Qtd</th>
                <th className="hidden sm:table-cell px-2 py-3 text-right font-medium">Unit.</th>
                <th className="px-2 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {salesLoading && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!salesLoading && sales?.items.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma venda registrada.</td></tr>
              )}
              {sales?.items.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 pl-4 pr-2 text-muted-foreground">
                    {new Date(s.soldAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-2 py-3 font-medium">{s.product.name}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">{s.customer?.name ?? '—'}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-right">{s.quantity} {s.product.unit}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-right text-muted-foreground">{formatCurrency(s.unitPrice)}</td>
                  <td className="px-2 py-3 text-right font-medium">{formatCurrency(s.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DataPagination
          page={salesPagination.page}
          pageSize={salesPagination.pageSize}
          total={sales?.total ?? 0}
          onPageChange={salesPagination.setPage}
          onPageSizeChange={salesPagination.setPageSize}
        />
        </>
      )}

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)} isDirty={formDirty}>
          <DialogTitle>Novo Produto</DialogTitle>
          <div className="mt-4">
            <ProductForm onSave={handleCreate} isPending={createProduct.isPending} onDirtyChange={setFormDirty} />
          </div>
        </Dialog>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} isDirty={formDirty}>
          <DialogTitle>Editar Produto</DialogTitle>
          <div className="mt-4">
            <ProductForm
              defaultValues={{
                name: editing.name,
                description: editing.description ?? '',
                category: editing.category ?? '',
                brand: editing.brand ?? '',
                sku: editing.sku ?? '',
                barcode: editing.barcode ?? '',
                price: (editing.price / 100).toFixed(2).replace('.', ','),
                costPrice: editing.costPrice ? (editing.costPrice / 100).toFixed(2).replace('.', ',') : '',
                stock: editing.stock,
                minStock: editing.minStock,
                unit: editing.unit,
                ncm: editing.ncm ?? '',
                cest: editing.cest ?? '',
                cfop: editing.cfop ?? '',
              }}
              onSave={handleUpdate}
              isPending={updateProduct.isPending}
              onDirtyChange={setFormDirty}
            />
          </div>
        </Dialog>
      )}

      {/* Sell dialog */}
      {selling && (
        <Dialog open onClose={() => setSelling(null)}>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Registrar Venda
          </DialogTitle>
          <div className="mt-4">
            <SellDialog product={selling} onClose={() => setSelling(null)} />
          </div>
        </Dialog>
      )}

      {/* Delete dialog */}
      {deleting && (
        <Dialog open onClose={() => setDeleting(null)}>
          <DialogTitle>Remover Produto</DialogTitle>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Remover o produto <strong>{deleting.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleting.id)}>Remover</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageContent />
    </Suspense>
  )
}
