/**
 * ScheduleAvailabilityService
 *
 * Centralises all scheduling-availability logic:
 *  - getAvailableSlots:         slots for a service on a date (all qualifying
 *                               professionals, or a specific one)
 *  - getAvailableProfessionals: professionals that can perform a service on a
 *                               date, optionally filtered to a specific time slot
 *
 * This keeps the core AppointmentsService lean and makes the availability rules
 * easy to test and maintain in one place.
 */

import { NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import { AppointmentsRepository } from './appointments.repository'

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function dateToMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function minutesToHHMM(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ProfessionalAvailability {
  id: string
  name: string
  speciality: string | null
  available: boolean
}

export interface AvailableSlotsResult {
  date: string
  slots: string[]
  professionals: { id: string; name: string; slots: string[] }[]
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ScheduleAvailabilityService {
  private repo = new AppointmentsRepository()

  /**
   * Return available time slots for a service on a specific date.
   *
   * If `professionalId` is provided, only that professional's availability is
   * considered. Otherwise, the union of slots across ALL professionals that can
   * perform the service is returned.
   *
   * The `professionals` array in the result lets the UI show per-professional
   * availability so it can filter the professional dropdown based on the chosen
   * time slot.
   */
  async getAvailableSlots(
    clinicId: string,
    serviceId: string,
    date: string,
    professionalId?: string,
  ): Promise<AvailableSlotsResult> {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, clinicId, active: true, deletedAt: null },
    })
    if (!service) throw new NotFoundError('Service')

    const professionals = await this.getQualifyingProfessionals(clinicId, serviceId, professionalId)
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay()
    const dur = service.durationMinutes

    const allSlots = new Set<string>()
    const profSlots: { id: string; name: string; slots: string[] }[] = []

    for (const prof of professionals) {
      const profWH = await this.repo.getProfessionalWorkingHours(prof.id, dayOfWeek)
      // Fall back to clinic business hours when no per-professional hours are set
      const wh: { startTime: string; endTime: string } | null = profWH ?? await (async () => {
        const bh = await prisma.businessHour.findFirst({ where: { clinicId, dayOfWeek, isOpen: true } })
        return bh ? { startTime: bh.openTime, endTime: bh.closeTime } : null
      })()
      if (!wh) continue

      const start = timeToMinutes(wh.startTime)
      const end = timeToMinutes(wh.endTime)

      const [appointments, blockedSlots] = await Promise.all([
        this.repo.getConflictingAppointments(clinicId, prof.id, date),
        this.repo.getBlockedSlotsForDate(clinicId, prof.id, date),
      ])

      const occupied = [
        ...appointments.map((a: { scheduledAt: Date; durationMinutes: number }) => ({
          start: dateToMinutes(a.scheduledAt),
          end: dateToMinutes(a.scheduledAt) + a.durationMinutes,
        })),
        ...blockedSlots.map((b: { startTime: string; endTime: string }) => ({
          start: timeToMinutes(b.startTime),
          end: timeToMinutes(b.endTime),
        })),
      ]

      const slots: string[] = []
      for (let t = start; t + dur <= end; t += 15) {
        const slotEnd = t + dur
        const conflict = occupied.some((o) => t < o.end && slotEnd > o.start)
        if (!conflict) {
          const slot = minutesToHHMM(t)
          slots.push(slot)
          allSlots.add(slot)
        }
      }

      profSlots.push({ id: prof.id, name: prof.name, slots })
    }

    const sortedSlots = [...allSlots].sort()
    return { date, slots: sortedSlots, professionals: profSlots }
  }

  /**
   * Return professionals that can perform `serviceId` on `date`, annotated
   * with an `available` flag.
   *
   * When `time` is provided the flag reflects availability specifically at
   * that time slot (using the service duration). Without `time` the flag
   * reflects whether the professional has ANY availability on that date.
   */
  async getAvailableProfessionals(
    clinicId: string,
    serviceId: string,
    date: string,
    time?: string,
  ): Promise<{ professionals: ProfessionalAvailability[] }> {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, clinicId, active: true, deletedAt: null },
    })
    if (!service) throw new NotFoundError('Service')

    const professionals = await this.getQualifyingProfessionals(clinicId, serviceId)
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay()
    const dur = service.durationMinutes

    const result = await Promise.all(
      professionals.map(async (prof): Promise<ProfessionalAvailability> => {
        const profWH = await this.repo.getProfessionalWorkingHours(prof.id, dayOfWeek)
        // Fall back to clinic business hours when no per-professional hours are set
        const wh: { startTime: string; endTime: string } | null = profWH ?? await (async () => {
          const bh = await prisma.businessHour.findFirst({ where: { clinicId, dayOfWeek, isOpen: true } })
          return bh ? { startTime: bh.openTime, endTime: bh.closeTime } : null
        })()
        if (!wh) return { ...prof, available: false }

        const startMin = timeToMinutes(wh.startTime)
        const endMin = timeToMinutes(wh.endTime)

        const [appointments, blockedSlots] = await Promise.all([
          this.repo.getConflictingAppointments(clinicId, prof.id, date),
          this.repo.getBlockedSlotsForDate(clinicId, prof.id, date),
        ])

        const occupied = [
          ...appointments.map((a: { scheduledAt: Date; durationMinutes: number }) => ({
            start: dateToMinutes(a.scheduledAt),
            end: dateToMinutes(a.scheduledAt) + a.durationMinutes,
          })),
          ...blockedSlots.map((b: { startTime: string; endTime: string }) => ({
            start: timeToMinutes(b.startTime),
            end: timeToMinutes(b.endTime),
          })),
        ]

        if (time) {
          // Check availability at the specific requested time
          const timeMin = timeToMinutes(time)
          if (timeMin < startMin || timeMin + dur > endMin) {
            return { ...prof, available: false }
          }
          const conflict = occupied.some((o) => timeMin < o.end && timeMin + dur > o.start)
          return { ...prof, available: !conflict }
        }

        // No time filter: check if ANY slot is available on this date
        for (let t = startMin; t + dur <= endMin; t += 15) {
          const slotEnd = t + dur
          const conflict = occupied.some((o) => t < o.end && slotEnd > o.start)
          if (!conflict) return { ...prof, available: true }
        }
        return { ...prof, available: false }
      }),
    )

    return { professionals: result }
  }

  /**
   * Returns professionals in this clinic that are qualified to perform
   * `serviceId` (either via an explicit ProfessionalService row or because
   * `allServices = true`).  Optionally restricted to a single professional.
   *
   * If no service-specific professionals are found, falls back to ALL active
   * professionals in the clinic so that availability slots are never silently
   * empty due to missing service-assignment data.
   */
  private async getQualifyingProfessionals(
    clinicId: string,
    serviceId: string,
    specificProfessionalId?: string,
  ) {
    const baseWhere = {
      clinicId,
      active: true,
      deletedAt: null as null | undefined,
      ...(specificProfessionalId ? { id: specificProfessionalId } : {}),
    }

    const [withService, withAllServices] = await Promise.all([
      prisma.professional.findMany({
        where: { ...baseWhere, services: { some: { serviceId } } },
        select: { id: true, name: true, speciality: true },
      }),
      prisma.professional.findMany({
        where: { ...baseWhere, allServices: true },
        select: { id: true, name: true, speciality: true },
      }),
    ])

    // Deduplicate by id
    const map = new Map<string, { id: string; name: string; speciality: string | null }>()
    for (const p of [...withService, ...withAllServices]) map.set(p.id, p)

    // If no professionals are explicitly linked to this service, fall back to
    // ALL active professionals in the clinic so slots are never silently empty.
    if (map.size === 0) {
      const allProfs = await prisma.professional.findMany({
        where: { clinicId, active: true, deletedAt: null, ...(specificProfessionalId ? { id: specificProfessionalId } : {}) },
        select: { id: true, name: true, speciality: true },
      })
      return allProfs.sort((a, b) => a.name.localeCompare(b.name))
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
}
