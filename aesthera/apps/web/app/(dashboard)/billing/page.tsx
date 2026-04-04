'use client'

import { useState, useEffect, Suspense } from 'react'
import { ExternalLink, Info, Plus, Search, Tag, Wallet, CreditCard } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ReceiveManualModal } from '@/components/receive-manual-modal'
import { SellServiceForm } from '@/components/billing/SellServiceForm'
import { type BillingStatus, type BillingSourceType, useBilling, useCancelBilling, type Billing } from '@/lib/hooks/use-appointments'
import { useServiceVouchers } from '@/lib/hooks/use-wallet'
import { BILLING_SOURCE_TYPE_LABEL, BILLING_SOURCE_TYPE_COLOR, BILLING_STATUS_LABEL, BILLING_STATUS_COLOR } from '@/lib/status-colors'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import { DataPagination } from '@/components/ui/data-pagination'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function isoDateOnly(d: Date) {
  return d.toISOString().slice(0, 10)
}

function defaultDateFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return isoDateOnly(d)
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  card: 'Cartão',
  transfer: 'Transferência',
  wallet_credit: 'Crédito',
  wallet_voucher: 'Vale Serviço',
}

const PAYMENT_METHOD_COLOR: Record<string, string> = {
  cash: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  pix: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  card: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  transfer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  wallet_credit: 'bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  wallet_voucher: 'bg-orange-200 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
}

// ──── Cash helpers ───────────────────────────────────────────────────────────────

const WALLET_METHODS = new Set(['wallet_credit', 'wallet_voucher'])

function cashReceivedForBilling(b: Billing): number {
  return (b.manualReceipt?.lines ?? []).reduce(
    (sum, l) => sum + (WALLET_METHODS.has(l.paymentMethod) ? 0 : l.amount),
    0,
  )
}

function effectiveStatus(b: Billing): BillingStatus {
  if (b.status === 'pending' && b.dueDate && new Date(b.dueDate + 'T23:59:59') < new Date()) {
    return 'overdue'
  }
  return b.status
}

function billingDescription(b: Billing): React.ReactNode {
  const serviceName = b.appointment?.service?.name ?? b.service?.name
  const professionalName = b.appointment?.professional?.name
  const scheduledAt = b.appointment?.scheduledAt

  switch (b.sourceType) {
    case 'APPOINTMENT': {
      return (
        <span>
          Agendamento{scheduledAt ? ` em ${formatDate(scheduledAt)}` : ''}
          {serviceName && <span className="font-medium"> · {serviceName}</span>}
          {professionalName && <span className="block text-[11px]">por {professionalName}</span>}
        </span>
      )
    }
    case 'PRESALE': {
      return (
        <span>
          Pré-venda de serviço
          {serviceName && <span className="font-medium"> — {serviceName}</span>}
        </span>
      )
    }
    case 'MANUAL': {
      return <span>Cobrança avulsa</span>
    }
    case 'PACKAGE_SALE': {
      return <span>Venda de pacote</span>
    }
    case 'PRODUCT_SALE': {
      return (
        <span>
          Venda de produto
          {serviceName && <span className="font-medium"> — {serviceName}</span>}
        </span>
      )
    }
    default:
      return <span>—</span>
  }
}

// ──── Billing Detail Modal ─────────────────────────────────────────────────────

function BillingDetailModal({ billing, onClose }: { billing: Billing; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Detalhe da Cobrança</DialogTitle>
      <div className="mt-4 space-y-4">
        {/* Dados principais */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium">{billing.customer.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_STATUS_COLOR[billing.status] ?? 'bg-muted text-muted-foreground'}`}>
              {BILLING_STATUS_LABEL[billing.status] ?? billing.status}
            </span>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Detalhe</p>
            <p className="font-medium text-sm">{billingDescription(billing)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Origem</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_SOURCE_TYPE_COLOR[billing.sourceType] ?? 'bg-muted text-muted-foreground'}`}>
              {BILLING_SOURCE_TYPE_LABEL[billing.sourceType] ?? billing.sourceType}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor cobrado</p>
            <p className="font-semibold text-lg">{formatCurrency(billing.amount)}</p>
          </div>
          {billing.originalAmount && billing.lockedPromotionCode && (
            <div>
              <p className="text-xs text-muted-foreground">Promoção aplicada</p>
              <p className="text-green-700 dark:text-green-400 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {billing.lockedPromotionCode}
                <span className="line-through text-muted-foreground ml-1 text-xs">{formatCurrency(billing.originalAmount)}</span>
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Criado em</p>
            <p>{formatDate(billing.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vencimento</p>
            <p>{formatDate(billing.dueDate)}</p>
          </div>
          {billing.paidAt && (
            <div>
              <p className="text-xs text-muted-foreground">Pago em</p>
              <p className="text-green-600 font-medium">{formatDate(billing.paidAt)}</p>
            </div>
          )}
          {billing.cancelledAt && (
            <div>
              <p className="text-xs text-muted-foreground">Cancelado em</p>
              <p className="text-destructive">{formatDate(billing.cancelledAt)}</p>
            </div>
          )}

        </div>

        {/* Detalhe do recebimento */}
        {billing.manualReceipt && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Recebimento</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Recebido em {formatDate(billing.manualReceipt.receivedAt)}</span>
              <span className="font-medium text-foreground">{formatCurrency(billing.manualReceipt.totalPaid)}</span>
            </div>
            {billing.manualReceipt.lines.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Formas de pagamento</p>
                {billing.manualReceipt.lines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_METHOD_COLOR[line.paymentMethod] ?? 'bg-muted text-muted-foreground'}`}>
                      {line.paymentMethod === 'wallet_voucher' || line.paymentMethod === 'wallet_credit'
                        ? <Wallet className="h-2.5 w-2.5" />
                        : <CreditCard className="h-2.5 w-2.5" />
                      }
                      {PAYMENT_METHOD_LABEL[line.paymentMethod] ?? line.paymentMethod}
                      {line.walletEntry?.code && (
                        <span className="opacity-70">· {line.walletEntry.code}</span>
                      )}
                    </span>
                    <span className="text-xs font-medium">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {billing.manualReceipt.notes && (
              <p className="text-xs text-muted-foreground border-t pt-2">{billing.manualReceipt.notes}</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
      </div>
    </Dialog>
  )
}

// ──── Cancel Button ────────────────────────────────────────────────────────────

function CancelBillingButton({ id, status }: { id: string; status: BillingStatus }) {
  const cancel = useCancelBilling(id)
  const [confirming, setConfirming] = useState(false)

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success('Cobrança cancelada')
      setConfirming(false)
    } catch {
      toast.error('Erro ao cancelar cobrança')
    }
  }

  if (status !== 'pending' && status !== 'overdue') return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
        disabled={cancel.isPending}
      >
        Cancelar
      </Button>

      {confirming && (
        <Dialog open onClose={() => setConfirming(false)}>
          <DialogTitle>Cancelar Cobrança</DialogTitle>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)}>Voltar</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
                {cancel.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}

// ──── Payment Method Pills ─────────────────────────────────────────────────────

function PaymentMethodPills({ billing }: { billing: Billing }) {
  const lines = billing.manualReceipt?.lines ?? []
  if (lines.length === 0) return null
  // Deduplica métodos (ex: 2 linhas cash → exibe "Dinheiro" uma vez)
  const unique = [...new Map(lines.map(l => [l.paymentMethod, l])).values()]
  return (
    <div className="flex flex-wrap gap-0.5 mt-1">
      {unique.map((line) => (
        <span
          key={line.paymentMethod}
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_METHOD_COLOR[line.paymentMethod] ?? 'bg-muted text-muted-foreground'}`}
        >
          {PAYMENT_METHOD_LABEL[line.paymentMethod] ?? line.paymentMethod}
        </span>
      ))}
    </div>
  )
}

// ──── Billing Row Actions ──────────────────────────────────────────────────────

function BillingActions({ billing }: { billing: Billing }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)

  // Busca vouchers SERVICE_PRESALE disponíveis para o serviço da cobrança (item 4)
  const serviceId = billing.appointment?.service?.id ?? billing.service?.id ?? undefined
  const { data: serviceVouchers } = useServiceVouchers(
    billing.customer.id,
    serviceId,
    !!serviceId && (billing.status === 'pending' || billing.status === 'overdue'),
  )
  const bestVoucher = serviceVouchers
    ?.slice()
    .sort((a, b) => b.balance - a.balance)[0] ?? null

  if (billing.status === 'paid' || billing.status === 'cancelled') {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setDetailOpen(true)}
        >
          Ver detalhe
        </Button>
        {detailOpen && (
          <BillingDetailModal billing={billing} onClose={() => setDetailOpen(false)} />
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400"
          onClick={() => { setModalKey((k) => k + 1); setModalOpen(true) }}
        >
          Registrar Recebimento
        </Button>
        <CancelBillingButton id={billing.id} status={billing.status} />
      </div>

      <ReceiveManualModal
        key={modalKey}
        billing={billing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        preSelectedVoucherId={bestVoucher?.id ?? undefined}
      />
    </>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

function BillingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [statusFilter, setStatusFilter] = usePersistedFilter<BillingStatus | ''>('aesthera-filter-billing-status', (searchParams.get('status') as BillingStatus | null), '')
  const [sourceTypeFilter, setSourceTypeFilter] = usePersistedFilter<BillingSourceType | ''>('aesthera-filter-billing-sourcetype', (searchParams.get('sourceType') as BillingSourceType | null), '')
  const [customerSearch, setCustomerSearch] = usePersistedFilter('aesthera-filter-billing-customer', searchParams.get('customer'), '')
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState(customerSearch)
  const [dateFrom, setDateFrom] = usePersistedFilter('aesthera-filter-billing-dateFrom', searchParams.get('dateFrom'), defaultDateFrom())
  const [dateTo, setDateTo] = usePersistedFilter('aesthera-filter-billing-dateTo', searchParams.get('dateTo'), isoDateOnly(new Date()))
  const [showNewBillingModal, setShowNewBillingModal] = useState(false)
  const [showManualBillingModal, setShowManualBillingModal] = useState(false)

  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })

  useEffect(() => {
    const timer = setTimeout(() => { setCustomerSearchDebounced(customerSearch); resetPage() }, 250)
    return () => clearTimeout(timer)
  }, [customerSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // URL sync — page/pageSize gerenciados pelo usePaginatedQuery; aqui só os filtros
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    if (statusFilter) p.set('status', statusFilter); else p.delete('status')
    if (sourceTypeFilter) p.set('sourceType', sourceTypeFilter); else p.delete('sourceType')
    if (customerSearch) p.set('customer', customerSearch); else p.delete('customer')
    if (dateFrom) p.set('dateFrom', dateFrom); else p.delete('dateFrom')
    if (dateTo) p.set('dateTo', dateTo); else p.delete('dateTo')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, statusFilter, sourceTypeFilter, customerSearch, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const defaultFrom = defaultDateFrom()
  const defaultTo = isoDateOnly(new Date())
  const isDefaultFilters = statusFilter === '' && sourceTypeFilter === '' && customerSearch === '' && dateFrom === defaultFrom && dateTo === defaultTo

  function resetFilters() {
    setStatusFilter('')
    setSourceTypeFilter('')
    setCustomerSearch('')
    setCustomerSearchDebounced('')
    setDateFrom(defaultFrom)
    setDateTo(defaultTo)
    resetPage()
  }

  function setDatePreset(months: number) {
    const from = new Date()
    from.setMonth(from.getMonth() - months)
    setDateFrom(isoDateOnly(from))
    setDateTo(defaultTo)
    resetPage()
  }

  function buildFilterLabel(): string {
    const parts: string[] = []
    const statusLabel: Record<string, string> = {
      '': 'todos os status',
      ...BILLING_STATUS_LABEL,
    }
    parts.push(statusLabel[statusFilter] ?? statusFilter)
    if (sourceTypeFilter) parts.push(`origem: ${BILLING_SOURCE_TYPE_LABEL[sourceTypeFilter] ?? sourceTypeFilter}`)
    if (customerSearchDebounced) parts.push(`cliente: ${customerSearchDebounced}`)
    if (dateFrom) parts.push(`de ${new Date(dateFrom + 'T00:00:00').toLocaleDateString('pt-BR')}`)
    if (dateTo) parts.push(`até ${new Date(dateTo + 'T00:00:00').toLocaleDateString('pt-BR')}`)
    return parts.join(' · ')
  }

  const params: Record<string, string> = {
    ...(statusFilter && { status: statusFilter }),
    ...(sourceTypeFilter && { sourceType: sourceTypeFilter }),
    ...(customerSearchDebounced && { customerName: customerSearchDebounced }),
    ...(dateFrom && { createdAtFrom: dateFrom }),
    ...(dateTo && { createdAtTo: dateTo }),
    ...paginationParams,
  }
  const { data, isLoading } = useBilling(Object.keys(params).length ? params : undefined)

  const statuses: Array<{ value: BillingStatus | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendente' },
    { value: 'paid', label: 'Pago' },
    { value: 'overdue', label: 'Vencido' },
    { value: 'cancelled', label: 'Cancelado' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Cobranças</h2>
          <p className="text-sm text-muted-foreground">
            Cobranças de serviços, pré-vendas e registros avulsos
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowManualBillingModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Cobrança
          </Button>
          <Button size="sm" onClick={() => setShowNewBillingModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Pré-venda
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => { setStatusFilter(s.value); resetPage() }}
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

          {/* sourceType filter */}
          <div className="flex gap-1">
            {(['', 'APPOINTMENT', 'PRESALE', 'MANUAL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setSourceTypeFilter(t); resetPage() }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  sourceTypeFilter === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {t === '' ? 'Todas origens' : BILLING_SOURCE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="h-8 rounded-full border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-48"
            />
          </div>
        </div>

        {/* Filtros de data */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Criado em:</span>
          <div className="flex gap-1">
            {[
              { label: 'Hoje', months: 0 },
              { label: '7 dias', months: null, days: 7 },
              { label: '30 dias', months: 1 },
              { label: '3 meses', months: 3 },
              { label: '6 meses', months: 6 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const from = new Date()
                  if (preset.months === 0) {
                    setDateFrom(isoDateOnly(from))
                  } else if ('days' in preset && preset.days) {
                    from.setDate(from.getDate() - preset.days)
                    setDateFrom(isoDateOnly(from))
                  } else if (preset.months) {
                    from.setMonth(from.getMonth() - preset.months)
                    setDateFrom(isoDateOnly(from))
                  }
                  setDateTo(isoDateOnly(new Date()))
                  resetPage()
                }}
                className="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors border-input bg-card text-muted-foreground hover:bg-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); resetPage() }}
            className="h-7 rounded border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); resetPage() }}
            className="h-7 rounded border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
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
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-muted-foreground">Detalhe</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Valor</th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-muted-foreground">Recebido Caixa</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vencimento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhuma cobrança encontrada.
                </td>
              </tr>
            )}
            {data?.items.map((b) => (
              <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 pl-4 pr-2 font-medium">{b.customer.name}</td>
                <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground text-xs">
                  {billingDescription(b)}
                </td>
                <td className="px-2 py-3 font-medium">
                  {b.lockedPromotionCode && b.originalAmount ? (
                    <div>
                      <span>{formatCurrency(b.amount)}</span>
                      <span className="flex items-center gap-0.5 text-[11px] text-green-700 dark:text-green-400">
                        <Tag className="h-2.5 w-2.5" />
                        {b.lockedPromotionCode}
                        <span className="line-through text-muted-foreground ml-1">{formatCurrency(b.originalAmount)}</span>
                      </span>
                    </div>
                  ) : (
                    formatCurrency(b.amount)
                  )}
                  <PaymentMethodPills billing={b} />
                </td>
                <td className="hidden md:table-cell px-2 py-3 font-medium">
                  {(() => {
                    const cash = cashReceivedForBilling(b)
                    return cash > 0 ? (
                      <span className="text-green-700 dark:text-green-400">{formatCurrency(cash)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  })()}
                </td>
                <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">{formatDate(b.dueDate)}</td>
                <td className="px-2 py-3">
                  <div className="flex flex-col gap-1">
                    {(() => {
                      const es = effectiveStatus(b)
                      return (
                        <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_STATUS_COLOR[es] ?? 'bg-muted text-muted-foreground'}`}>
                          {BILLING_STATUS_LABEL[es] ?? es}
                        </span>
                      )
                    })()}
                    {b.sourceType && (
                      <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_SOURCE_TYPE_COLOR[b.sourceType] ?? 'bg-muted text-muted-foreground'}`}>
                        {BILLING_SOURCE_TYPE_LABEL[b.sourceType] ?? b.sourceType}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="flex justify-end gap-1">
                    {b.paymentLink && (
                      <a
                        href={b.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        Ver link
                      </a>
                    )}
                    <BillingActions billing={b} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DataPagination
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Modal de nova pré-venda */}
      {showNewBillingModal && (
        <Dialog open onClose={() => setShowNewBillingModal(false)}>
          <DialogTitle>Nova Pré-venda de Serviço</DialogTitle>
          <div className="mt-4">
            <SellServiceForm
              onSuccess={() => setShowNewBillingModal(false)}
              onCancel={() => setShowNewBillingModal(false)}
            />
          </div>
        </Dialog>
      )}

      {/* Modal de nova cobrança manual */}
      {showManualBillingModal && (
        <Dialog open onClose={() => setShowManualBillingModal(false)}>
          <DialogTitle>Nova Cobrança</DialogTitle>
          <div className="mt-4">
            <SellServiceForm
              mode="MANUAL"
              onSuccess={() => setShowManualBillingModal(false)}
              onCancel={() => setShowManualBillingModal(false)}
            />
          </div>
        </Dialog>
      )}

      {/* Summary */}
      {data && data.items.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-card px-6 py-4 text-sm">
          {/* Linha 1 — totais gerais */}
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-muted-foreground">Total cobranças</p>
              <p className="text-lg font-semibold">{data.total}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Valor total (filtro)</p>
              <p className="text-lg font-semibold">{formatCurrency(data.totalAmount ?? 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recebido Caixa (filtro)</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(data.totalCashReceived ?? 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recebido Caixa (página)</p>
              <p className="text-lg font-semibold text-green-700">
                {formatCurrency(data.items.reduce((s, b) => s + cashReceivedForBilling(b), 0))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pendente (página)</p>
              <p className="text-lg font-semibold text-yellow-600">
                {formatCurrency(
                  data.items
                    .filter((b) => b.status === 'pending' || b.status === 'overdue')
                    .reduce((s, b) => s + b.amount, 0),
                )}
              </p>
            </div>
          </div>

          {/* Linha 2 — breakdown por forma de pagamento */}
          {data.paymentMethodBreakdown && data.paymentMethodBreakdown.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Recebido por forma de pagamento (filtro)</p>
              <div className="flex flex-wrap gap-2">
                {data.paymentMethodBreakdown.map((row) => (
                  <span
                    key={row.paymentMethod}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${PAYMENT_METHOD_COLOR[row.paymentMethod] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {PAYMENT_METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
                    <span className="font-semibold">{formatCurrency(row.total)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──── Export ───────────────────────────────────────────────────────────────────

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingPageContent />
    </Suspense>
  )
}
