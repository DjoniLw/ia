'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Tag, Loader2, Pencil, ChevronDown, ChevronUp, Info, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MultiCombobox } from '@/components/ui/multi-combobox'
import type { ComboboxItem } from '@/components/ui/combobox-search'
import { DataPagination } from '@/components/ui/data-pagination'
import { PROMOTION_STATUS_COLOR } from '@/lib/status-colors'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import { useServices, useProducts, type Service, type Product } from '@/lib/hooks/use-resources'
import {
  type CreatePromotionInput,
  type Promotion,
  type PromotionStatus,
  type UpdatePromotionInput,
  useCreatePromotion,
  usePromotions,
  useTogglePromotion,
  useUpdatePromotion,
} from '@/lib/hooks/use-promotions'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

const STATUS_LABEL: Record<PromotionStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  expired: 'Expirado',
}

// ──── Create / Edit Modal ──────────────────────────────────────────────────────

function PromotionModal({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Promotion
}) {
  const today = new Date().toISOString().slice(0, 10)

  const [name, setName] = useState(editing?.name ?? '')
  const [code, setCode] = useState(editing?.code ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>(
    editing?.discountType ?? 'PERCENTAGE',
  )
  const [discountValue, setDiscountValue] = useState(
    editing ? String(editing.discountValue) : '',
  )
  const [maxUses, setMaxUses] = useState(editing?.maxUses != null ? String(editing.maxUses) : '')
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState(
    editing?.maxUsesPerCustomer != null ? String(editing.maxUsesPerCustomer) : '',
  )
  const [minAmount, setMinAmount] = useState(
    editing?.minAmount != null ? String(editing.minAmount / 100) : '',
  )
  const [validFrom, setValidFrom] = useState(
    editing ? editing.validFrom.slice(0, 10) : today,
  )
  const [validUntil, setValidUntil] = useState(editing?.validUntil?.slice(0, 10) ?? '')
  const [status, setStatus] = useState<PromotionStatus>(editing?.status ?? 'active')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(editing?.applicableServiceIds ?? [])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(editing?.applicableProductIds ?? [])

  const { data: servicesData } = useServices({ active: 'true', limit: '200' })
  const { data: productsData } = useProducts({ active: 'true', limit: '200' })
  const allServices: Service[] = servicesData?.items ?? []
  const allProducts: Product[] = productsData?.items ?? []

  const serviceItems = useMemo<ComboboxItem[]>(
    () => allServices.map((s) => ({ value: s.id, label: s.name })),
    [allServices],
  )

  const productItems = useMemo<ComboboxItem[]>(
    () => allProducts.map((p) => ({ value: p.id, label: p.name })),
    [allProducts],
  )

  const createMutation = useCreatePromotion()
  const updateMutation = useUpdatePromotion(editing?.id ?? '')

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !discountValue) {
      toast.error('Preencha os campos obrigatórios')
      return
    }

    if (validUntil && validFrom && validUntil < validFrom) {
      toast.error('"Válido até" não pode ser anterior a "Válido de"')
      return
    }

    try {
      if (editing) {
        const dto: UpdatePromotionInput = {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          status,
          maxUses: maxUses ? Number(maxUses) : null,
          maxUsesPerCustomer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : null,
          minAmount: minAmount ? Math.round(Number(minAmount) * 100) : null,
          validUntil: validUntil || null,
          applicableServiceIds: selectedServiceIds,
          applicableProductIds: selectedProductIds,
        }
        await updateMutation.mutateAsync(dto)
        toast.success('Promoção atualizada')
      } else {
        const dto: CreatePromotionInput = {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || undefined,
          discountType,
          discountValue: Number(discountValue),
          maxUses: maxUses ? Number(maxUses) : null,
          maxUsesPerCustomer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : null,
          minAmount: minAmount ? Math.round(Number(minAmount) * 100) : null,
          applicableServiceIds: selectedServiceIds,
          applicableProductIds: selectedProductIds,
          validFrom: `${validFrom}T00:00:00.000Z`,
          validUntil: validUntil ? `${validUntil}T23:59:59.999Z` : null,
        }
        await createMutation.mutateAsync(dto)
        toast.success('Promoção criada')
      }
      onClose()
    } catch {
      toast.error(editing ? 'Erro ao atualizar promoção' : 'Erro ao criar promoção')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-foreground">
            {editing ? 'Editar promoção' : 'Nova promoção'}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Black Friday 20%"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Código {editing ? '' : '*'}
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BLACKFRIDAY20"
                disabled={!!editing}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                required={!editing}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de desconto *</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PERCENTAGE">Percentual (%)</option>
                  <option value="FIXED">Valor fixo (R$)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {discountType === 'PERCENTAGE' ? 'Desconto (%) *' : 'Desconto (R$) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={discountType === 'PERCENTAGE' ? '100' : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'PERCENTAGE' ? '20' : '50'}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Limite de usos</label>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Ilimitado"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Limite por cliente</label>
              <input
                type="number"
                min="1"
                value={maxUsesPerCustomer}
                onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                placeholder="Ilimitado"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Valor mínimo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="Sem mínimo"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Válido de {editing ? '' : '*'}
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                disabled={!!editing}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                required={!editing}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Válido até</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {editing && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <div className="flex gap-2">
                {(['active', 'inactive'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      status === s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-card text-muted-foreground hover:bg-accent',
                    ].join(' ')}
                  >
                    {s === 'active' ? 'Ativo' : 'Inativo'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Serviços aplicáveis */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Serviços aplicáveis
              <span className="ml-1 font-normal text-muted-foreground/70">(vazio = todos)</span>
            </label>
            <MultiCombobox
              values={selectedServiceIds}
              onChange={setSelectedServiceIds}
              items={serviceItems}
              isLoading={!servicesData}
              placeholder="Buscar serviço…"
            />
          </div>

          {/* Produtos aplicáveis */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Produtos aplicáveis
              <span className="ml-1 font-normal text-muted-foreground/70">(vazio = todos)</span>
            </label>
            <MultiCombobox
              values={selectedProductIds}
              onChange={setSelectedProductIds}
              items={productItems}
              isLoading={!productsData}
              placeholder="Buscar produto…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editing ? 'Salvar' : 'Criar promoção'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──── Toggle Button ────────────────────────────────────────────────────────────

function ToggleStatusButton({ promotion }: { promotion: Promotion }) {
  const toggle = useTogglePromotion(promotion.id)
  const isActive = promotion.status === 'active'

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggle.mutate(!isActive)}
      disabled={toggle.isPending || promotion.status === 'expired'}
      title={isActive ? 'Desativar promoção' : 'Ativar promoção'}
    >
      {toggle.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isActive ? (
        <ToggleRight className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <ToggleLeft className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}

// ──── Usage progress ───────────────────────────────────────────────────────────

function UsageCell({ promotion }: { promotion: Promotion }) {
  const progress =
    promotion.maxUses != null && promotion.maxUses > 0
      ? Math.min(100, (promotion.usesCount / promotion.maxUses) * 100)
      : null

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">
        {promotion.usesCount}
        {promotion.maxUses != null ? ` / ${promotion.maxUses}` : ''}
      </span>
      {progress !== null && (
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

function PromotionsPageContent() {
  useSearchParams()
  const pagination = usePaginatedQuery({ defaultPageSize: 20 })
  const [statusFilter, setStatusFilter] = usePersistedFilter<PromotionStatus | ''>('aesthera-filter-promotions-status', null, '')
  const [search, setSearch] = usePersistedFilter('aesthera-filter-promotions-search', null, '')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Promotion | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = usePromotions({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
    page: parseInt(pagination.paginationParams.page),
    limit: parseInt(pagination.paginationParams.limit),
  })

  const { data: activeStats } = usePromotions({ status: 'active', limit: 1 })

  const isDefaultFilters = statusFilter === '' && search === ''

  function resetFilters() {
    setStatusFilter('')
    setSearch('')
    pagination.resetPage()
  }

  function buildFilterLabel(): string {
    const parts: string[] = []
    const map: Record<string, string> = {
      '': 'todos os status',
      active: 'Ativo',
      inactive: 'Inativo',
      expired: 'Expirado',
    }
    parts.push(map[statusFilter] ?? statusFilter)
    if (search) parts.push(`busca: ${search}`)
    return parts.join(' · ')
  }

  const statusOptions: Array<{ value: PromotionStatus | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
    { value: 'expired', label: 'Expirados' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Promoções</h2>
          <p className="text-sm text-muted-foreground">
            Códigos de desconto para clientes
          </p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Nova promoção
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código…"
              className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {statusOptions.map((s) => (
            <button
              key={s.value}
              onClick={() => { setStatusFilter(s.value); pagination.resetPage() }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
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

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Tag className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma promoção encontrada</p>
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              Criar primeira promoção
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Nome / Código</th>
                  <th className="hidden sm:table-cell px-4 py-3">Desconto</th>
                  <th className="hidden md:table-cell px-4 py-3">Usos</th>
                  <th className="hidden md:table-cell px-4 py-3">Validade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.items ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma promoção encontrada para os filtros selecionados.</td></tr>
                )}
                {(data?.items ?? []).map((promo) => (
                  <>
                    <tr key={promo.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{promo.name}</div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {promo.code}
                        </div>
                        {promo.description && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {promo.description}
                          </div>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 font-medium text-foreground">
                        {promo.discountType === 'PERCENTAGE'
                          ? `${promo.discountValue}%`
                          : formatCurrency(promo.discountValue)}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <UsageCell promotion={promo} />
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        <div>{formatDate(promo.validFrom)}</div>
                        {promo.validUntil && (
                          <div className="text-xs">até {formatDate(promo.validUntil)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROMOTION_STATUS_COLOR[promo.status]}`}
                        >
                          {STATUS_LABEL[promo.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ToggleStatusButton promotion={promo} />
                          <button
                            onClick={() =>
                              setExpandedId(expandedId === promo.id ? null : promo.id)
                            }
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            title="Ver detalhes"
                          >
                            {expandedId === promo.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditing(promo)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedId === promo.id && (
                      <tr key={`${promo.id}-expand`} className="bg-muted/10">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                            <div>
                              <span className="font-semibold text-foreground">Tipo:</span>{' '}
                              {promo.discountType === 'PERCENTAGE' ? 'Percentual' : 'Valor fixo'}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Valor mínimo:</span>{' '}
                              {promo.minAmount != null
                                ? formatCurrency(promo.minAmount)
                                : 'Sem mínimo'}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">
                                Serviços aplicáveis:
                              </span>{' '}
                              {promo.applicableServiceIds.length === 0
                                ? 'Todos'
                                : `${promo.applicableServiceIds.length} serviço(s)`}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Limite por cliente:</span>{' '}
                              {promo.maxUsesPerCustomer ?? 'Ilimitado'}
                            </div>
                            {promo.applicableProductIds.length > 0 && (
                              <div>
                                <span className="font-semibold text-foreground">Produtos aplicáveis:</span>{' '}
                                {promo.applicableProductIds.length} produto(s)
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-foreground">Criado em:</span>{' '}
                              {formatDate(promo.createdAt)}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Válido de:</span>{' '}
                              {formatDate(promo.validFrom)}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Válido até:</span>{' '}
                              {formatDate(promo.validUntil)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={data.total}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </div>

      {/* Summary */}
      {data && data.items.length > 0 && (
        <div className="flex flex-wrap gap-6 rounded-xl border bg-card px-6 py-4 text-sm shadow-sm">
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">{data.total}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ativos</p>
            <p className="text-lg font-semibold text-green-600">
              {activeStats?.total ?? 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Usos totais (página)</p>
            <p className="text-lg font-semibold">
              {data.items.reduce((sum, p) => sum + p.usesCount, 0)}
            </p>
          </div>
        </div>
      )}

      <PromotionModal open={creating} onClose={() => setCreating(false)} />
      {editing && (
        <PromotionModal open={true} onClose={() => setEditing(undefined)} editing={editing} />
      )}
    </div>
  )
}

export default function PromotionsPage() {
  return (
    <Suspense fallback={null}>
      <PromotionsPageContent />
    </Suspense>
  )
}
