'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
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
import { useProfessionals } from '@/lib/hooks/use-resources'

// ──── Types ─────────────────────────────────────────────────────────────────────

type SlotWithProf = CalendarSlot & { _profName: string }

// ──── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function startOfWeek(d: Date) {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() - r.getUTCDay()) // Sunday = 0
  return r
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

const WEEK_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

// More accessible status colors (darker text for contrast)
const STATUS_COLOR: Record<AppointmentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
  in_progress: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-100 dark:border-red-900 line-through',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border border-orange-200 dark:border-orange-800',
}

// Calendar event colors by status (compact pill style for week/month views)
const EVENT_COLOR: Record<AppointmentStatus, string> = {
  draft: 'bg-gray-200 text-gray-800',
  confirmed: 'bg-blue-500 text-white',
  in_progress: 'bg-amber-500 text-white',
  completed: 'bg-green-500 text-white',
  cancelled: 'bg-red-200 text-red-700 line-through opacity-60',
  no_show: 'bg-orange-400 text-white',
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
  const { data: profData } = useProfessionals({ includeServices: 'true' })
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

  const selectedProf = profData?.items.find((p) => p.id === professionalId)
  const assignedServices = selectedProf?.services?.map((ps) => ps.service) ?? []

  const { data: avail } = useAvailability(
    professionalId && serviceId && date ? { professionalId, serviceId, date } : null,
  )

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('customerId')}>
          <option value="">Selecione…</option>
          {custData?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Profissional *</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('professionalId')}>
            <option value="">Selecione…</option>
            {profData?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.professionalId && <p className="text-xs text-destructive">{errors.professionalId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Serviço *</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('serviceId')}>
            <option value="">Selecione…</option>
            {assignedServices.length === 0 && professionalId && (
              <option disabled value="">Nenhum serviço atribuído</option>
            )}
            {assignedServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('time')}>
              <option value="">Selecione…</option>
              {avail.slots.map((s) => <option key={s} value={s}>{s}</option>)}
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

// ──── Slot Actions Popover ────────────────────────────────────────────────────

function SlotActions({ slot, onClose }: { slot: CalendarSlot; onClose: () => void }) {
  const transitions = useAppointmentTransition(slot.id)
  const status = slot.status!

  async function handleAction(action: 'confirm' | 'start' | 'complete' | 'cancel' | 'noShow') {
    try {
      if (action === 'confirm') await transitions.confirm.mutateAsync()
      else if (action === 'start') await transitions.start.mutateAsync()
      else if (action === 'complete') await transitions.complete.mutateAsync()
      else if (action === 'cancel') await transitions.cancel.mutateAsync(undefined)
      else if (action === 'noShow') await transitions.noShow.mutateAsync()
      toast.success('Agendamento atualizado')
      onClose()
    } catch {
      toast.error('Erro ao atualizar agendamento')
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">{slot.customer}</p>
        <p className="text-sm text-muted-foreground">{slot.service}</p>
        {slot.start && <p className="text-sm text-muted-foreground">{formatTime(slot.start)} · {slot.duration}min</p>}
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pt-1 border-t">
        {status === 'draft' && (
          <Button size="sm" onClick={() => handleAction('confirm')}>Confirmar</Button>
        )}
        {status === 'confirmed' && (
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600" onClick={() => handleAction('start')}>Iniciar</Button>
        )}
        {status === 'in_progress' && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction('complete')}>Concluir</Button>
            <Button size="sm" variant="outline" onClick={() => handleAction('noShow')}>No-show</Button>
          </>
        )}
        {(status === 'draft' || status === 'confirmed') && (
          <Button size="sm" variant="destructive" onClick={() => handleAction('cancel')}>Cancelar</Button>
        )}
      </div>
      {slot.notes && <p className="text-xs text-muted-foreground border-t pt-2">{slot.notes}</p>}
    </div>
  )
}

// ──── Day View ────────────────────────────────────────────────────────────────

function DayView({
  professionals,
  onSlotClick,
}: {
  professionals: { id: string; name: string; slots: CalendarSlot[] }[]
  onSlotClick: (slot: CalendarSlot) => void
}) {
  if (professionals.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
        <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-30" />
        Nenhum agendamento para este dia.
      </div>
    )
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${professionals.length}, minmax(200px, 1fr))` }}>
      {professionals.map((prof) => (
        <div key={prof.id} className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b bg-muted/30 px-3 py-2">
            <p className="text-sm font-semibold">{prof.name}</p>
          </div>
          <div className="space-y-2 p-3">
            {prof.slots.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Sem agendamentos</p>
            ) : (
              prof.slots.map((slot) => {
                if (slot.type === 'blocked') {
                  return (
                    <div key={slot.id} className="rounded border border-dashed border-muted-foreground/30 bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                      🔒 {slot.startTime}–{slot.endTime} · {slot.reason ?? 'Bloqueado'}
                    </div>
                  )
                }
                const status = slot.status!
                return (
                  <button
                    key={slot.id}
                    onClick={() => onSlotClick(slot)}
                    className={`w-full rounded p-2 text-left text-xs transition-opacity hover:opacity-80 ${STATUS_COLOR[status]}`}
                  >
                    <div className="font-semibold">
                      {slot.start && formatTime(slot.start)} · {slot.duration}min
                    </div>
                    <div className="truncate font-medium">{slot.customer}</div>
                    <div className="truncate opacity-70">{slot.service}</div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ──── Week View (Google Calendar-style) ────────────────────────────────────────

function WeekView({
  professionals,
  weekStart,
  onSlotClick,
}: {
  professionals: { id: string; name: string; slots: CalendarSlot[] }[]
  weekStart: Date
  onSlotClick: (slot: CalendarSlot) => void
}) {
  // Build map: dateStr -> slots
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarSlot[]>()
    for (let i = 0; i < 7; i++) {
      const d = toDateStr(addDays(weekStart, i))
      map.set(d, [])
    }
    for (const prof of professionals) {
      for (const slot of prof.slots) {
        if (slot.type !== 'appointment' || !slot.start) continue
        const dateStr = slot.start.slice(0, 10)
        if (map.has(dateStr)) {
          map.get(dateStr)!.push({ ...slot, _profName: prof.name } as SlotWithProf)
        }
      }
    }
    return map
  }, [professionals, weekStart])

  const todayStr = toDateStr(new Date())

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i)
          const dateStr = toDateStr(d)
          const isToday = dateStr === todayStr
          return (
            <div key={i} className={`border-r last:border-r-0 px-2 py-3 text-center ${isToday ? 'bg-primary/5' : ''}`}>
              <p className="text-xs font-medium text-muted-foreground">{WEEK_DAYS_SHORT[d.getUTCDay()]}</p>
              <p className={`mt-1 text-lg font-bold leading-none ${isToday ? 'text-primary' : 'text-foreground'}`}>
                {d.getUTCDate()}
              </p>
            </div>
          )
        })}
      </div>
      {/* Event rows */}
      <div className="grid grid-cols-7 min-h-[120px]">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i)
          const dateStr = toDateStr(d)
          const isToday = dateStr === todayStr
          const slots = dayMap.get(dateStr) ?? []
          const apptSlots = slots.filter((s) => s.type === 'appointment' && s.status !== undefined)
            .sort((a, b) => (a.start ?? '') < (b.start ?? '') ? -1 : 1)

          return (
            <div key={i} className={`border-r last:border-r-0 p-1.5 space-y-1 ${isToday ? 'bg-primary/5' : ''}`}>
              {apptSlots.length === 0 ? (
                <div className="h-full min-h-[80px]" />
              ) : (
                apptSlots.map((slot) => {
                  const status = slot.status!
                  const profName = (slot as Partial<SlotWithProf>)._profName
                  return (
                    <button
                      key={slot.id}
                      onClick={() => onSlotClick(slot)}
                      className={`w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80 ${EVENT_COLOR[status]}`}
                    >
                      <div className="font-semibold truncate">
                        {slot.start && formatTime(slot.start)}
                      </div>
                      <div className="truncate font-medium">{slot.customer}</div>
                      {profName && <div className="truncate opacity-75">{profName}</div>}
                    </button>
                  )
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──── Month View ──────────────────────────────────────────────────────────────

function MonthView({
  professionals,
  monthStart,
  onSlotClick,
  onDayClick,
}: {
  professionals: { id: string; name: string; slots: CalendarSlot[] }[]
  monthStart: Date
  onSlotClick: (slot: CalendarSlot) => void
  onDayClick: (dateStr: string) => void
}) {
  const todayStr = toDateStr(new Date())

  // Build day map
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarSlot[]>()
    for (const prof of professionals) {
      for (const slot of prof.slots) {
        if (slot.type !== 'appointment' || !slot.start) continue
        const dateStr = slot.start.slice(0, 10)
        if (!map.has(dateStr)) map.set(dateStr, [])
        map.get(dateStr)!.push({ ...slot, _profName: prof.name } as SlotWithProf)
      }
    }
    return map
  }, [professionals])

  const year = monthStart.getUTCFullYear()
  const month = monthStart.getUTCMonth()
  const firstDow = monthStart.getUTCDay() // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  // Build grid: leading empty cells + all days
  const cells: Array<{ dateStr: string; dayNum: number } | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(Date.UTC(year, month, i + 1))
      return { dateStr: toDateStr(d), dayNum: i + 1 }
    }),
  ]
  // Pad to full 6-row grid
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEK_DAYS_SHORT.map((d) => (
          <div key={d} className="border-r last:border-r-0 py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Weeks */}
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <div key={week} className="grid grid-cols-7 border-b last:border-b-0">
          {cells.slice(week * 7, week * 7 + 7).map((cell, ci) => {
            if (!cell) {
              return <div key={ci} className="border-r last:border-r-0 bg-muted/10 min-h-[100px]" />
            }
            const { dateStr, dayNum } = cell
            const isToday = dateStr === todayStr
            const slots = (dayMap.get(dateStr) ?? []).sort((a, b) => (a.start ?? '') < (b.start ?? '') ? -1 : 1)
            const visible = slots.slice(0, 3)
            const extra = slots.length - 3

            return (
              <div
                key={ci}
                className={`border-r last:border-r-0 min-h-[100px] p-1 cursor-pointer hover:bg-accent/30 transition-colors ${isToday ? 'bg-primary/5' : ''}`}
                onClick={() => onDayClick(dateStr)}
              >
                <p className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                  {dayNum}
                </p>
                <div className="space-y-0.5">
                  {visible.map((slot) => {
                    const status = slot.status!
                    return (
                      <button
                        key={slot.id}
                        onClick={(e) => { e.stopPropagation(); onSlotClick(slot) }}
                        className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight transition-opacity hover:opacity-80 ${EVENT_COLOR[status]}`}
                      >
                        {slot.start && <span className="mr-1">{formatTime(slot.start)}</span>}
                        {slot.customer}
                      </button>
                    )
                  })}
                  {extra > 0 && (
                    <p className="text-[10px] text-muted-foreground pl-1">+{extra} mais</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ──── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const todayStr = toDateStr(new Date())
  const [currentDate, setCurrentDate] = useState(todayStr)
  const [view, setView] = useState<'day' | 'week' | 'month'>('day')
  const [creating, setCreating] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null)

  // For week/month queries we always send the base date; the API handles the range
  const queryView = view === 'month' ? 'week' : view
  const { data: calendar, isLoading } = useCalendar({ date: currentDate, view: queryView })
  const createAppointment = useCreateAppointment()

  // Navigate: day ±1, week ±7, month ±~30
  const navigate = useCallback(
    (delta: number) => {
      const d = addDays(new Date(currentDate + 'T12:00:00Z'), delta * (view === 'day' ? 1 : view === 'week' ? 7 : 30))
      setCurrentDate(toDateStr(d))
    },
    [currentDate, view],
  )

  // Month view: jump to specific day
  function handleDayClick(dateStr: string) {
    setCurrentDate(dateStr)
    setView('day')
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

  // Date label
  const currentDateObj = new Date(currentDate + 'T12:00:00Z')
  const displayLabel = useMemo(() => {
    if (view === 'month') {
      return `${MONTH_NAMES[currentDateObj.getUTCMonth()]} ${currentDateObj.getUTCFullYear()}`
    }
    if (view === 'week') {
      const ws = startOfWeek(currentDateObj)
      const we = addDays(ws, 6)
      return `${ws.getUTCDate()} – ${we.getUTCDate()} de ${MONTH_NAMES[we.getUTCMonth()]} ${we.getUTCFullYear()}`
    }
    return currentDateObj.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })
  }, [currentDate, view])

  const professionals = calendar?.professionals ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Agendamentos</h2>
          <p className="text-sm text-muted-foreground capitalize">{displayLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-md border overflow-hidden">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent'
                }`}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={currentDate === todayStr ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentDate(todayStr)}
            >
              Hoje
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setCreating(true)}>+ Novo Agendamento</Button>
        </div>
      </div>

      {/* Calendar */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Carregando…</div>
      ) : view === 'day' ? (
        <DayView professionals={professionals} onSlotClick={setSelectedSlot} />
      ) : view === 'week' ? (
        <WeekView
          professionals={professionals}
          weekStart={startOfWeek(currentDateObj)}
          onSlotClick={setSelectedSlot}
        />
      ) : (
        <MonthView
          professionals={professionals}
          monthStart={startOfMonth(currentDateObj)}
          onSlotClick={setSelectedSlot}
          onDayClick={handleDayClick}
        />
      )}

      {/* Status legend */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {(Object.entries(STATUS_LABEL) as [AppointmentStatus, string][]).map(([k, v]) => (
          <span key={k} className={`rounded-full px-2.5 py-0.5 font-medium ${STATUS_COLOR[k]}`}>{v}</span>
        ))}
      </div>

      {/* Slot action dialog */}
      {selectedSlot && selectedSlot.type === 'appointment' && (
        <Dialog open onClose={() => setSelectedSlot(null)}>
          <DialogTitle>Detalhes do Agendamento</DialogTitle>
          <div className="mt-4">
            <SlotActions slot={selectedSlot} onClose={() => setSelectedSlot(null)} />
          </div>
        </Dialog>
      )}

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
