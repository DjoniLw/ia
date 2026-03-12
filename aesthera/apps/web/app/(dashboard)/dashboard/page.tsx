'use client'

import { CalendarDays, TrendingUp, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { useLedgerSummary, useTodayAppointments } from '@/lib/hooks/use-financial'
import { useBilling } from '@/lib/hooks/use-appointments'

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-muted text-muted-foreground',
  no_show: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

// Monthly range helpers
function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export default function DashboardPage() {
  const { from, to } = monthRange()
  const summary = useLedgerSummary({ from, to })
  const todayAppts = useTodayAppointments()
  const overdueBilling = useBilling({ status: 'overdue', limit: 5 })

  const stats = [
    {
      label: 'Receita do Mês',
      value: summary.isLoading ? '...' : formatCurrency(summary.data?.totalCredits ?? 0),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/20',
    },
    {
      label: 'Agendamentos Hoje',
      value: todayAppts.isLoading ? '...' : String(todayAppts.data?.length ?? 0),
      icon: CalendarDays,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      label: 'Cobranças Vencidas',
      value: overdueBilling.isLoading ? '...' : String(overdueBilling.data?.total ?? 0),
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/20',
    },
    {
      label: 'Saldo Líquido',
      value: summary.isLoading
        ? '...'
        : formatCurrency((summary.data?.totalCredits ?? 0) - (summary.data?.totalDebits ?? 0)),
      icon: CheckCircle,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950/20',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Início</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Agenda de hoje</h3>
          <a href="/appointments" className="text-xs font-medium text-primary hover:underline">
            Ver tudo →
          </a>
        </div>
        <div className="divide-y">
          {todayAppts.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !todayAppts.data?.length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento para hoje</p>
            </div>
          ) : (
            todayAppts.data.map((appt) => (
              <div key={appt.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex w-12 flex-col items-center text-center">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="mt-0.5 text-xs font-semibold text-foreground">
                    {formatTime(appt.scheduledAt)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{appt.customer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appt.service.name} · {appt.professional.name}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[appt.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABEL[appt.status] ?? appt.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
