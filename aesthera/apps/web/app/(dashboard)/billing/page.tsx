'use client'

import { useState, useEffect, Suspense } from 'react'
import { ExternalLink, Info, Plus, Search, Tag, Wallet, CreditCard, AlertTriangle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ReceiveManualModal } from '@/components/receive-manual-modal'
import { SellServiceForm } from '@/components/billing/SellServiceForm'
import { type BillingStatus, type BillingSourceType, useBilling, useCancelBilling, useReopenBilling, type Billing } from '@/lib/hooks/use-appointments'
import { useServiceVouchers } from '@/lib/hooks/use-wallet'
import { useServices, useProfessionals } from '@/lib/hooks/use-resources'
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

// ──── Billing event labels ───────────────────────────────────────────────────────

const BILLING_EVENT_LABEL: Record<string, string> = {
  created: 'Criado',
  paid: 'Pago',
  cancelled: 'Cancelado',
  reopened: 'Reaberto',
  overdue: 'Vencido',
}

// Extrai texto legível de notas que podem ser JSON (ex: {reason, previousLines})
function parseEventNotes(notes: string | null): string | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes)
    return (parsed as { reason?: string }).reason ?? notes
  } catch {
    return notes
  }
}

// Extrai linhas de pagamento anteriores de um evento 'reopened'
function extractPreviousLines(events?: Billing['billingEvents']): Array<{ method: string; amount: number }> | null {
  if (!events) return null
  const reopened = [...events].reverse().find((e) => e.event === 'reopened')
  if (!reopened?.notes) return null
  try {
    const parsed = JSON.parse(reopened.notes) as { previousLines?: Array<{ method: string; amount: number }> }
    return parsed.previousLines?.length ? parsed.previousLines : null
  } catch {
    return null
  }
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

        {/* Histórico de eventos */}
        {billing.billingEvents && billing.billingEvents.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Histórico</p>
            <div className="space-y-1">
              {billing.billingEvents.map((ev) => (
                <div key={ev.id} className="flex items-start justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 mt-0.5 shrink-0" />
                    <span className="font-medium">{BILLING_EVENT_LABEL[ev.event] ?? ev.event}</span>
                    {ev.notes && (
                      <span className="text-muted-foreground">— {parseEventNotes(ev.notes)}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">{formatDate(ev.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
      </div>
    </Dialog>
  )
}

// ──── Reopen Button ────────────────────────────────────────────────────────────

function ReopenBillingButton({ billing }: { billing: Billing }) {
  const reopen = useReopenBilling(billing.id)
  const [confirming, setConfirming] = useState(false)

  // Linhas wallet que serão revertidas
  const walletLines = (billing.manualReceipt?.lines ?? []).filter(
    (l) => l.paymentMethod === 'wallet_credit' || l.paymentMethod === 'wallet_voucher'
  )
  const hasWalletPayment = walletLines.length > 0

  async function handleReopen() {
    try {
      await reopen.mutateAsync(undefined)
      toast.success('Cobrança reaberta')
      setConfirming(false)
    } catch {
      toast.error('Erro ao reabrir cobrança')
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400"
        onClick={() => setConfirming(true)}
        disabled={reopen.isPending}
      >
        Reabrir
      </Button>

      {confirming && (
        <Dialog open onClose={() => setConfirming(false)}>
          <DialogTitle>Reabrir Cobrança</DialogTitle>
          <div className="space-y-4 mt-4">
            {hasWalletPayment && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-400 space-y-1">
                  <p className="font-medium">Esta cobrança possui pagamento via carteira</p>
                  <ul className="text-xs space-y-0.5">
                    {walletLines.map((l) => (
                      <li key={l.id}>
                        • {PAYMENT_METHOD_LABEL[l.paymentMethod] ?? l.paymentMethod}
                        {l.walletEntry?.code && <span className="opacity-70"> ({l.walletEntry.code})</span>}
                        {' '}— {formatCurrency(l.amount)} <span className="font-medium">será restaurado à carteira do cliente</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Deseja reabrir esta cobrança, alterando o status para Pendente?
              {hasWalletPayment && ' O recebimento anterior será cancelado e os saldos de carteira devolvidos.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)}>Voltar</Button>
              <Button onClick={handleReopen} disabled={reopen.isPending}>
                {reopen.isPending ? 'Reabrindo…' : 'Confirmar reabertura'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
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
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setDetailOpen(true)}
          >
            Ver detalhe
          </Button>
          <ReopenBillingButton billing={billing} />
        </div>
        {detailOpen && (
          <BillingDetailModal billing={billing} onClose={() => setDetailOpen(false)} />
        )}
      </>
    )
  }

  // Linhas de pagamento anteriores (se a cobrança foi reaberta)
  const previousLines = extractPreviousLines(billing.billingEvents)

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
        previousLines={previousLines ?? undefined}
      />
    </>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

function BillingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Filtros multiselect ─────────────────────────────────────────────────────
  const [statusFilters, setStatusFilters] = useState<BillingStatus[]>(
    () => (searchParams.get('status') ?? '').split(',').filter((s): s is BillingStatus => !!s) as BillingStatus[]
  )
  const [sourceTypeFilters, setSourceTypeFilters] = useState<BillingSourceType[]>(
    () => (searchParams.get('sourceType') ?? '').split(',').filter((s): s is BillingSourceType => !!s) as BillingSourceType[]
  )
  const [hasCashReceived, setHasCashReceived] = useState(searchParams.get('hasCashReceived') === 'true')
  const [serviceId, setServiceId] = useState(searchParams.get('serviceId') ?? '')
  const [professionalId, setProfessionalId] = useState(searchParams.get('professionalId') ?? '')
  const [customerSearch, setCustomerSearch] = usePersistedFilter('aesthera-filter-billing-customer', searchParams.get('customer'), '')
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState(customerSearch)
  const [dateFrom, setDateFrom] = usePersistedFilter('aesthera-filter-billing-dateFrom', searchParams.get('dateFrom'), defaultDateFrom())
  const [dateTo, setDateTo] = usePersistedFilter('aesthera-filter-billing-dateTo', searchParams.get('dateTo'), isoDateOnly(new Date()))
  const [showNewBillingModal, setShowNewBillingModal] = useState(false)
  const [showManualBillingModal, setShowManualBillingModal] = useState(false)

  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = usePaginatedQuery({ defaultPageSize: 20 })

  const { data: servicesData } = useServices({ active: 'true', limit: '200' })
  const { data: professionalsData } = useProfessionals({ active: 'true', limit: '100' })
  const allServices = servicesData?.items ?? []
  const allProfessionals = professionalsData?.items ?? []

  // ── Toggle helpers ──────────────────────────────────────────────────────────
  function toggleStatus(value: BillingStatus) {
    setStatusFilters((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
    resetPage()
  }
  function clearStatuses() { setStatusFilters([]); resetPage() }

  function toggleSourceType(value: BillingSourceType) {
    setSourceTypeFilters((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
    resetPage()
  }
  function clearSourceTypes() { setSourceTypeFilters([]); resetPage() }

  useEffect(() => {
    const timer = setTimeout(() => { setCustomerSearchDebounced(customerSearch); resetPage() }, 250)
    return () => clearTimeout(timer)
  }, [customerSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString())
    if (statusFilters.length) p.set('status', statusFilters.join(',')); else p.delete('status')
    if (sourceTypeFilters.length) p.set('sourceType', sourceTypeFilters.join(',')); else p.delete('sourceType')
    if (hasCashReceived) p.set('hasCashReceived', 'true'); else p.delete('hasCashReceived')
    if (serviceId) p.set('serviceId', serviceId); else p.delete('serviceId')
    if (professionalId) p.set('professionalId', professionalId); else p.delete('professionalId')
    if (customerSearch) p.set('customer', customerSearch); else p.delete('customer')
    if (dateFrom) p.set('dateFrom', dateFrom); else p.delete('dateFrom')
    if (dateTo) p.set('dateTo', dateTo); else p.delete('dateTo')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, statusFilters, sourceTypeFilters, hasCashReceived, serviceId, professionalId, customerSearch, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const defaultFrom = defaultDateFrom()
  const defaultTo = isoDateOnly(new Date())
  const isDefaultFilters = statusFilters.length === 0 && sourceTypeFilters.length === 0 && !hasCashReceived && !serviceId && !professionalId && customerSearch === '' && dateFrom === defaultFrom && dateTo === defaultTo

  function resetFilters() {
    setStatusFilters([])
    setSourceTypeFilters([])
    setHasCashReceived(false)
    setServiceId('')
    setProfessionalId('')
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
    if (statusFilters.length === 0) {
      parts.push('todos os status')
    } else {
      parts.push(statusFilters.map((s) => BILLING_STATUS_LABEL[s] ?? s).join(', '))
    }
    if (sourceTypeFilters.length) {
      parts.push(`origem: ${sourceTypeFilters.map((t) => BILLING_SOURCE_TYPE_LABEL[t] ?? t).join(', ')}`)
    }
    if (hasCashReceived) parts.push('com recebimento em caixa')
    if (serviceId) {
      const svc = allServices.find((s) => s.id === serviceId)
      parts.push(`serviço: ${svc?.name ?? serviceId}`)
    }
    if (professionalId) {
      const prof = allProfessionals.find((p) => p.id === professionalId)
      parts.push(`atendente: ${prof?.name ?? professionalId}`)
    }
    if (customerSearchDebounced) parts.push(`cliente: ${customerSearchDebounced}`)
    if (dateFrom) parts.push(`de ${new Date(dateFrom + 'T00:00:00').toLocaleDateString('pt-BR')}`)
    if (dateTo) parts.push(`até ${new Date(dateTo + 'T00:00:00').toLocaleDateString('pt-BR')}`)
    return parts.join(' · ')
  }

  const params: Record<string, string> = {
    ...(statusFilters.length && { status: statusFilters.join(',') }),
    ...(sourceTypeFilters.length && { sourceType: sourceTypeFilters.join(',') }),
    ...(hasCashReceived && { hasCashReceived: 'true' }),
    ...(serviceId && { serviceId }),
    ...(professionalId && { professionalId }),
    ...(customerSearchDebounced && { customerName: customerSearchDebounced }),
    ...(dateFrom && { createdAtFrom: dateFrom }),
    ...(dateTo && { createdAtTo: dateTo }),
    ...paginationParams,
  }
  const { data, isLoading } = useBilling(Object.keys(params).length ? params : undefined)

  const statuses: Array<{ value: BillingStatus; label: string }> = [
    { value: 'pending', label: 'Pendente' },
    { value: 'paid', label: 'Pago' },
    { value: 'overdue', label: 'Vencido' },
    { value: 'cancelled', label: 'Cancelado' },
  ]

  const sourceTypes: Array<{ value: BillingSourceType; label: string }> = [
    { value: 'APPOINTMENT', label: 'Agendamento' },
    { value: 'PRESALE', label: 'Pré-venda' },
    { value: 'MANUAL', label: 'Avulso' },
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
      <div className="space-y-2">
        {/* Linha 1: Status */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-14 shrink-0">Status</span>
          <button
            onClick={clearStatuses}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilters.length === 0
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            Todos
          </button>
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => toggleStatus(s.value)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilters.includes(s.value)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Linha 2: Origem */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-14 shrink-0">Origem</span>
          <button
            onClick={clearSourceTypes}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              sourceTypeFilters.length === 0
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            Todas
          </button>
          {sourceTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => toggleSourceType(t.value)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                sourceTypeFilters.includes(t.value)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
          {/* Separador visual */}
          <div className="w-px h-5 bg-border mx-1" />
          {/* Filtro extra: Recebido Caixa */}
          <button
            onClick={() => { setHasCashReceived((v) => !v); resetPage() }}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              hasCashReceived
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-input bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            Com recebimento em caixa
          </button>
          {/* Busca por cliente — mesma linha */}
          <div className="relative ml-auto">
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

        {/* Linha 3: Serviço e Atendente */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-14 shrink-0">Detalhe</span>
          <select
            value={serviceId}
            onChange={(e) => { setServiceId(e.target.value); resetPage() }}
            className="h-8 rounded-full border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos os serviços</option>
            {allServices.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={professionalId}
            onChange={(e) => { setProfessionalId(e.target.value); resetPage() }}
            className="h-8 rounded-full border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos os atendentes</option>
            {allProfessionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
