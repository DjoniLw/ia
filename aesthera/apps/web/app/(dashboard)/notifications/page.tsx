'use client'

import { useState } from 'react'
import { Loader2, Bell, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useNotifications, useRetryNotification, type NotificationLog } from '@/lib/hooks/use-financial'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
}

const EVENT_LABEL: Record<string, string> = {
  'appointment.confirmed': 'Agendamento confirmado',
  'appointment.reminder.d1': 'Lembrete de agendamento (D-1)',
  'appointment.cancelled': 'Agendamento cancelado',
  'appointment.completed': 'Atendimento concluído',
  'billing.created': 'Cobrança gerada',
  'billing.overdue': 'Cobrança vencida',
  'payment.succeeded': 'Pagamento recebido',
  'payment.failed': 'Falha no pagamento',
  'payment.link.sent': 'Link de pagamento enviado',
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  pending: { label: 'Pendente', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  sent: { label: 'Enviado', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  failed: { label: 'Falhou', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function RetryButton({ id }: { id: string }) {
  const retry = useRetryNotification(id)
  async function handle() {
    try {
      const result = await retry.mutateAsync()
      if (result.queued) {
        toast.success('Notificação reenviada')
      } else {
        toast.info('Esta notificação não pode ser reenviada')
      }
    } catch {
      toast.error('Erro ao reenviar notificação')
    }
  }
  return (
    <button
      onClick={handle}
      disabled={retry.isPending}
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
    >
      {retry.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Reenviar
    </button>
  )
}

function NotificationRow({ log }: { log: NotificationLog }) {
  const cfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.pending
  const StatusIcon = cfg.icon

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-5 py-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
      <td className="hidden sm:table-cell px-5 py-3">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {CHANNEL_LABEL[log.type] ?? 'Desconhecido'}
        </span>
      </td>
      <td className="px-5 py-3 text-sm text-foreground">{EVENT_LABEL[log.event] ?? 'Evento desconhecido'}</td>
      <td className="hidden sm:table-cell px-5 py-3">
        <div>
          <p className="text-sm text-foreground">{log.customer?.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{log.channel}</p>
        </div>
      </td>
      <td className="px-5 py-3">
        <span className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
      </td>
      <td className="hidden sm:table-cell px-5 py-3 text-xs text-muted-foreground">{log.attempts}x · {formatDate(log.lastAttemptAt)}</td>
      <td className="px-5 py-3">
        {log.status === 'failed' && <RetryButton id={log.id} />}
      </td>
    </tr>
  )
}

export default function NotificationsPage() {
  const [status, setStatus] = useState<'pending' | 'sent' | 'failed' | ''>('')
  const [type, setType] = useState<'whatsapp' | 'email' | ''>('')
  const [page, setPage] = useState(1)

  const params = Object.fromEntries(
    Object.entries({ status, type, page, limit: 20 }).filter(([, v]) => v !== ''),
  )

  const { data, isLoading } = useNotifications(params)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Notificações</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Histórico de notificações enviadas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }}
            className="rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="sent">Enviado</option>
            <option value="failed">Falhou</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Canal</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as typeof type); setPage(1) }}
            className="rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Logs</h3>
          {data && <span className="ml-auto text-xs text-muted-foreground">{data.total} no total</span>}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Data</th>
                  <th className="hidden sm:table-cell px-5 py-3">Canal</th>
                  <th className="px-5 py-3">Evento</th>
                  <th className="hidden sm:table-cell px-5 py-3">Destinatário</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="hidden sm:table-cell px-5 py-3">Tentativas</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((log) => (
                  <NotificationRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}

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
    </div>
  )
}
