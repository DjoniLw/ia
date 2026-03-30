'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Info, Loader2, PackageOpen, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ComboboxSearch, type ComboboxItem } from '@/components/ui/combobox-search'
import { useRole } from '@/lib/hooks/use-role'
import {
  type Supply,
  type SupplyPurchase,
  useCreateSupplyPurchase,
  useDeleteSupplyPurchase,
  useSupplies,
  useSupplyPurchases,
} from '@/lib/hooks/use-resources'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { DataPagination } from '@/components/ui/data-pagination'

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}

function parseDecimalInput(value: string) {
  const normalized = value.trim()
  const sanitized = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized
  if (!sanitized) return 0
  const parsed = Number.parseFloat(sanitized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseCurrencyInput(value: string) {
  return Math.round(parseDecimalInput(value) * 100)
}

function currentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const from = new Date(year, month, 1).toISOString().slice(0, 10)
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

function PurchaseForm({
  supplies,
  onSave,
  onClose,
  isPending,
  onDirtyChange,
}: {
  supplies: Supply[]
  onSave: (data: {
    supplyId: string
    supplierName?: string | null
    purchaseUnit: string
    purchaseQty: number
    conversionFactor: number
    unitCost: number
    notes?: string | null
    purchasedAt: string
  }) => Promise<void>
  onClose: () => void
  isPending: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [supplySearch, setSupplySearch] = useState('')
  const [selectedSupplyId, setSelectedSupplyId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [purchaseUnit, setPurchaseUnit] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('1')
  const [conversionFactor, setConversionFactor] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(today)
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)

  const filteredSupplies = useMemo(() => {
    const query = supplySearch.trim().toLowerCase()
    if (!query) return supplies
    return supplies.filter((supply) => supply.name.toLowerCase().includes(query))
  }, [supplies, supplySearch])

  const selectedSupply = useMemo(
    () => supplies.find((supply) => supply.id === selectedSupplyId) ?? null,
    [selectedSupplyId, supplies],
  )

  const quantityValue = parseDecimalInput(purchaseQty)
  const conversionValue = parseDecimalInput(conversionFactor)
  const unitCostValue = parseCurrencyInput(unitCost)
  const stockIncrement = Math.floor(quantityValue * conversionValue)
  const totalCost = Math.round(unitCostValue * quantityValue)

  function markDirty() {
    if (!dirty) {
      setDirty(true)
      onDirtyChange?.(true)
    }
  }

  function handleSupplyChange(value: string) {
    setSupplySearch(value)
    const match = supplies.find((supply) => supply.name.toLowerCase() === value.trim().toLowerCase())
    setSelectedSupplyId(match?.id ?? '')
    markDirty()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!selectedSupplyId) {
      toast.error('Selecione um insumo válido na lista.')
      return
    }

    if (!purchaseUnit.trim()) {
      toast.error('Informe a unidade de compra.')
      return
    }

    if (!purchasedAt) {
      toast.error('Informe a data da compra.')
      return
    }

    await onSave({
      supplyId: selectedSupplyId,
      supplierName: supplierName.trim() || null,
      purchaseUnit: purchaseUnit.trim(),
      purchaseQty: quantityValue,
      conversionFactor: conversionValue,
      unitCost: unitCostValue,
      notes: notes.trim() || null,
      purchasedAt: `${purchasedAt}T12:00:00.000Z`,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Insumo *</Label>
        <Input
          list="supply-options"
          value={supplySearch}
          onChange={(event) => handleSupplyChange(event.target.value)}
          placeholder="Digite para buscar um insumo"
          required
        />
        <datalist id="supply-options">
          {filteredSupplies.map((supply) => (
            <option key={supply.id} value={supply.name}>
              {supply.unit}
            </option>
          ))}
        </datalist>
        {selectedSupply ? (
          <p className="text-xs text-muted-foreground">
            Unidade de uso: {selectedSupply.unit} · Estoque atual: {selectedSupply.stock} {selectedSupply.unit}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Selecione um insumo existente para habilitar a prévia.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fornecedor</Label>
          <Input
            value={supplierName}
            onChange={(event) => { setSupplierName(event.target.value); markDirty() }}
            placeholder="Ex: Distribuidora Bela Pele"
          />
        </div>
        <div className="space-y-2">
          <Label>Data da compra *</Label>
          <Input
            type="date"
            value={purchasedAt}
            onChange={(event) => { setPurchasedAt(event.target.value); markDirty() }}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Unidade de compra *</Label>
          <Input
            value={purchaseUnit}
            onChange={(event) => { setPurchaseUnit(event.target.value); markDirty() }}
            placeholder="Ex: caixa"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Quantidade comprada *</Label>
          <Input
            value={purchaseQty}
            onChange={(event) => { setPurchaseQty(event.target.value); markDirty() }}
            inputMode="decimal"
            placeholder="1"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fator de conversão *</Label>
          <Input
            value={conversionFactor}
            onChange={(event) => { setConversionFactor(event.target.value); markDirty() }}
            inputMode="decimal"
            placeholder="500"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Custo unitário (R$) *</Label>
          <Input
            value={unitCost}
            onChange={(event) => { setUnitCost(event.target.value); markDirty() }}
            inputMode="decimal"
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Prévia da conversão</span>
          <span className="font-medium text-foreground">
            {purchaseUnit.trim() && selectedSupply
              ? `1 ${purchaseUnit.trim()} = ${formatNumber(conversionValue)} ${selectedSupply.unit}`
              : 'Preencha a unidade de compra e selecione um insumo'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Prévia do estoque</span>
          <span className="font-medium text-foreground">
            {selectedSupply
              ? `Estoque atual: ${selectedSupply.stock} ${selectedSupply.unit} → Após compra: ${selectedSupply.stock + stockIncrement} ${selectedSupply.unit}`
              : 'Selecione um insumo'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Estoque incrementado</span>
          <span className="font-medium text-foreground">+{stockIncrement} {selectedSupply?.unit ?? ''}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Custo total</span>
          <span className="font-medium text-foreground">{formatCurrency(totalCost)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <textarea
          value={notes}
          onChange={(event) => { setNotes(event.target.value); markDirty() }}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          placeholder="Detalhes adicionais da compra..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={isPending || !selectedSupplyId || !purchaseUnit.trim() || !purchasedAt}>
          {isPending ? 'Salvando…' : 'Registrar compra'}
        </Button>
      </div>
    </form>
  )
}

function CancelPurchaseDialog({
  purchase,
  onClose,
}: {
  purchase: SupplyPurchase
  onClose: () => void
}) {
  const cancelPurchase = useDeleteSupplyPurchase()

  async function handleConfirm() {
    try {
      await cancelPurchase.mutateAsync(purchase.id)
      toast.success('Compra cancelada com sucesso')
      onClose()
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? 'Não foi possível cancelar a compra')
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Cancelar compra</DialogTitle>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cancelar a compra de <strong>{purchase.supply.name}</strong> registrada em <strong>{formatDate(purchase.purchasedAt)}</strong>?
          O estoque será estornado em {purchase.stockIncrement} {purchase.supply.unit} se ainda houver saldo suficiente.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Voltar</Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={cancelPurchase.isPending}>
            {cancelPurchase.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function SupplyPurchasesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = useRole()
  const canManage = role === 'admin'
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [selectedSupply, setSelectedSupply] = useState<ComboboxItem | null>(null)
  const [supplySearchQuery, setSupplySearchQuery] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [{ from, to }, setRange] = useState(currentMonthRange())
  const [cancelingPurchase, setCancelingPurchase] = useState<SupplyPurchase | null>(null)
  const createPurchase = useCreateSupplyPurchase()

  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })

  const suppliesQuery = useSupplies({ active: 'true', limit: '200' })

  const supplyItems = useMemo<ComboboxItem[]>(() => {
    const q = supplySearchQuery.trim().toLowerCase()
    return (suppliesQuery.data?.items ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({ value: s.id, label: s.name, sublabel: s.unit }))
  }, [suppliesQuery.data, supplySearchQuery])

  const selectedSupplyId = selectedSupply?.value ?? ''

  const defaultFrom = currentMonthRange().from
  const defaultTo = currentMonthRange().to
  const isDefaultFilters = !selectedSupply && supplierFilter === '' && from === defaultFrom && to === defaultTo

  function resetFilters() {
    setSelectedSupply(null)
    setSupplySearchQuery('')
    setSupplierFilter('')
    setRange(currentMonthRange())
    resetPage()
  }

  function buildFilterLabel(): string {
    const parts: string[] = []
    if (from === defaultFrom && to === defaultTo) {
      parts.push('mês atual')
    } else if (from && to) {
      parts.push(`de ${new Date(from).toLocaleDateString('pt-BR')} até ${new Date(to).toLocaleDateString('pt-BR')}`)
    }
    if (selectedSupply) {
      parts.push(`insumo: ${selectedSupply.label}`)
    } else {
      parts.push('todos os insumos')
    }
    if (supplierFilter.trim()) {
      parts.push(`fornecedor: ${supplierFilter.trim()}`)
    }
    return parts.join(' · ')
  }

  const params = useMemo(() => ({
    ...paginationParams,
    ...(selectedSupplyId && { supplyId: selectedSupplyId }),
    ...(supplierFilter.trim() && { supplierName: supplierFilter.trim() }),
    ...(from && { from }),
    ...(to && { to }),
  }), [paginationParams, selectedSupplyId, supplierFilter, from, to])

  const purchasesQuery = useSupplyPurchases(params)

  useEffect(() => {
    resetPage()
  }, [selectedSupplyId, supplierFilter, from, to])

  async function handleCreate(data: Parameters<typeof createPurchase.mutateAsync>[0]) {
    try {
      await createPurchase.mutateAsync(data)
      toast.success('Compra registrada com sucesso')
      setCreating(false)
      setFormDirty(false)
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? 'Erro ao registrar compra')
    }
  }

  const totalPages = purchasesQuery.data ? Math.ceil(purchasesQuery.data.total / purchasesQuery.data.limit) : 1

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    supplierFilter.trim() ? p.set('supplier', supplierFilter.trim()) : p.delete('supplier')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams, supplierFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Compras de Insumos</h2>
          <p className="text-sm text-muted-foreground">
            Registre entradas de estoque com fator de conversão e acompanhe cancelamentos.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setFormDirty(false); setCreating(true) }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Compra
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Insumo</Label>
            <ComboboxSearch
              value={selectedSupply}
              onChange={setSelectedSupply}
              onSearch={setSupplySearchQuery}
              items={supplyItems}
              isLoading={suppliesQuery.isLoading}
              placeholder="Buscar insumo…"
              className="min-w-56"
            />
          </div>

          <div className="space-y-1">
            <Label>Fornecedor</Label>
            <Input
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
              placeholder="Buscar por fornecedor"
              className="min-w-56"
            />
          </div>

          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
          </div>

          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
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

      <div className="rounded-xl border bg-card overflow-hidden">
        {purchasesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !purchasesQuery.data || purchasesQuery.data.items.length === 0 ? (
          <div className="rounded-lg bg-card py-16 text-center text-muted-foreground">
            <PackageOpen className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhuma compra de insumo encontrada.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setFormDirty(false); setCreating(true) }}>
                Criar primeira compra
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Insumo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fornecedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Quantidade comprada</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fator de conversão</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estoque incrementado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Custo total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {purchasesQuery.data.items.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(purchase.purchasedAt)}</td>
                      <td className="px-4 py-3 font-medium">{purchase.supply.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{purchase.supplierName || '—'}</td>
                      <td className="px-4 py-3">
                        {formatNumber(purchase.purchaseQty)} {purchase.purchaseUnit}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        1 {purchase.purchaseUnit} = {formatNumber(purchase.conversionFactor)} {purchase.supply.unit}
                      </td>
                      <td className="px-4 py-3">
                        +{purchase.stockIncrement} {purchase.supply.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(purchase.totalCost)}</td>
                      <td className="px-4 py-3 text-right">
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Cancelar compra"
                            aria-label="Cancelar compra"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setCancelingPurchase(purchase)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Somente leitura</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DataPagination
              page={page}
              pageSize={pageSize}
              total={purchasesQuery.data.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {creating && (
        <Dialog
          open
          onClose={() => { setCreating(false); setFormDirty(false) }}
          isDirty={formDirty}
          className="max-w-2xl"
        >
          <DialogTitle>Nova Compra de Insumo</DialogTitle>
          <PurchaseForm
            supplies={suppliesQuery.data?.items ?? []}
            onSave={handleCreate}
            onClose={() => { setCreating(false); setFormDirty(false) }}
            isPending={createPurchase.isPending}
            onDirtyChange={setFormDirty}
          />
        </Dialog>
      )}

      {cancelingPurchase && <CancelPurchaseDialog purchase={cancelingPurchase} onClose={() => setCancelingPurchase(null)} />}
    </div>
  )
}

export default function SupplyPurchasesPage() {
  return (
    <Suspense fallback={null}>
      <SupplyPurchasesPageContent />
    </Suspense>
  )
}