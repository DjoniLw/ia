'use client'

import { ChevronLeft, ChevronRight, LayoutGrid, CheckCircle2, CalendarDays, Package } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
  useAvailableRooms,
  useAvailableSlots,
  useCalendar,
  useCreateAppointment,
} from '@/lib/hooks/use-appointments'
import { useAvailableSessionsForService } from '@/lib/hooks/use-packages'
import { useCustomers, useGetCustomer, useAvailableEquipment, useEquipment, useProfessionals, useRooms, useServices } from '@/lib/hooks/use-resources'

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
  roomId?: string
  packageSessionId?: string
}

function CreateAppointmentForm({
  defaultDate,
  onSave,
  isPending,
  prefillTime,
  prefillProfessionalId,
  onDirtyChange,
}: {
  defaultDate: string
  onSave: (data: Omit<CreateFormValues, 'equipmentIds'>, equipmentIds: string[]) => Promise<void>
  isPending: boolean
  prefillTime?: string
  prefillProfessionalId?: string
  onDirtyChange?: (dirty: boolean) => void
}) {
  // ── Step state ────────────────────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const debounceRef = useMemo(() => ({ timer: undefined as ReturnType<typeof setTimeout> | undefined }), [])

  const [serviceId, setServiceId] = useState('')
  // durationOverride: editable copy of the service duration (never 0)
  const [durationOverride, setDurationOverride] = useState<number | ''>('')
  const [date, setDate] = useState(defaultDate)
  // professionalFilter: user optionally pre-selects a professional to filter slots
  const [professionalFilter, setProfessionalFilter] = useState(prefillProfessionalId ?? '')
  // selectedTime: user picks a slot from the grid
  const [selectedTime, setSelectedTime] = useState(prefillTime ?? '')
  // finalProfessionalId: the professional confirmed for submission
  const [finalProfessionalId, setFinalProfessionalId] = useState(prefillProfessionalId ?? '')
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([])
  const [roomId, setRoomId] = useState('')
  const [notes, setNotes] = useState('')

  // ── Combobox state for service and professional ───────────────────────────
  const [serviceSearch, setServiceSearch] = useState('')
  const [showServiceDropdown, setShowServiceDropdown] = useState(false)
  const [profSearch, setProfSearch] = useState('')
  const [showProfDropdown, setShowProfDropdown] = useState(false)
  const [equipmentFilter, setEquipmentFilter] = useState('')

  // ── Package session state ─────────────────────────────────────────────────
  const [usePackageSession, setUsePackageSession] = useState(false)
  const [selectedPackageSessionId, setSelectedPackageSessionId] = useState('')
  const [showPackageWarning, setShowPackageWarning] = useState(false)

  // ── Validation error state ─────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(false)

  // ── API data ──────────────────────────────────────────────────────────────────
  const { data: allServices, isLoading: servicesLoading } = useServices({ active: 'true', limit: '100' })

  // All active professionals — used as a fallback when the availability API returns empty
  const { data: allProfsData } = useProfessionals({ active: 'true', limit: '100' })

  const { data: custSearchData } = useCustomers(
    customerSearchDebounced.trim().length >= 1
      ? { search: customerSearchDebounced.trim(), limit: '20' }
      : undefined,
  )
  const searchResults = custSearchData?.items ?? []

  // Available slots: driven by service + date.
  // When a professional, equipment, or room is pre-selected BEFORE a time is chosen,
  // pass those as filters so only compatible slots are shown.
  const slotsParams = useMemo(() => {
    if (!serviceId || !date) return null
    return {
      serviceId,
      date,
      // Always forward pre-filters — including after a time has been selected — so
      // the slot grid never reloads with a different (unfiltered) query when the user
      // clicks a time slot.
      professionalId: professionalFilter || undefined,
      // All selected equipment IDs as a comma-separated string so the backend returns
      // only slots where every selected equipment item is simultaneously free.
      equipmentId: selectedEquipmentIds.length > 0 ? selectedEquipmentIds.join(',') : undefined,
      roomId: roomId || undefined,
    }
  }, [serviceId, date, professionalFilter, selectedEquipmentIds, roomId])

  const { data: slotsData, isFetching: slotsFetching } = useAvailableSlots(slotsParams)

  // Available professionals: filtered by service + date, and further filtered when a time is chosen
  const { data: availProfsData, isFetching: profsFetching } = useAvailableProfessionals(
    serviceId && date ? { serviceId, date, time: selectedTime || undefined } : null,
  )

  // Equipment availability for selected slot
  const selectedServiceObj = (allServices?.items ?? []).find((s) => s.id === serviceId)
  // effectiveDuration: use override (if set) else service default
  const serviceDuration = typeof durationOverride === 'number' && durationOverride > 0
    ? durationOverride
    : (selectedServiceObj?.durationMinutes ?? 0)
  const scheduledAt = date && selectedTime ? `${date}T${selectedTime}:00.000Z` : ''
  const { data: availableEquipment } = useAvailableEquipment(scheduledAt, serviceDuration)
  // Fallback: when no time is selected yet, show all clinic equipment (no availability marks)
  const { data: allEquipmentData } = useEquipment()
  const displayEquipment = availableEquipment ?? (allEquipmentData ?? []).filter((eq) => eq.active)

  // Room availability for selected slot; fallback to active rooms only
  const { data: availableRoomsData } = useAvailableRooms(
    scheduledAt && serviceDuration > 0 ? { scheduledAt, durationMinutes: serviceDuration } : null,
  )
  const { data: allRoomsData } = useRooms()
  const displayRooms = availableRoomsData ?? (allRoomsData ?? []).filter((r) => r.active).map((r) => ({ ...r, available: true as const }))

  // Package sessions available for the selected customer + service
  const { data: availablePackageSessions } = useAvailableSessionsForService(customerId, serviceId)
  const hasPackageSessions = (availablePackageSessions?.length ?? 0) > 0

  // ── Derived ───────────────────────────────────────────────────────────────────
  const slots = slotsData?.slots ?? []

  // Client-side filter: professionals who can perform the selected service.
  // The API already includes `services[]` on every professional record.
  const serviceFilteredProfs = useMemo(() => {
    const all = allProfsData?.items ?? []
    if (!serviceId) return all
    return all.filter(
      (p) => p.allServices || (p.services ?? []).some((s) => s.service.id === serviceId),
    )
  }, [allProfsData, serviceId])

  // When service+date are both known AND the availability API returned results,
  // use those results (they carry available/unavailable marks).
  // Otherwise fall back to the service-filtered list (everyone marked available).
  const profListFromApi = availProfsData?.professionals ?? []
  const profList = useMemo(() => {
    // Use the API result whenever it has actually responded (even if empty),
    // so that services with no associated professionals show an empty list.
    if (serviceId && date && availProfsData !== undefined) {
      return profListFromApi.map((p) => ({
        ...p,
        // Only mark as unavailable AFTER a time has been selected.
        // Without a time, "occupied at this time" has no meaning.
        available: selectedTime ? p.available : true,
      }))
    }
    return serviceFilteredProfs.map((p) => ({
      id: p.id,
      name: p.name,
      speciality: p.speciality ?? null,
      available: true as const,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profListFromApi, availProfsData, serviceFilteredProfs, serviceId, date, selectedTime])

  // Track dirty state so the parent can show a close-without-saving warning
  useEffect(() => {
    const dirty = !!(customerId || serviceId || notes.trim() || selectedEquipmentIds.length > 0 || roomId || selectedTime || finalProfessionalId)
    onDirtyChange?.(dirty)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, serviceId, notes, selectedEquipmentIds, roomId, selectedTime, finalProfessionalId])

  // Human-readable hint when slots are pre-filtered by professional, equipment, or room
  const slotFilterHint = useMemo(() => {
    if (selectedTime) return null
    const parts: string[] = []
    if (professionalFilter) {
      const prof = profList.find((p) => p.id === professionalFilter)
      if (prof) parts.push(`profissional "${prof.name}"`)
    }
    if (selectedEquipmentIds.length === 1) {
      const eq = (displayEquipment as Array<{ id: string; name: string }>).find(
        (e) => e.id === selectedEquipmentIds[0],
      )
      if (eq) parts.push(`equipamento "${eq.name}"`)
    }
    if (roomId) {
      const rm = displayRooms.find((r) => r.id === roomId)
      if (rm) parts.push(`sala "${rm.name}"`)
    }
    return parts.length > 0 ? `Horários filtrados por: ${parts.join(', ')}` : null
  }, [selectedTime, professionalFilter, selectedEquipmentIds, profList, displayEquipment, roomId, displayRooms])

  // After a time is selected, the finalProfessionalId must come from profList (filtered to available)
  const availableProfIds = new Set(profList.filter((p) => p.available).map((p) => p.id))

  const canSubmit = !!(customerId && serviceId && serviceDuration > 0 && date && selectedTime && finalProfessionalId && roomId)

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleCustomerInput(value: string) {
    setCustomerSearch(value)
    setShowCustomerDropdown(true)
    if (!value) { setCustomerId(''); setCustomerName('') }
    clearTimeout(debounceRef.timer)
    debounceRef.timer = setTimeout(() => setCustomerSearchDebounced(value), 250)
  }

  function handleTimeSelect(time: string) {
    if (selectedTime === time) {
      // Toggle off: deselect the slot but keep equipment, room and professional
      // as the user already filled them — only clear the professional if it
      // had not been chosen yet (professionalFilter is still empty).
      setSelectedTime('')
      return
    }
    setSelectedTime(time)
    // If the pre-selected professional is unavailable at this new time, clear it
    if (finalProfessionalId && !availableProfIds.has(finalProfessionalId)) {
      setFinalProfessionalId('')
    }
  }

  function handleProfessionalChange(profId: string) {
    setProfessionalFilter(profId)
    setFinalProfessionalId(profId)
    // Do NOT reset selectedTime — in the new flow the user picks a time first,
    // then chooses from professionals available at that time.
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!canSubmit) return
    // Warn if there are available package sessions but user hasn't opted to use one
    if (hasPackageSessions && !usePackageSession) {
      setShowPackageWarning(true)
      return
    }
    const pkgSessionId = usePackageSession && selectedPackageSessionId ? selectedPackageSessionId : undefined
    await onSave(
      { customerId, serviceId, date, time: selectedTime, professionalId: finalProfessionalId, notes, packageSessionId: pkgSessionId, roomId: roomId || undefined },
      selectedEquipmentIds,
    )
  }

  async function handleSubmitIgnoringPackage() {
    setShowPackageWarning(false)
    await onSave(
      { customerId, serviceId, date, time: selectedTime, professionalId: finalProfessionalId, notes, roomId: roomId || undefined },
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
        <div className="relative">
          <Input
            placeholder={servicesLoading ? 'Carregando serviços…' : 'Buscar serviço por nome…'}
            value={showServiceDropdown ? serviceSearch : ((allServices?.items ?? []).find(s => s.id === serviceId)?.name ?? serviceSearch)}
            onChange={(e) => { setServiceSearch(e.target.value); setShowServiceDropdown(true) }}
            onFocus={() => { setServiceSearch(''); setShowServiceDropdown(true) }}
            onBlur={() => setTimeout(() => setShowServiceDropdown(false), 150)}
            autoComplete="off"
            disabled={servicesLoading}
          />
          {showServiceDropdown && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-52 overflow-auto">
              {(allServices?.items ?? [])
                .filter((s) => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${s.id === serviceId ? 'bg-muted font-medium' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setServiceId(s.id)
                      setDurationOverride(s.durationMinutes)
                      setServiceSearch('')
                      setShowServiceDropdown(false)
                      setSelectedTime('')
                      setFinalProfessionalId('')
                      setProfessionalFilter('')
                      setUsePackageSession(false)
                      setSelectedPackageSessionId('')
                    }}
                  >
                    {s.name}
                    <span className="ml-1 text-xs text-muted-foreground">({s.durationMinutes} min)</span>
                  </button>
                ))}
              {(allServices?.items ?? []).filter((s) => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum serviço encontrado</p>
              )}
            </div>
          )}
        </div>
        {serviceId && !showServiceDropdown && <p className="text-xs text-green-600">✓ {(allServices?.items ?? []).find(s => s.id === serviceId)?.name}</p>}
        {submitted && !serviceId && <p className="text-xs text-destructive">Selecione um serviço</p>}
      </div>

      {/* 3. Duração do serviço — auto-carregada, editável, nunca 0 */}
      {serviceId && (
        <div className="space-y-2">
          <Label>Tempo do serviço (min) *</Label>
          <Input
            type="number"
            min={1}
            value={durationOverride}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              setDurationOverride(Number.isNaN(v) || v <= 0 ? '' : v)
              // Duration change invalidates existing time slot
              setSelectedTime('')
            }}
            placeholder="Ex: 60"
          />
          {submitted && (typeof durationOverride !== 'number' || durationOverride <= 0) && (
            <p className="text-xs text-destructive">Informe a duração (mínimo 1 min)</p>
          )}
        </div>
      )}

      {/* 4. Equipamentos — optional, shown after service is selected */}
      {serviceId && (
        <div className="space-y-2">
          <Label>
            Equipamentos
            {scheduledAt && serviceDuration > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">(✓ = disponível nesse horário)</span>
            )}
          </Label>
          {(displayEquipment && displayEquipment.length > 0) ? (
            <>
              <Input
                placeholder="Filtrar equipamento por nome…"
                value={equipmentFilter}
                onChange={(e) => setEquipmentFilter(e.target.value)}
                className="mb-1"
              />
              <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background p-2">
                {(displayEquipment as Array<{ id: string; name: string; available?: boolean }>)
                  .filter((eq) => !equipmentFilter || eq.name.toLowerCase().includes(equipmentFilter.toLowerCase()))
                  .map((eq) => {
                    const available = eq.available !== false
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
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum equipamento cadastrado</p>
          )}
        </div>
      )}

      {/* 5. Sala — required, only active rooms */}
      {serviceId && (
        <div className="space-y-2">
          <Label>Sala *</Label>
          {displayRooms.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma sala cadastrada</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {displayRooms.map((r) => {
                const available = r.available !== false
                const selected = roomId === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!available && !selected}
                    onClick={() => {
                      if (available || selected) {
                        setRoomId(selected ? '' : r.id)
                        // Only clear the selected time if no time has been chosen yet,
                        // so that selecting/changing a room pre-filters the slot list
                        // without discarding a time the user already picked.
                        if (!selected && !selectedTime) setSelectedTime('')
                      }
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : !available
                        ? 'border-border bg-muted/50 text-muted-foreground/50 line-through cursor-not-allowed'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {r.name}{!available && ' (ocupada)'}
                  </button>
                )
              })}
            </div>
          )}
          {roomId && (
            <p className="text-xs text-green-600">✓ {displayRooms.find((r) => r.id === roomId)?.name}</p>
          )}
          {submitted && !roomId && <p className="text-xs text-destructive">Selecione uma sala</p>}
        </div>
      )}

      {/* 6. Data */}
      <div className="space-y-2">
        <Label>Data *</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            // Reset time selection when date changes
            setSelectedTime('')
          }}
        />
        {submitted && !date && <p className="text-xs text-destructive">Selecione uma data</p>}
      </div>

      {/* 7. Horários disponíveis — appears once service + date are both set */}
      {serviceId && date && (
        <div className="space-y-2">
          <Label>Horários disponíveis *</Label>

          {slotFilterHint && (
            <p className="text-xs text-muted-foreground">{slotFilterHint}</p>
          )}

          {slotsFetching && (
            <p className="text-xs text-muted-foreground">Buscando horários disponíveis…</p>
          )}

          {!slotsFetching && slots.length === 0 && (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3 text-center">
              Nenhum horário disponível para esta data
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

      {/* 8. Profissional — visible whenever service + date are set */}
      {serviceId && date && (
        <div className="space-y-2">
          <Label>Profissional *</Label>
          {profsFetching && profList.length === 0 ? (
            <p className="text-xs text-muted-foreground">Buscando profissionais disponíveis…</p>
          ) : (
            <div className="relative">
              <Input
                placeholder="Buscar profissional por nome…"
                value={showProfDropdown ? profSearch : (profList.find(p => p.id === finalProfessionalId)?.name ?? profSearch)}
                onChange={(e) => { setProfSearch(e.target.value); setShowProfDropdown(true) }}
                onFocus={() => { setProfSearch(''); setShowProfDropdown(true) }}
                onBlur={() => setTimeout(() => setShowProfDropdown(false), 150)}
                autoComplete="off"
              />
              {showProfDropdown && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg max-h-52 overflow-auto">
                  {profList
                    .filter((p) => !profSearch || p.name.toLowerCase().includes(profSearch.toLowerCase()))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={!p.available}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${p.id === finalProfessionalId ? 'bg-muted font-medium' : ''} ${!p.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (p.available) {
                            handleProfessionalChange(p.id)
                            setProfSearch('')
                            setShowProfDropdown(false)
                          }
                        }}
                      >
                        {p.name}
                        {!p.available && <span className="ml-1 text-xs text-muted-foreground">(ocupado neste horário)</span>}
                      </button>
                    ))}
                  {profList.filter((p) => !profSearch || p.name.toLowerCase().includes(profSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum profissional encontrado</p>
                  )}
                </div>
              )}
            </div>
          )}
          {profList.length === 0 && !profsFetching && (
            <p className="text-xs text-muted-foreground">Nenhum profissional disponível neste horário</p>
          )}
          {finalProfessionalId && !showProfDropdown && (
            <p className="text-xs text-green-600">✓ {profList.find(p => p.id === finalProfessionalId)?.name}</p>
          )}
          {selectedTime && (
            <p className="text-xs text-muted-foreground">Profissionais disponíveis no horário {selectedTime}</p>
          )}
          {submitted && !finalProfessionalId && <p className="text-xs text-destructive">Selecione um profissional</p>}
        </div>
      )}

      {/* 9. Sessões de pacote — shown when customer + service selected and sessions exist */}
      {customerId && serviceId && hasPackageSessions && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Cliente possui{' '}
              <strong>{availablePackageSessions?.length}</strong>/{availablePackageSessions?.[0]?.totalSessions ?? '?'} sessões disponíveis para{' '}
              <strong>{availablePackageSessions?.[0]?.serviceName ?? 'este serviço'}</strong>
            </span>
          </div>

          {/* Use session toggle */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={usePackageSession}
              onChange={(e) => {
                setUsePackageSession(e.target.checked)
                if (!e.target.checked) {
                  setSelectedPackageSessionId('')
                } else if (availablePackageSessions?.length === 1) {
                  setSelectedPackageSessionId(availablePackageSessions[0].session.id)
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border"
            />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Usar sessão do pacote para este agendamento
              <span className="block text-xs font-normal text-amber-600 dark:text-amber-400">
                A sessão será descontada do pacote e não gerará cobrança.
              </span>
            </span>
          </label>

          {/* Session selector — always shown when opted in */}
          {usePackageSession && (
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedPackageSessionId}
              onChange={(e) => setSelectedPackageSessionId(e.target.value)}
            >
              <option value="">Selecione qual sessão usar…</option>
              {availablePackageSessions?.map((entry) => (
                <option key={entry.session.id} value={entry.session.id}>
                  Sessão {entry.sessionNumber}/{entry.totalSessions} — {entry.packageName}
                  {entry.expiresAt ? ` (expira ${new Date(entry.expiresAt).toLocaleDateString('pt-BR')})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Package warning dialog */}
      {showPackageWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-amber-500 flex-shrink-0" />
              <h3 className="font-semibold text-foreground">Pacote disponível não utilizado</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              O cliente possui sessões disponíveis em um pacote para este serviço, mas você não marcou para utilizá-las.
              Deseja continuar <strong>sem usar</strong> o pacote (será gerada uma cobrança separada)?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPackageWarning(false)}>
                Voltar e usar pacote
              </Button>
              <Button type="button" variant="destructive" onClick={handleSubmitIgnoringPackage}>
                Continuar sem pacote
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Observações */}
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
// A timeline view (day or week) where clicking a free slot opens quick scheduling.

function AdvancedScheduleDialog({
  onClose,
  onCreateAppointment,
}: {
  onClose: () => void
  onCreateAppointment: (date: string, time: string, professionalId: string) => void
}) {
  const todayStr = toDateStr(new Date())
  // calendarMode: which view the user is in
  const [calendarMode, setCalendarMode] = useState<'day' | 'week'>('week')
  // currentDate: anchor for both views
  //   - day view  → the selected day
  //   - week view → the Sunday that starts the visible week
  const [currentDate, setCurrentDate] = useState(() =>
    calendarMode === 'week'
      ? toDateStr(startOfWeek(new Date(todayStr + 'T12:00:00Z')))
      : todayStr,
  )

  const { data: calendar, isLoading } = useCalendar({ date: currentDate, view: calendarMode })

  // Days shown in the grid
  const days = useMemo(() => {
    if (calendarMode === 'day') return [currentDate]
    const ws = new Date(currentDate + 'T12:00:00Z')
    return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(ws, i)))
  }, [calendarMode, currentDate])

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

  // ── Navigation helpers ───────────────────────────────────────────────────────
  function navigate(delta: number) {
    const step = calendarMode === 'day' ? delta : delta * 7
    setCurrentDate(toDateStr(addDays(new Date(currentDate + 'T12:00:00Z'), step)))
  }

  function switchMode(mode: 'day' | 'week') {
    if (mode === calendarMode) return
    if (mode === 'week') {
      // snap to the Sunday of the current day
      setCurrentDate(toDateStr(startOfWeek(new Date(currentDate + 'T12:00:00Z'))))
    }
    // for day mode keep currentDate as-is (already a single day)
    setCalendarMode(mode)
  }

  // ── Header label ──────────────────────────────────────────────────────────────
  const headerLabel = useMemo(() => {
    if (calendarMode === 'day') {
      return new Date(currentDate + 'T12:00:00Z').toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    }
    return (
      new Date(currentDate + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' – ' +
      new Date(days[6] + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    )
  }, [calendarMode, currentDate, days])

  // ── Column definitions (week view: outer=day, inner=professional) ─────────────
  // Each column is a {day, prof} pair. In day view there is only one day.
  const columns = useMemo(() => {
    const cols: { day: string; prof: { id: string; name: string; slots: CalendarSlot[] } }[] = []
    for (const day of days) {
      for (const prof of professionals) {
        cols.push({ day, prof })
      }
    }
    return cols
  }, [days, professionals])

  return (
    <div className="flex flex-col gap-4">
      {/* Navigation + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-3">
          {/* Day / Week toggle */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => switchMode('day')}
              className={`px-3 py-1 transition-colors ${
                calendarMode === 'day'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => switchMode('week')}
              className={`px-3 py-1 border-l transition-colors ${
                calendarMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              Semana
            </button>
          </div>

          <span className="text-sm font-medium capitalize">{headerLabel}</span>
        </div>

        <Button variant="ghost" size="sm" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>}

      {!isLoading && professionals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {calendarMode === 'day' ? 'Nenhum agendamento neste dia' : 'Nenhum agendamento nesta semana'}
        </p>
      )}

      {!isLoading && professionals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background border-b border-r px-2 py-1 text-left font-medium text-muted-foreground w-20">
                  Horário
                </th>
                {columns.map(({ day, prof }) => (
                  <th
                    key={`${day}-${prof.id}`}
                    className="border-b border-r px-2 py-1 text-center font-medium whitespace-nowrap min-w-[80px]"
                  >
                    {calendarMode === 'week' && (
                      <div className="text-muted-foreground font-normal">
                        {new Date(day + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                      </div>
                    )}
                    <div>{prof.name.split(' ')[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour} className="group">
                  <td className="sticky left-0 z-10 bg-background border-b border-r px-2 py-0.5 text-muted-foreground align-top w-20">
                    {String(hour).padStart(2, '0')}:00
                  </td>
                  {columns.map(({ day, prof }) => {
                    const timeStr = `${String(hour).padStart(2, '0')}:00`
                    const slot = apptMap.get(prof.id)?.get(day)?.get(timeStr)
                    return (
                      <td
                        key={`${day}-${prof.id}-${hour}`}
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
                  })}
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

// ──── Customer Quick View ─────────────────────────────────────────────────────

function CustomerQuickView({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: customer, isLoading } = useGetCustomer(customerId)

  function field(label: string, value: string | null | undefined) {
    if (!value) return null
    return (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    )
  }

  return (
    <Dialog open onClose={onClose} className="max-w-md">
      <DialogTitle>Ficha do Cliente</DialogTitle>
      <div className="mt-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {customer && (
          <div className="space-y-3">
            {field('Nome', customer.name)}
            {field('E-mail', customer.email)}
            {field('Telefone', customer.phone)}
            {field('CPF', customer.document)}
            {customer.birthDate && field('Data de nascimento', new Date(customer.birthDate).toLocaleDateString('pt-BR'))}
            {customer.address?.city && field('Cidade', [customer.address.city, customer.address.state].filter(Boolean).join(' – '))}
            {field('Observações', customer.notes)}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Dialog>
  )
}

// ──── Slot Actions Popover ────────────────────────────────────────────────────

function SlotActions({ slot, onClose }: { slot: CalendarSlot; onClose: () => void }) {
  const transitions = useAppointmentTransition(slot.id)
  const status = slot.status!
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null)

  const profName = (slot as CalendarSlot & { _profName?: string })._profName ?? slot.professional?.name

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

  const appointmentDate = slot.start
    ? new Date(slot.start).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
      })
    : null

  const canCancel = status === 'draft' || status === 'confirmed' || status === 'in_progress'

  return (
    <div className="space-y-3">
      <div>
        {appointmentDate && (
          <p className="text-xs text-muted-foreground capitalize mb-1">{appointmentDate}</p>
        )}
        <p className="font-semibold">{slot.customer}</p>
        <p className="text-sm text-muted-foreground">{slot.service}</p>
        {slot.start && <p className="text-sm text-muted-foreground">{formatTime(slot.start)} · {slot.duration}min</p>}
        {profName && (
          <p className="text-sm text-muted-foreground">👤 {profName}</p>
        )}
        {slot.room?.name && (
          <p className="text-sm text-muted-foreground">🚪 {slot.room.name}</p>
        )}
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
        {canCancel && (
          <Button size="sm" variant="destructive" onClick={() => setShowCancelConfirm(true)}>Cancelar</Button>
        )}
        <Button size="sm" variant="outline" type="button" onClick={() => setViewingCustomerId(slot.customerId ?? null)}>
          Ver ficha do cliente
        </Button>
      </div>
      {slot.notes && <p className="text-xs text-muted-foreground border-t pt-2">{slot.notes}</p>}

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Cancelar agendamento?</h3>
            <p className="text-sm text-muted-foreground">
              O agendamento será removido da agenda. Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCancelConfirm(false)}>
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => { setShowCancelConfirm(false); handleAction('cancel') }}
              >
                Cancelar agendamento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer quick view */}
      {viewingCustomerId && (
        <CustomerQuickView customerId={viewingCustomerId} onClose={() => setViewingCustomerId(null)} />
      )}
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
                      onClick={() => onSlotClick({ ...slot, _profName: prof.name } as CalendarSlot)}
                      className={`absolute left-0.5 right-0.5 rounded p-1 text-left overflow-hidden transition-opacity hover:opacity-80 ${EVENT_COLOR[status]}`}
                      style={{ top, height, minHeight: SLOT_PX }}
                    >
                      <div className="text-[10px] font-bold leading-none truncate">
                        {formatTime(slot.start!)}
                      </div>
                      <div className="text-[10px] truncate leading-tight mt-0.5 font-medium">{slot.customer}</div>
                      {height > 32 && <div className="text-[9px] truncate leading-tight opacity-80">{slot.service}</div>}
                      {height > 40 && slot.room?.name && (
                        <div className="text-[9px] truncate leading-tight opacity-70">🚪 {slot.room.name}</div>
                      )}
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

  // Check if there are any appointments in the displayed week
  const hasAnyAppointments = useMemo(() => {
    for (const slots of dayMap.values()) {
      if (slots.length > 0) return true
    }
    return false
  }, [dayMap])

  if (!hasAnyAppointments) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
        <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-30" />
        Nenhum agendamento para esta semana.
      </div>
    )
  }

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
                      {height > 48 && (slot as CalendarSlot).room?.name && (
                        <div className="text-[9px] truncate opacity-70">🚪 {(slot as CalendarSlot).room!.name}</div>
                      )}
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

  // Check if there are any appointments in the displayed month
  const hasAnyAppointments = useMemo(() => {
    for (const slots of dayMap.values()) {
      if (slots.length > 0) return true
    }
    return false
  }, [dayMap])

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

  if (!hasAnyAppointments) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
        <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-30" />
        Nenhum agendamento para este mês.
      </div>
    )
  }

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
  const [formIsDirty, setFormIsDirty] = useState(false)
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
        packageSessionId: formData.packageSessionId,
        roomId: formData.roomId,
      })
      toast.success('Agendamento criado')
      setCreating(false)
      setCreatePrefill(null)
      setFormIsDirty(false)
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
        <Dialog
          open
          onClose={() => { setCreating(false); setCreatePrefill(null); setFormIsDirty(false) }}
          isDirty={formIsDirty}
        >
          <DialogTitle>Novo Agendamento</DialogTitle>
          <div className="mt-4">
            <CreateAppointmentForm
              defaultDate={createPrefill?.date ?? currentDate}
              prefillTime={createPrefill?.time}
              prefillProfessionalId={createPrefill?.professionalId}
              onSave={handleCreate}
              isPending={createAppointment.isPending}
              onDirtyChange={setFormIsDirty}
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}

