'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Package, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
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

      <div className="grid grid-cols-3 gap-3">
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
      </div>

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

export default function ProductsPage() {
  const [tab, setTab] = useState<PageTab>('catalog')
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [selling, setSelling] = useState<Product | null>(null)

  const { data: products, isLoading } = useProducts()
  const { data: sales, isLoading: salesLoading } = useProductSales()
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
    if (!confirm('Excluir este produto?')) return
    try {
      await deleteProduct.mutateAsync(id)
      toast.success('Produto removido')
    } catch {
      toast.error('Erro ao remover produto')
    }
  }

  const lowStock = products?.items.filter((p) => p.stock <= p.minStock && p.active) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Produtos</h2>
          <p className="text-sm text-muted-foreground">Catálogo e vendas de produtos</p>
        </div>
        {tab === 'catalog' && (
          <Button onClick={() => setCreating(true)}>+ Novo Produto</Button>
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
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 pl-4 pr-2 text-left font-medium">Nome</th>
                <th className="px-2 py-3 text-left font-medium">Categoria</th>
                <th className="px-2 py-3 text-left font-medium">Marca</th>
                <th className="px-2 py-3 text-right font-medium">Preço</th>
                <th className="px-2 py-3 text-right font-medium">Estoque</th>
                <th className="px-2 py-3 text-center font-medium">Status</th>
                <th className="px-2 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && products?.items.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
              {products?.items.map((p) => {
                const isLow = p.stock <= p.minStock
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pl-4 pr-2 font-medium">
                      {p.name}
                      {p.sku && <span className="ml-1 text-xs text-muted-foreground">#{p.sku}</span>}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                    <td className="px-2 py-3 text-muted-foreground">{p.brand ?? '—'}</td>
                    <td className="px-2 py-3 text-right font-medium">{formatCurrency(p.price)}</td>
                    <td className={`px-2 py-3 text-right font-medium ${isLow ? 'text-amber-700' : ''}`}>
                      {p.stock} {p.unit}
                      {isLow && <span className="ml-1 text-xs">(baixo)</span>}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                        {p.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-700 hover:text-green-800"
                          onClick={() => setSelling(p)}
                          disabled={!p.active || p.stock <= 0}
                        >
                          Vender
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Editar</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(p.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sales history */}
      {tab === 'sales' && (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 pl-4 pr-2 text-left font-medium">Data</th>
                <th className="px-2 py-3 text-left font-medium">Produto</th>
                <th className="px-2 py-3 text-left font-medium">Cliente</th>
                <th className="px-2 py-3 text-right font-medium">Qtd</th>
                <th className="px-2 py-3 text-right font-medium">Unit.</th>
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
                  <td className="px-2 py-3 text-muted-foreground">{s.customer?.name ?? '—'}</td>
                  <td className="px-2 py-3 text-right">{s.quantity} {s.product.unit}</td>
                  <td className="px-2 py-3 text-right text-muted-foreground">{formatCurrency(s.unitPrice)}</td>
                  <td className="px-2 py-3 text-right font-medium">{formatCurrency(s.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  )
}
