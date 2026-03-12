'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type AppointmentStatus,
  type CalendarSlot,
  useAppointmentTransition,
  useAvailability,
  useCalendar,
  useCreateAppointment,
} from '@/lib/hooks/use-appointments'
import { useCustomers } from '@/lib/hooks/use-resources'
import { useProfessionals, useServices } from '@/lib/hooks/use-resources'

// ──── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  draft: 'bg-muted text-muted-foreground border',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200',
  cancelled: 'bg-red-50 text-red-400 border border-red-100 line-through',
  no_show: 'bg-orange-100 text-orange-700 border border-orange-200',
}

// ──── Create Appointment Form ─────────────────────────────────────────────────

const createSchema = z.object({
  customerId: z.string().uuid('Selecione um cliente'),
  professionalId: z.string().uuid('Selecione um profissional'),
  serviceId: z.string().uuid('Selecione um serviço'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
})
type CreateFormData = z.infer<typeof createSchema>

function CreateAppointmentForm({
  defaultDate,
  onSave,
  isPending,
}: {
  defaultDate: string
  onSave: (data: CreateFormData) => Promise<void>
  isPending: boolean
}) {
  const { data: profData } = useProfessionals()
  const { data: svcData } = useServices()
  const { data: custData } = useCustomers()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { date: defaultDate },
  })

  const professionalId = watch('professionalId')
  const serviceId = watch('serviceId')
  const date = watch('date')

  const { data: avail } = useAvailability(
    professionalId && serviceId && date
      ? { professionalId, serviceId, date }
      : null,
  )

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('customerId')}
        >
          <option value="">Selecione…</option>
          {custData?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Profissional *</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('professionalId')}
          >
            <option value="">Selecione…</option>
            {profData?.items.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.professionalId && <p className="text-xs text-destructive">{errors.professionalId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Serviço *</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('serviceId')}
          >
            <option value="">Selecione…</option>
            {svcData?.items.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {errors.serviceId && <p className="text-xs text-destructive">{errors.serviceId.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input type="date" {...register('date')} />
        </div>
        <div className="space-y-2">
          <Label>Horário *</Label>
          {avail && avail.slots.length > 0 ? (
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('time')}
            >
              <option value="">Selecione…</option>
              {avail.slots.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <Input type="time" step={900} {...register('time')} />
          )}
          {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input {...register('notes')} placeholder="Informações adicionais…" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Agendando…' : 'Agendar'}
        </Button>
      </div>
    </form>
  )
}

// ──── Appointment Card ────────────────────────────────────────────────────────

function AppointmentCard({ slot, onAction }: { slot: CalendarSlot; onAction: () => void }) {
  const transitions = useAppointmentTransition(slot.id)

  if (slot.type === 'blocked') {
    return (
      <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
        🔒 {slot.startTime}–{slot.endTime} · {slot.reason ?? 'Bloqueado'}
      </div>
    )
  }

  const status = slot.status!

  async function handleAction(action: 'confirm' | 'start' | 'complete' | 'cancel' | 'noShow') {
    try {
      if (action === 'confirm') await transitions.confirm.mutateAsync()
      else if (action === 'start') await transitions.start.mutateAsync()
      else if (action === 'complete') await transitions.complete.mutateAsync()
      else if (action === 'cancel') await transitions.cancel.mutateAsync(undefined)
      else if (action === 'noShow') await transitions.noShow.mutateAsync()
      toast.success('Agendamento atualizado')
      onAction()
    } catch {
      toast.error('Erro ao atualizar agendamento')
    }
  }

  return (
    <div className={`rounded p-2 text-xs ${STATUS_COLOR[status]}`}>
      <div className="font-medium">
        {slot.start && formatTime(slot.start)} · {slot.duration}min
      </div>
      <div className="truncate font-semibold">{slot.customer}</div>
      <div className="truncate text-[11px] opacity-70">{slot.service}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {status === 'draft' && (
          <button
            onClick={() => handleAction('confirm')}
            className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-blue-600"
          >
            Confirmar
          </button>
        )}
        {status === 'confirmed' && (
          <button
            onClick={() => handleAction('start')}
            className="rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-yellow-600"
          >
            Iniciar
          </button>
        )}
        {status === 'in_progress' && (
          <>
            <button
              onClick={() => handleAction('complete')}
              className="rounded bg-green-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-green-600"
            >
              Concluir
            </button>
            <button
              onClick={() => handleAction('noShow')}
              className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-orange-600"
            >
              No-show
            </button>
          </>
        )}
        {(status === 'draft' || status === 'confirmed') && (
          <button
            onClick={() => handleAction('cancel')}
            className="rounded bg-red-400 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-500"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const today = toDateStr(new Date())
  const [currentDate, setCurrentDate] = useState(today)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [creating, setCreating] = useState(false)
  const [, setRefresh] = useState(0)

  const { data: calendar, isLoading } = useCalendar({ date: currentDate, view })
  const createAppointment = useCreateAppointment()

  function navigate(delta: number) {
    const d = addDays(new Date(currentDate + 'T12:00:00Z'), delta * (view === 'week' ? 7 : 1))
    setCurrentDate(toDateStr(d))
  }

  async function handleCreate(formData: CreateFormData) {
    const scheduledAt = new Date(`${formData.date}T${formData.time}:00.000Z`).toISOString()
    try {
      await createAppointment.mutateAsync({
        customerId: formData.customerId,
        professionalId: formData.professionalId,
        serviceId: formData.serviceId,
        scheduledAt,
        notes: formData.notes,
      })
      toast.success('Agendamento criado')
      setCreating(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar agendamento')
    }
  }

  const displayLabel =
    view === 'week'
      ? `Semana de ${new Date(currentDate + 'T12:00:00Z').toLocaleDateString('pt-BR')}`
      : new Date(currentDate + 'T12:00:00Z').toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Agendamentos</h2>
          <p className="text-sm text-muted-foreground capitalize">{displayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'day' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent'}`}
            >
              Dia
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'week' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent'}`}
            >
              Semana
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(today)}>
              Hoje
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setCreating(true)}>+ Novo Agendamento</Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : !calendar || calendar.professionals.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          Nenhum agendamento para este período.
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${calendar.professionals.length}, minmax(220px, 1fr))` }}>
          {calendar.professionals.map((prof) => (
            <div key={prof.id} className="rounded-lg border bg-card">
              <div className="border-b px-3 py-2">
                <p className="text-sm font-semibold">{prof.name}</p>
              </div>
              <div className="space-y-2 p-3">
                {prof.slots.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem agendamentos</p>
                ) : (
                  prof.slots.map((slot) => (
                    <AppointmentCard
                      key={slot.id}
                      slot={slot}
                      onAction={() => setRefresh((r) => r + 1)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.entries(STATUS_LABEL) as [AppointmentStatus, string][]).map(([k, v]) => (
          <span key={k} className={`rounded-full px-2 py-0.5 ${STATUS_COLOR[k]}`}>{v}</span>
        ))}
      </div>

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => setCreating(false)}>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <div className="mt-4">
            <CreateAppointmentForm
              defaultDate={currentDate}
              onSave={handleCreate}
              isPending={createAppointment.isPending}
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}
