'use client'

import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ReceiveManualModal } from '@/components/receive-manual-modal'
import { type BillingStatus, useBilling, useCancelBilling, type Billing } from '@/lib/hooks/use-appointments'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

const STATUS_LABEL: Record<BillingStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
}

const STATUS_COLOR: Record<BillingStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
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

// ──── Billing Row Actions ──────────────────────────────────────────────────────

function BillingActions({ billing }: { billing: Billing }) {
  const [modalOpen, setModalOpen] = useState(false)

  if (billing.status !== 'pending' && billing.status !== 'overdue') {
    return null
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400"
          onClick={() => setModalOpen(true)}
        >
          Registrar Recebimento
        </Button>
        <CancelBillingButton id={billing.id} status={billing.status} />
      </div>

      <ReceiveManualModal
        billing={billing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [statusFilter, setStatusFilter] = useState<BillingStatus | ''>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setCustomerSearchDebounced(customerSearch), 250)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const params: Record<string, string> = {
    ...(statusFilter && { status: statusFilter }),
    ...(customerSearchDebounced && { customerName: customerSearchDebounced }),
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
            Geradas automaticamente ao concluir agendamentos
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
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
        <Input
          placeholder="Buscar por cliente…"
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          className="h-8 w-48 text-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-muted-foreground">Serviço</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-muted-foreground">Agendamento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Valor</th>
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
                <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">
                  {b.appointment.service.name}
                  <span className="block text-[11px]">
                    por {b.appointment.professional.name}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">
                  {formatDate(b.appointment.scheduledAt)}
                </td>
                <td className="px-2 py-3 font-medium">{formatCurrency(b.amount)}</td>
                <td className="hidden sm:table-cell px-2 py-3 text-muted-foreground">{formatDate(b.dueDate)}</td>
                <td className="px-2 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[b.status]}`}>
                    {STATUS_LABEL[b.status]}
                  </span>
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

      {/* Summary */}
      {data && data.items.length > 0 && (
        <div className="flex gap-6 rounded-lg border bg-card px-6 py-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total cobranças</p>
            <p className="text-lg font-semibold">{data.total}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Valor total (página)</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data.items.reduce((s, b) => s + b.amount, 0))}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pagos</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(data.items.filter((b) => b.status === 'paid').reduce((s, b) => s + b.amount, 0))}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pendentes</p>
            <p className="text-lg font-semibold text-yellow-600">
              {formatCurrency(
                data.items
                  .filter((b) => b.status === 'pending' || b.status === 'overdue')
                  .reduce((s, b) => s + b.amount, 0),
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
