'use client'

import { ChevronLeft, ChevronRight, LayoutGrid, CheckCircle2, CalendarDays } from 'lucide-react'
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type AppointmentStatus,
  type CalendarSlot,
  useAppointmentTransition,
  useAvailableProfessionals,
  useAvailableSlots,
  useCalendar,
  useCreateAppointment,
} from '@/lib/hooks/use-appointments'
import { useCustomers, useAvailableEquipment, useServices } from '@/lib/hooks/use-resources'

// ──── Types ─────────────────────────────────────────────────────────────────────

type SlotWithProf = CalendarSlot & { _profName: string }

// ──── Time grid constants ────────────────────────────────────────────────────────
const GRID_START = 7    // 07:00
const GRID_END   = 21   // 21:00
const SLOT_PX    = 16   // pixels per 15-min slot
const HOUR_PX    = SLOT_PX * 4  // 64px per hour
const GRID_H     = (GRID_END - GRID_START) * HOUR_PX  // total grid height

// All scheduledAt values from the API are UTC ISO strings; use UTC accessors throughout
function timeToGridTop(isoOrMinutes: string | number): number {
  let minutes: number
  if (typeof isoOrMinutes === 'number') {
    minutes = isoOrMinutes
  } else {
    const d = new Date(isoOrMinutes)
    minutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  }
  return Math.max(0, (minutes - GRID_START * 60)) * (SLOT_PX / 15)
}

function durationToHeight(minutes: number): number {
  return Math.max(SLOT_PX, minutes * (SLOT_PX / 15))
}

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

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
  in_progress: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-100 dark:border-red-900 line-through',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border border-orange-200 dark:border-orange-800',
}

const EVENT_COLOR: Record<AppointmentStatus, string> = {
  draft: 'bg-gray-200 text-gray-800',
  confirmed: 'bg-blue-500 text-white',
  in_progress: 'bg-amber-500 text-white',
  completed: 'bg-green-500 text-white',
  cancelled: 'bg-red-200 text-red-700 line-through opacity-60',
  no_show: 'bg-orange-400 text-white',
}

// ──── Time Grid Column ─────────────────────────────────────────────────────────

function TimeColumn() {
  return (
    <div className="relative flex-shrink-0 w-12 select-none" style={{ height: GRID_H }}>
      {Array.from({ length: GRID_END - GRID_START }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 flex items-start justify-end pr-1"
          style={{ top: i * HOUR_PX - 7 }}
        >
          <span className="text-[10px] leading-none text-muted-foreground">
            {String(GRID_START + i).padStart(2, '0')}h
          </span>
        </div>
      ))}
    </div>
  )
}

// ──── Time Grid Lines ─────────────────────────────────────────────────────────

function GridLines() {
  const totalSlots = (GRID_END - GRID_START) * 4
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: totalSlots }, (_, i) => {
        const isHour = i % 4 === 0
        const isHalf = i % 4 === 2
        return (
          <div
            key={i}
            className={`absolute left-0 right-0 ${
              isHour
                ? 'border-t border-border'
                : isHalf
                ? 'border-t border-border/40'
                : 'border-t border-border/20'
            }`}
            style={{ top: i * SLOT_PX }}
          />
        )
      })}
    </div>
  )
}

// ──── Create Appointment Form ─────────────────────────────────────────────────

interface CreateFormValues {
  customerId: string
  serviceId: string
  date: string
  time: string
  professionalId: string
  notes: string
  equipmentIds: string[]
}

function CreateAppointmentForm({
  defaultDate,
  onSave,
  isPending,
  prefillTime,
  prefillProfessionalId,
}: {
  defaultDate: string
  onSave: (data: Omit<CreateFormValues, 'equipmentIds'>, equipmentIds: string[]) => Promise<void>
  isPending: boolean
  prefillTime?: string
  prefillProfessionalId?: string
}) {
  // ── Step state ────────────────────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const debounceRef = useMemo(() => ({ timer: undefined as ReturnType<typeof setTimeout> | undefined }), [])

  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate)
  // professionalFilter: user optionally pre-selects a professional to filter slots
  const [professionalFilter, setProfessionalFilter] = useState(prefillProfessionalId ?? '')
  // selectedTime: user picks a slot from the grid
  const [selectedTime, setSelectedTime] = useState(prefillTime ?? '')
  // finalProfessionalId: the professional confirmed for submission
  const [finalProfessionalId, setFinalProfessionalId] = useState(prefillProfessionalId ?? '')
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  // ── Validation error state ─────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(false)

  // ── API data ──────────────────────────────────────────────────────────────────
  const { data: allServices } = useServices({ active: 'true', limit: '200' })

  const { data: custSearchData } = useCustomers(
    customerSearchDebounced.trim().length >= 1
      ? { name: customerSearchDebounced.trim(), limit: '20' }
      : undefined,
  )
  const searchResults = custSearchData?.items ?? []

  // Available slots: driven by service + date + optional professional pre-filter
  const { data: slotsData, isFetching: slotsFetching } = useAvailableSlots(
    serviceId && date ? { serviceId, date, professionalId: professionalFilter || undefined } : null,
  )

  // Available professionals: filtered by service + date, and further filtered when a time is chosen
  const { data: availProfsData } = useAvailableProfessionals(
    serviceId && date ? { serviceId, date, time: selectedTime || undefined } : null,
  )

  // Equipment availability for selected slot
  const selectedServiceObj = (allServices?.items ?? []).find((s) => s.id === serviceId)
  const serviceDuration = selectedServiceObj?.durationMinutes ?? 0
  const scheduledAt = date && selectedTime ? `${date}T${selectedTime}:00.000Z` : ''
  const { data: availableEquipment } = useAvailableEquipment(scheduledAt, serviceDuration)

  // ── Derived ───────────────────────────────────────────────────────────────────
  const slots = slotsData?.slots ?? []

  // The professional list to show is from availProfsData (filtered by service+date+time)
  // When user has a professionalFilter set AND no time selected yet, show availability without time filter
  const profList = availProfsData?.professionals ?? []

  // After a time is selected, the finalProfessionalId must come from profList (filtered to available)
  const availableProfIds = new Set(profList.filter((p) => p.available).map((p) => p.id))

  const canSubmit = !!(customerId && serviceId && date && selectedTime && finalProfessionalId)

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleCustomerInput(value: string) {
    setCustomerSearch(value)
    setShowCustomerDropdown(true)
    if (!value) { setCustomerId(''); setCustomerName('') }
    clearTimeout(debounceRef.timer)
    debounceRef.timer = setTimeout(() => setCustomerSearchDebounced(value), 250)
  }

  function handleTimeSelect(time: string) {
    setSelectedTime(time)
    // If the pre-selected professional is unavailable at this time, clear it
    if (finalProfessionalId && !availableProfIds.has(finalProfessionalId)) {
      setFinalProfessionalId('')
    }
  }

  function handleProfessionalChange(profId: string) {
    setProfessionalFilter(profId)
    setFinalProfessionalId(profId)
    // Reset selected time when professional changes so slots are recalculated
    setSelectedTime('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!canSubmit) return
    await onSave(
      { customerId, serviceId, date, time: selectedTime, professionalId: finalProfessionalId, notes },
      selectedEquipmentIds,
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* 1. Cliente */}
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <div className="relative">
          <Input
            placeholder="Buscar por nome, telefone ou CPF…"
            value={customerSearch || customerName}
            onChange={(e) => handleCustomerInput(e.target.value)}
            onFocus={() => { setCustomerSearch(''); setShowCustomerDropdown(true) }}
            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
            autoComplete="off"
          />
          {showCustomerDropdown && customerSearch.trim().length >= 1 && searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-40 overflow-auto">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setCustomerId(c.id)
                    setCustomerName(c.name)
                    setCustomerSearch('')
                    setShowCustomerDropdown(false)
                  }}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.phone && <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
          {showCustomerDropdown && customerSearch.trim().length >= 1 && searchResults.length === 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg p-3">
              <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          )}
        </div>
        {customerId
          ? <p className="text-xs text-green-600">✓ {customerName}</p>
          : <p className="text-xs text-muted-foreground">Digite para buscar clientes</p>}
        {submitted && !customerId && <p className="text-xs text-destructive">Selecione um cliente</p>}
      </div>

      {/* 2. Serviço */}
      <div className="space-y-2">
        <Label>Serviço *</Label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value)
            setSelectedTime('')
            setFinalProfessionalId('')
            setProfessionalFilter('')
          }}
        >
          <option value="">Selecione um serviço…</option>
          {(allServices?.items ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {submitted && !serviceId && <p className="text-xs text-destructive">Selecione um serviço</p>}
      </div>

      {/* 3. Data */}
      <div className="space-y-2">
        <Label>Data *</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setSelectedTime('')
            setFinalProfessionalId('')
          }}
        />
        {submitted && !date && <p className="text-xs text-destructive">Selecione uma data</p>}
      </div>

      {/* 4. Profissional (optional pre-filter) */}
      {serviceId && date && profList.length > 0 && (
        <div className="space-y-2">
          <Label>Profissional</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={finalProfessionalId}
            onChange={(e) => handleProfessionalChange(e.target.value)}
          >
            <option value="">Todos disponíveis</option>
            {profList.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.name}{!p.available ? ' (ocupado)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {selectedTime
              ? 'Profissionais disponíveis neste horário'
              : 'Selecione um profissional para filtrar os horários (opcional)'}
          </p>
          {submitted && !finalProfessionalId && <p className="text-xs text-destructive">Selecione um profissional</p>}
        </div>
      )}

      {/* 5. Horários disponíveis */}
      {serviceId && date && (
        <div className="space-y-2">
          <Label>
            Horário *
            {professionalFilter && profList.find((p) => p.id === professionalFilter)?.name
              ? ` — ${profList.find((p) => p.id === professionalFilter)!.name}`
              : ' — todos os profissionais disponíveis'}
          </Label>

          {slotsFetching && (
            <p className="text-xs text-muted-foreground">Buscando horários disponíveis…</p>
          )}

          {!slotsFetching && slots.length === 0 && (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3 text-center">
              Nenhum horário disponível para esta data
              {professionalFilter ? ' com este profissional' : ''}
            </p>
          )}

          {slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const isSelected = selectedTime === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleTimeSelect(slot)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="inline-block h-3 w-3 mr-1" />}
                    {slot}
                  </button>
                )
              })}
            </div>
          )}

          {submitted && !selectedTime && (
            <p className="text-xs text-destructive">Selecione um horário</p>
          )}
        </div>
      )}

      {/* 6. Equipamentos */}
      {selectedTime && (
        <div className="space-y-2">
          <Label>
            Equipamentos
            {scheduledAt && serviceDuration > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">(✓ = disponível nesse horário)</span>
            )}
          </Label>
          {(availableEquipment && availableEquipment.length > 0) ? (
            <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background p-2">
              {availableEquipment.map((eq) => {
                const available = 'available' in eq ? eq.available : true
                const selected = selectedEquipmentIds.includes(eq.id)
                return (
                  <button
                    key={eq.id}
                    type="button"
                    disabled={!available && !selected}
                    onClick={() => {
                      if (available || selected) {
                        setSelectedEquipmentIds((prev) =>
                          prev.includes(eq.id) ? prev.filter((e) => e !== eq.id) : [...prev, eq.id],
                        )
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : !available
                        ? 'border-border bg-muted/50 text-muted-foreground/50 line-through cursor-not-allowed'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {eq.name}{!available && ' (ocupado)'}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum equipamento cadastrado</p>
          )}
        </div>
      )}

      {/* 7. Observações */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informações adicionais…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Agendando…' : 'Agendar'}
        </Button>
      </div>
    </form>
  )
}

// ──── Advanced Schedule Dialog ────────────────────────────────────────────────
// A weekly timeline view where clicking a free slot opens quick scheduling.

function AdvancedScheduleDialog({
  onClose,
  onCreateAppointment,
}: {
  onClose: () => void
  onCreateAppointment: (date: string, time: string, professionalId: string) => void
}) {
  const todayStr = toDateStr(new Date())
  const [weekStart, setWeekStart] = useState(() => toDateStr(startOfWeek(new Date(todayStr + 'T12:00:00Z'))))
  const { data: calendar, isLoading } = useCalendar({ date: weekStart, view: 'week' })

  const days = useMemo(() => {
    const ws = new Date(weekStart + 'T12:00:00Z')
    return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(ws, i)))
  }, [weekStart])

  const hours = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i)

  const professionals = calendar?.professionals ?? []

  // Build a lookup: profId → Map<dateStr, Map<HH:MM start, slot>>
  const apptMap = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, CalendarSlot>>>()
    for (const prof of professionals) {
      const byDate = new Map<string, Map<string, CalendarSlot>>()
      for (const slot of prof.slots) {
        if (slot.type !== 'appointment' || !slot.start) continue
        const d = slot.start.slice(0, 10)
        const time = new Date(slot.start)
          .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
        if (!byDate.has(d)) byDate.set(d, new Map())
        byDate.get(d)!.set(time, slot)
      }
      map.set(prof.id, byDate)
    }
    return map
  }, [professionals])

  return (
    <div className="flex flex-col gap-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost" size="sm"
          onClick={() => setWeekStart(toDateStr(addDays(new Date(weekStart + 'T12:00:00Z'), -7)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {new Date(weekStart + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          {' – '}
          {new Date(days[6] + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </span>
        <Button
          variant="ghost" size="sm"
          onClick={() => setWeekStart(toDateStr(addDays(new Date(weekStart + 'T12:00:00Z'), 7)))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>}

      {!isLoading && professionals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento nesta semana</p>
      )}

      {!isLoading && professionals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background border-b border-r px-2 py-1 text-left font-medium text-muted-foreground w-20">Horário</th>
                {professionals.map((prof) =>
                  days.map((day) => (
                    <th
                      key={`${prof.id}-${day}`}
                      className="border-b border-r px-2 py-1 text-center font-medium whitespace-nowrap min-w-[80px]"
                    >
                      <div>{prof.name.split(' ')[0]}</div>
                      <div className="text-muted-foreground font-normal">
                        {new Date(day + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                      </div>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour} className="group">
                  <td className="sticky left-0 z-10 bg-background border-b border-r px-2 py-0.5 text-muted-foreground align-top w-20">
                    {String(hour).padStart(2, '0')}:00
                  </td>
                  {professionals.map((prof) =>
                    days.map((day) => {
                      const timeStr = `${String(hour).padStart(2, '0')}:00`
                      const slot = apptMap.get(prof.id)?.get(day)?.get(timeStr)
                      return (
                        <td
                          key={`${prof.id}-${day}-${hour}`}
                          className={`border-b border-r px-1 py-0.5 align-top min-h-[32px] ${
                            slot ? '' : 'cursor-pointer hover:bg-accent/50'
                          }`}
                          onClick={() => {
                            if (!slot) {
                              onCreateAppointment(day, timeStr, prof.id)
                            }
                          }}
                          title={slot ? `${slot.customer} — ${slot.service}` : `Agendar ${prof.name} às ${timeStr}`}
                        >
                          {slot ? (
                            <div className={`rounded px-1 py-0.5 text-[10px] font-medium truncate ${EVENT_COLOR[slot.status!]}`}>
                              {slot.customer}
                            </div>
                          ) : (
                            <div className="h-5 w-full rounded border border-dashed border-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </td>
                      )
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
      </div>
    </div>
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
        {slot.equipment && slot.equipment.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {slot.equipment.map((eq) => (
              <span key={eq.id} className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {eq.name}
              </span>
            ))}
          </div>
        )}
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

// ──── Day View (time grid) ─────────────────────────────────────────────────────

function DayView({
  professionals,
  onSlotClick,
}: {
  professionals: { id: string; name: string; slots: CalendarSlot[] }[]
  onSlotClick: (slot: CalendarSlot) => void
}) {
  const apptSlots = useMemo(() =>
    professionals.flatMap((p) => p.slots.filter((s) => s.type === 'appointment' && s.start)),
  [professionals])

  const blockedSlots = useMemo(() =>
    professionals.flatMap((p) => p.slots.filter((s) => s.type === 'blocked')),
  [professionals])

  if (professionals.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
        <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-30" />
        Nenhum agendamento para este dia.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Professional headers */}
      <div className="flex border-b">
        <div className="w-12 flex-shrink-0 border-r bg-muted/20" />
        {professionals.map((prof) => (
          <div key={prof.id} className="flex-1 border-r last:border-r-0 px-2 py-2 text-center">
            <p className="text-xs font-semibold truncate">{prof.name}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex overflow-auto" style={{ maxHeight: '70vh' }}>
        <TimeColumn />
        <div className="flex flex-1">
          {professionals.map((prof) => {
            const profAppts = prof.slots.filter((s) => s.type === 'appointment' && s.start)
            const profBlocked = prof.slots.filter((s) => s.type === 'blocked')
            return (
              <div key={prof.id} className="relative flex-1 border-r last:border-r-0" style={{ height: GRID_H }}>
                <GridLines />
                {/* Blocked slots */}
                {profBlocked.map((b) => {
                  if (!b.startTime || !b.endTime) return null
                  const [sh, sm] = b.startTime.split(':').map(Number)
                  const [eh, em] = b.endTime.split(':').map(Number)
                  const top = timeToGridTop(sh * 60 + sm)
                  const height = durationToHeight((eh * 60 + em) - (sh * 60 + sm))
                  return (
                    <div
                      key={b.id}
                      className="absolute left-0.5 right-0.5 rounded border border-dashed border-muted-foreground/30 bg-muted/50 overflow-hidden px-1 py-0.5"
                      style={{ top, height }}
                    >
                      <p className="text-[9px] text-muted-foreground truncate">🔒 {b.reason ?? 'Bloqueado'}</p>
                    </div>
                  )
                })}
                {/* Appointments */}
                {profAppts.map((slot) => {
                  const top = timeToGridTop(slot.start!)
                  const height = durationToHeight(slot.duration ?? 30)
                  const status = slot.status!
                  return (
                    <button
                      key={slot.id}
                      onClick={() => onSlotClick(slot)}
                      className={`absolute left-0.5 right-0.5 rounded p-1 text-left overflow-hidden transition-opacity hover:opacity-80 ${EVENT_COLOR[status]}`}
                      style={{ top, height, minHeight: SLOT_PX }}
                    >
                      <div className="text-[10px] font-bold leading-none truncate">
                        {formatTime(slot.start!)}
                      </div>
                      <div className="text-[10px] truncate leading-tight mt-0.5 font-medium">{slot.customer}</div>
                      {height > 32 && <div className="text-[9px] truncate leading-tight opacity-80">{slot.service}</div>}
                      {height > 48 && slot.equipment && slot.equipment.length > 0 && (
                        <div className="text-[9px] truncate leading-tight opacity-70">
                          🔧 {slot.equipment.map((e) => e.name).join(', ')}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Blocked slots legend (outside the grid) */}
      {blockedSlots.length > 0 && (
        <div className="border-t bg-muted/20 px-4 py-2">
          <p className="text-xs text-muted-foreground">
            🔒 Horários bloqueados: {blockedSlots.map((b) => `${b.startTime}–${b.endTime}`).join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

// ──── Week View (time grid) ────────────────────────────────────────────────────

function WeekView({
  professionals,
  weekStart,
  onSlotClick,
}: {
  professionals: { id: string; name: string; slots: CalendarSlot[] }[]
  weekStart: Date
  onSlotClick: (slot: CalendarSlot) => void
}) {
  // Build map: dateStr -> slots (with professional name)
  const dayMap = useMemo(() => {
    const map = new Map<string, (CalendarSlot & { _profName?: string })[]>()
    for (let i = 0; i < 7; i++) {
      const d = toDateStr(addDays(weekStart, i))
      map.set(d, [])
    }
    for (const prof of professionals) {
      for (const slot of prof.slots) {
        if (slot.type !== 'appointment' || !slot.start) continue
        const dateStr = slot.start.slice(0, 10)
        if (map.has(dateStr)) {
          map.get(dateStr)!.push({ ...slot, _profName: prof.name })
        }
      }
    }
    return map
  }, [professionals, weekStart])

  const todayStr = toDateStr(new Date())

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b">
        <div className="w-12 flex-shrink-0 border-r bg-muted/20" />
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i)
          const dateStr = toDateStr(d)
          const isToday = dateStr === todayStr
          return (
            <div key={i} className={`flex-1 border-r last:border-r-0 px-2 py-2 text-center ${isToday ? 'bg-primary/5' : ''}`}>
              <p className="text-xs font-medium text-muted-foreground">{WEEK_DAYS_SHORT[d.getUTCDay()]}</p>
              <p className={`mt-0.5 text-base font-bold leading-none ${isToday ? 'text-primary' : 'text-foreground'}`}>
                {d.getUTCDate()}
              </p>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="flex overflow-auto" style={{ maxHeight: '70vh' }}>
        <TimeColumn />
        <div className="flex flex-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(weekStart, i)
            const dateStr = toDateStr(d)
            const isToday = dateStr === todayStr
            const slots = dayMap.get(dateStr) ?? []

            // Compute columns to avoid overlap: assign each slot a column index
            type PositionedSlot = (typeof slots)[0] & { _col: number; _totalCols: number }
            const positioned: PositionedSlot[] = []
            const cols: Array<{ endMin: number }[]> = [] // each col holds list of busy intervals

            function slotEndMin(s: typeof slots[0]) {
              const [hh, mm] = s.start!.slice(11, 16).split(':').map(Number)
              return hh * 60 + mm + (s.duration ?? 30)
            }
            function slotStartMin(s: typeof slots[0]) {
              const [hh, mm] = s.start!.slice(11, 16).split(':').map(Number)
              return hh * 60 + mm
            }

            for (const slot of slots) {
              const startMin = slotStartMin(slot)
              const endMin = slotEndMin(slot)
              let assigned = -1
              for (let c = 0; c < cols.length; c++) {
                const busy = cols[c]
                const overlaps = busy.some((b) => startMin < b.endMin && endMin > startMin)
                if (!overlaps) { assigned = c; break }
              }
              if (assigned === -1) { assigned = cols.length; cols.push([]) }
              cols[assigned].push({ endMin })
              positioned.push({ ...slot, _col: assigned, _totalCols: 0 } as PositionedSlot)
            }

            // Determine totalCols: for each slot, find max columns that share any overlap
            for (const ps of positioned) {
              const startMin = slotStartMin(ps)
              const endMin = slotEndMin(ps)
              const overlapping = positioned.filter((other) => {
                const oStart = slotStartMin(other)
                const oEnd = slotEndMin(other)
                return startMin < oEnd && endMin > oStart
              })
              ps._totalCols = Math.max(...overlapping.map((o) => o._col + 1))
            }

            return (
              <div
                key={i}
                className={`relative flex-1 border-r last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}
                style={{ height: GRID_H }}
              >
                <GridLines />
                {positioned.map((slot) => {
                  const top = timeToGridTop(slot.start!)
                  const height = durationToHeight(slot.duration ?? 30)
                  const status = slot.status!
                  const totalCols = slot._totalCols
                  const colW = totalCols > 1 ? `${(100 / totalCols).toFixed(1)}%` : undefined
                  const leftPct = totalCols > 1 ? `${((slot._col / totalCols) * 100).toFixed(1)}%` : undefined
                  return (
                    <button
                      key={slot.id}
                      onClick={() => onSlotClick(slot)}
                      className={`absolute rounded p-1 text-left overflow-hidden transition-opacity hover:opacity-80 ${EVENT_COLOR[status]}`}
                      style={{
                        top,
                        height,
                        minHeight: SLOT_PX,
                        left: leftPct ?? '2px',
                        width: colW ?? 'calc(100% - 4px)',
                      }}
                    >
                      <div className="text-[10px] font-bold leading-none truncate">
                        {formatTime(slot.start!)}
                      </div>
                      {height > 24 && <div className="text-[9px] truncate leading-tight mt-0.5">{slot.customer}</div>}
                      {height > 40 && slot._profName && <div className="text-[9px] truncate opacity-75">{slot._profName}</div>}
                      {height > 56 && slot.equipment && slot.equipment.length > 0 && (
                        <div className="text-[9px] truncate opacity-70">
                          🔧 {slot.equipment.map((e) => e.name).join(', ')}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
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
  const firstDow = monthStart.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const cells: Array<{ dateStr: string; dayNum: number } | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(Date.UTC(year, month, i + 1))
      return { dateStr: toDateStr(d), dayNum: i + 1 }
    }),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEK_DAYS_SHORT.map((d) => (
          <div key={d} className="border-r last:border-r-0 py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
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
  const [createPrefill, setCreatePrefill] = useState<{ date: string; time: string; professionalId: string } | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null)

  const queryView = view === 'month' ? 'week' : view
  const { data: calendar, isLoading } = useCalendar({ date: currentDate, view: queryView })
  const createAppointment = useCreateAppointment()

  const navigate = useCallback(
    (delta: number) => {
      const d = addDays(new Date(currentDate + 'T12:00:00Z'), delta * (view === 'day' ? 1 : view === 'week' ? 7 : 30))
      setCurrentDate(toDateStr(d))
    },
    [currentDate, view],
  )

  function handleDayClick(dateStr: string) {
    setCurrentDate(dateStr)
    setView('day')
  }

  /** Called from both the regular form and the advanced schedule click-to-create */
  async function handleCreate(
    formData: Omit<CreateFormValues, 'equipmentIds'>,
    equipmentIds: string[],
  ) {
    const scheduledAt = new Date(`${formData.date}T${formData.time}:00.000Z`).toISOString()
    try {
      await createAppointment.mutateAsync({
        customerId: formData.customerId,
        professionalId: formData.professionalId,
        serviceId: formData.serviceId,
        scheduledAt,
        notes: formData.notes,
        equipmentIds: equipmentIds.length > 0 ? equipmentIds : undefined,
      })
      toast.success('Agendamento criado')
      setCreating(false)
      setCreatePrefill(null)
      setAdvancedOpen(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar agendamento')
    }
  }

  function handleAdvancedCreateClick(date: string, time: string, professionalId: string) {
    setAdvancedOpen(false)
    setCreatePrefill({ date, time, professionalId })
    setCreating(true)
  }

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
          {/* Agenda Avançada button */}
          <Button variant="outline" onClick={() => setAdvancedOpen(true)}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Agenda Avançada
          </Button>
          <Button onClick={() => { setCreatePrefill(null); setCreating(true) }}>+ Novo Agendamento</Button>
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

      {/* Advanced schedule dialog */}
      {advancedOpen && (
        <Dialog open onClose={() => setAdvancedOpen(false)}>
          <DialogTitle>Agenda Avançada</DialogTitle>
          <div className="mt-4 max-h-[70vh] overflow-y-auto">
            <AdvancedScheduleDialog
              onClose={() => setAdvancedOpen(false)}
              onCreateAppointment={handleAdvancedCreateClick}
            />
          </div>
        </Dialog>
      )}

      {/* Create dialog */}
      {creating && (
        <Dialog open onClose={() => { setCreating(false); setCreatePrefill(null) }}>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <div className="mt-4">
            <CreateAppointmentForm
              defaultDate={createPrefill?.date ?? currentDate}
              prefillTime={createPrefill?.time}
              prefillProfessionalId={createPrefill?.professionalId}
              onSave={handleCreate}
              isPending={createAppointment.isPending}
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}

