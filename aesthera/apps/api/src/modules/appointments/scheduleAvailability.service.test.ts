/**
 * scheduleAvailability.service.test.ts
 *
 * Cobre as regras de carregamento dinâmico (filtros encadeados) R01–R06:
 *   R01 — Apenas profissionais habilitados para o serviço são carregados
 *   R02 — Equipamento pré-selecionado filtra horários disponíveis
 *   R03 — Sala pré-selecionada filtra horários disponíveis
 *   R04 — Equipamento + Sala combinados filtram horários com ambas as restrições
 *   R05 — Profissional pré-selecionado mostra apenas seus horários livres por slot específico
 *   R06 — Profissional específico filtra horários da disponibilidade retornada
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted: mock do repositório de agendamentos ─────────────────────────────
const mockRepo = vi.hoisted(() => ({
  getProfessionalWorkingHours: vi.fn(),
  getConflictingAppointments: vi.fn(),
  getBlockedSlotsForDate: vi.fn(),
}))

// ── Hoisted: mock do prisma ──────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  service: { findFirst: vi.fn() },
  professional: { findMany: vi.fn() },
  businessHour: { findFirst: vi.fn() },
  appointmentEquipment: { findMany: vi.fn() },
  appointment: { findMany: vi.fn() },
}))

vi.mock('../../database/prisma/client', () => ({ prisma: mockPrisma }))

vi.mock('./appointments.repository', () => ({
  AppointmentsRepository: vi.fn(function AppointmentsRepository() {
    return mockRepo
  }),
}))

import { NotFoundError } from '../../shared/errors/app-error'
import { ScheduleAvailabilityService } from './scheduleAvailability.service'

// ── Fábricas de dados de teste ────────────────────────────────────────────────

function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: 'service-1',
    name: 'Limpeza de Pele',
    durationMinutes: 30,
    active: true,
    ...overrides,
  }
}

function makeProfessional(overrides: Record<string, unknown> = {}) {
  return {
    id: 'professional-1',
    name: 'Dra. Ana Lima',
    speciality: 'Esteticista',
    ...overrides,
  }
}

/**
 * Configura mockPrisma.professional.findMany para as duas chamadas paralelas
 * em getQualifyingProfessionals:
 *   1ª chamada: profissionais com serviceId explícito (withService)
 *   2ª chamada: profissionais com allServices=true (withAllServices)
 */
function setupQualifyingProfessionals(
  withService: ReturnType<typeof makeProfessional>[],
  withAllServices: ReturnType<typeof makeProfessional>[] = [],
  fallback?: ReturnType<typeof makeProfessional>[],
) {
  const fn = mockPrisma.professional.findMany
  fn.mockResolvedValueOnce(withService).mockResolvedValueOnce(withAllServices)
  if (fallback) {
    fn.mockResolvedValueOnce(fallback)
  }
}

// ── Suítes de testes ─────────────────────────────────────────────────────────

describe('ScheduleAvailabilityService', () => {
  let service: ScheduleAvailabilityService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ScheduleAvailabilityService()
  })

  // ── R01 — Profissionais por serviço ──────────────────────────────────────────
  describe('R01 — getAvailableProfessionals: apenas profissionais habilitados para o serviço', () => {
    it('deve retornar apenas profissionais com atribuição explícita ao serviço', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '18:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals('clinic-1', 'service-1', '2026-03-25')

      expect(result.professionals).toHaveLength(1)
      expect(result.professionals[0]).toMatchObject({
        id: 'professional-1',
        name: 'Dra. Ana Lima',
      })
    })

    it('deve incluir profissional com allServices=true mesmo sem atribuição explícita ao serviço', async () => {
      const profAllServices = makeProfessional({ id: 'prof-all', name: 'Dr. Carlos Mendes' })
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      // withService → nenhum; withAllServices → profAllServices
      setupQualifyingProfessionals([], [profAllServices])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '18:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals('clinic-1', 'service-1', '2026-03-25')

      expect(result.professionals).toHaveLength(1)
      expect(result.professionals[0].id).toBe('prof-all')
    })

    it('deve usar fallback para todos os profissionais ativos quando nenhum está vinculado ao serviço', async () => {
      const prof1 = makeProfessional({ id: 'prof-1', name: 'Dra. Ana' })
      const prof2 = makeProfessional({ id: 'prof-2', name: 'Dr. Bruno' })
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      // withService → []; withAllServices → []; fallback → [prof1, prof2]
      setupQualifyingProfessionals([], [], [prof1, prof2])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '18:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals('clinic-1', 'service-1', '2026-03-25')

      // Fallback retorna todos — comportamento documentado (ver gap R01 se necessário restringir)
      expect(result.professionals).toHaveLength(2)
    })

    it('deve lançar NotFoundError quando o serviço não existe ou não está ativo', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null)

      await expect(
        service.getAvailableProfessionals('clinic-1', 'service-inexistente', '2026-03-25'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── R05 — Profissional disponível em slot específico ─────────────────────────
  describe('R05 — getAvailableProfessionals com time: disponibilidade no horário exato', () => {
    it('deve marcar profissional como available=true quando está livre no horário solicitado', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '18:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals(
        'clinic-1',
        'service-1',
        '2026-03-25',
        '14:00',
      )

      expect(result.professionals[0]).toMatchObject({
        id: 'professional-1',
        available: true,
      })
    })

    it('deve marcar profissional como available=false quando tem agendamento no horário solicitado', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '18:00',
      })
      // Agendamento existente às 10:00 por 60 min — conflita com time='10:00'
      mockRepo.getConflictingAppointments.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
          durationMinutes: 60,
        },
      ])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals(
        'clinic-1',
        'service-1',
        '2026-03-25',
        '10:00',
      )

      expect(result.professionals[0]).toMatchObject({
        id: 'professional-1',
        available: false,
      })
    })

    it('deve marcar profissional como available=false quando horário solicitado está fora do expediente', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      // Expediente: 09:00–17:00; solicitando 17:30 (fora do horário)
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals(
        'clinic-1',
        'service-1',
        '2026-03-25',
        '17:30',
      )

      expect(result.professionals[0]).toMatchObject({ available: false })
    })

    it('deve usar horário de funcionamento da clínica como fallback quando profissional não tem expediente', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      // Profissional sem expediente configurado
      mockRepo.getProfessionalWorkingHours.mockResolvedValue(null)
      // Fallback: horário de funcionamento da clínica
      mockPrisma.businessHour.findFirst.mockResolvedValue({
        openTime: '09:00',
        closeTime: '18:00',
        isOpen: true,
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals(
        'clinic-1',
        'service-1',
        '2026-03-25',
        '10:00',
      )

      // Com fallback de clínica configurado, profissional aparece disponível às 10:00
      expect(result.professionals[0]).toMatchObject({ available: true })
    })

    it('deve marcar available=false quando profissional não tem expediente e clínica não tem horário', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue(null)
      mockPrisma.businessHour.findFirst.mockResolvedValue(null) // clínica sem horário
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableProfessionals(
        'clinic-1',
        'service-1',
        '2026-03-25',
        '10:00',
      )

      expect(result.professionals[0]).toMatchObject({ available: false })
    })
  })

  // ── R02 — Horários filtrados por equipamento ──────────────────────────────────
  describe('R02 — getAvailableSlots: equipamento pré-selecionado filtra horários', () => {
    /**
     * Cenário: serviço de 30 min, expediente 09:00–12:00, equipamento ocupado das 10:00–11:00.
     *
     * Slots candidatos (sem filtros):
     *   09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15, 11:30
     *
     * Lógica de filtro (overlap: slotStart < busyEnd && slotEnd > busyStart onde busyStart=600, busyEnd=660):
     *   09:45 (slotEnd=615): 585 < 660 && 615 > 600 → BLOQUEADO
     *   10:00 (slotEnd=630): BLOQUEADO
     *   10:15, 10:30, 10:45: BLOQUEADOS
     *   11:00 (slotStart=660): 660 < 660 = FALSE → LIVRE
     *
     * Resultado esperado: [09:00, 09:15, 09:30, 11:00, 11:15, 11:30]
     */
    it('deve excluir horários onde o equipamento está ocupado (sobreposição real)', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '12:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      // Equipamento ocupado das 10:00–11:00
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([
        {
          equipmentId: 'equip-1',
          appointment: {
            scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
            durationMinutes: 60,
          },
        },
      ])

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        undefined,
        ['equip-1'],
      )

      // Slots bloqueados pelo equipamento (09:45 a 10:45)
      expect(result.slots).not.toContain('09:45')
      expect(result.slots).not.toContain('10:00')
      expect(result.slots).not.toContain('10:15')
      expect(result.slots).not.toContain('10:30')
      expect(result.slots).not.toContain('10:45')

      // Slots antes e após a janela do equipamento permanecem disponíveis
      expect(result.slots).toContain('09:00')
      expect(result.slots).toContain('09:15')
      expect(result.slots).toContain('09:30')
      expect(result.slots).toContain('11:00')
    })

    it('deve manter todos os horários quando equipamento está completamente livre no dia', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '10:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([]) // sem ocupação

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        undefined,
        ['equip-1'],
      )

      // Expediente 09:00–10:00, serviço 30 min → slots: 09:00, 09:15, 09:30
      expect(result.slots).toContain('09:00')
      expect(result.slots).toContain('09:30')
      expect(result.slots).toHaveLength(3)
    })

    it('deve considerar slots adjacentes ao equipamento como livres (sem sobreposição)', async () => {
      // Equipamento ocupado das 09:00–09:30; slot seguinte às 09:30 deve estar livre
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '11:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      // Equipamento ocupado exatamente até 09:30
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([
        {
          equipmentId: 'equip-1',
          appointment: {
            scheduledAt: new Date('2026-03-25T09:00:00.000Z'),
            durationMinutes: 30, // termina às 09:30
          },
        },
      ])

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        undefined,
        ['equip-1'],
      )

      // 09:00 bloqueado (slot termina 09:30, equipamento começa 09:00 → overlap)
      expect(result.slots).not.toContain('09:00')
      // 09:30 livre: slotStart=570, busyEnd=570 → 570 < 570 = FALSE → sem overlap
      expect(result.slots).toContain('09:30')
    })
  })

  // ── R03 — Horários filtrados por sala ─────────────────────────────────────────
  describe('R03 — getAvailableSlots: sala pré-selecionada filtra horários', () => {
    it('deve excluir horários onde a sala está ocupada', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '12:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      // Sala ocupada das 10:00–11:00 (mesma lógica do equipamento)
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
          durationMinutes: 60,
        },
      ])

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        undefined,
        undefined,
        'room-1',
      )

      // Slots bloqueados pela sala
      expect(result.slots).not.toContain('09:45')
      expect(result.slots).not.toContain('10:00')
      expect(result.slots).not.toContain('10:45')

      // Slots livres permanecem
      expect(result.slots).toContain('09:00')
      expect(result.slots).toContain('11:00')
    })

    it('deve manter todos os horários quando sala está livre', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '10:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      mockPrisma.appointment.findMany.mockResolvedValue([]) // sala livre

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        undefined,
        undefined,
        'room-1',
      )

      expect(result.slots).toContain('09:00')
      expect(result.slots).toContain('09:30')
    })
  })

  // ── R04 — Equipamento + Sala combinados ───────────────────────────────────────
  describe('R04 — getAvailableSlots: equipamento E sala filtram horários simultaneamente', () => {
    /**
     * Cenário: serviço 30min, expediente 09:00–12:00
     *   Equipamento ocupado: 10:00–11:00 → bloqueia 09:45–10:45
     *   Sala ocupada:        09:00–10:00 → bloqueia 09:00–09:30 (e 09:00 já, mas 09:30 termina em 10:00)
     *
     * Análise detalhada (sala ocupada: busyStart=540, busyEnd=600):
     *   09:00 (end=570): 540<600 && 570>540 → BLOQUEADO pela sala
     *   09:15 (end=585): BLOQUEADO pela sala
     *   09:30 (end=600): 570<600 && 600>540 → BLOQUEADO pela sala
     *   09:45–10:45:     BLOQUEADOS pelo equipamento (após filtro da sala, esses slots já teriam sido
     *                    removidos do resultado intermediário)
     *   11:00, 11:15, 11:30: LIVRES (ambos os recursos disponíveis)
     */
    it('deve excluir horários bloqueados por equipamento OU sala (interseção de restrições)', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '12:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      // Equipamento ocupado: 10:00–11:00
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([
        {
          equipmentId: 'equip-1',
          appointment: {
            scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
            durationMinutes: 60,
          },
        },
      ])
      // Sala ocupada: 09:00–10:00
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T09:00:00.000Z'),
          durationMinutes: 60,
        },
      ])

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        undefined,
        ['equip-1'],
        'room-1',
      )

      // Todos os slots de 09:00–10:45 bloqueados (por sala ou equipamento)
      expect(result.slots).not.toContain('09:00')
      expect(result.slots).not.toContain('09:15')
      expect(result.slots).not.toContain('09:30')
      expect(result.slots).not.toContain('09:45')
      expect(result.slots).not.toContain('10:00')
      expect(result.slots).not.toContain('10:15')
      expect(result.slots).not.toContain('10:30')
      expect(result.slots).not.toContain('10:45')

      // 11:00 em diante: ambos os recursos livres
      expect(result.slots).toContain('11:00')
      expect(result.slots).toContain('11:15')
      expect(result.slots).toContain('11:30')
    })

    it('deve retornar lista completa quando tanto equipamento quanto sala estão livres', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '10:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([])
      mockPrisma.appointment.findMany.mockResolvedValue([])

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        undefined,
        ['equip-1'],
        'room-1',
      )

      expect(result.slots).toContain('09:00')
      expect(result.slots).toContain('09:30')
    })
  })

  // ── R06 — Horários por profissional específico ────────────────────────────────
  describe('R06 — getAvailableSlots com professionalId: apenas slots do profissional selecionado', () => {
    it('deve considerar apenas a agenda do profissional selecionado', async () => {
      // Serviço 60 min, expediente 09:00–12:00
      // Profissional tem agendamento das 10:00–11:00 → slot 10:00 bloqueado
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '12:00',
      })
      // Conflito do profissional às 10:00
      mockRepo.getConflictingAppointments.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
          durationMinutes: 60,
        },
      ])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        'professional-1',
      )

      // 10:00 bloqueado; 09:00 e 11:00 livres
      expect(result.slots).not.toContain('10:00')
      expect(result.slots).toContain('09:00')
      expect(result.slots).toContain('11:00')
    })

    it('deve retornar lista vazia quando profissional não tem horário de trabalho configurado', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 60 }))
      setupQualifyingProfessionals([makeProfessional()])
      // Sem expediente e sem fallback de clínica
      mockRepo.getProfessionalWorkingHours.mockResolvedValue(null)
      mockPrisma.businessHour.findFirst.mockResolvedValue(null)

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        'professional-1',
      )

      expect(result.slots).toHaveLength(0)
    })

    it('deve lançar NotFoundError quando o serviço não existe', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null)

      await expect(
        service.getAvailableSlots('clinic-1', 'service-inexistente', '2026-03-25', 'professional-1'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('deve combinar filtro de profissional com equipamento corretamente (R06 + R02)', async () => {
      // Profissional selecionado E equipamento pré-selecionado
      // Profissional livre; equipamento ocupado 10:00–11:00
      mockPrisma.service.findFirst.mockResolvedValue(makeService({ durationMinutes: 30 }))
      setupQualifyingProfessionals([makeProfessional()])
      mockRepo.getProfessionalWorkingHours.mockResolvedValue({
        startTime: '09:00',
        endTime: '12:00',
      })
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([
        {
          equipmentId: 'equip-1',
          appointment: {
            scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
            durationMinutes: 60,
          },
        },
      ])

      const result = await service.getAvailableSlots(
        'clinic-1',
        'service-1',
        '2026-03-25',
        'professional-1',
        ['equip-1'],
      )

      expect(result.slots).not.toContain('10:00')
      expect(result.slots).toContain('09:00')
      expect(result.slots).toContain('11:00')
    })
  })
})
