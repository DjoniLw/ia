/**
 * appointments.service.test.ts
 *
 * Cobre as regras de conflito de agendamento (R07–R12):
 *   R07 — Equipamento ocupado no horário solicitado
 *   R08 — Sala ocupada no horário solicitado
 *   R09 — Profissional ocupado no horário solicitado
 *   R10 — Campos obrigatórios para confirmar agendamento
 *   R11 — Profissional não habilitado para o serviço
 *   R12 — Sobreposição de slot para qualquer recurso
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted: tx representa o cliente de transação passado ao callback ────────
const mockTx = vi.hoisted(() => ({
  $executeRaw: vi.fn().mockResolvedValue(undefined),
  service: { findFirst: vi.fn(), findMany: vi.fn() },
  professional: { findFirst: vi.fn() },
  customer: { findFirst: vi.fn() },
  appointment: { create: vi.fn() },
  appointmentServiceItem: { createMany: vi.fn() },
  appointmentEquipment: { createMany: vi.fn() },
}))

// ── Hoisted: mock do prisma principal (fora da transação) ────────────────────
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  equipment: { findMany: vi.fn() },
  appointmentEquipment: { findMany: vi.fn(), createMany: vi.fn() },
  room: { findFirst: vi.fn() },
  appointment: { findMany: vi.fn() },
  professional: { findFirst: vi.fn(), findMany: vi.fn() },
  service: { findFirst: vi.fn() },
  businessHour: { findFirst: vi.fn() },
  billing: { findUnique: vi.fn() },
  walletEntry: { findMany: vi.fn() },
}))

// ── Hoisted: mock do repositório de agendamentos ─────────────────────────────
const mockRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  transition: vi.fn(),
  getConflictingAppointments: vi.fn(),
  getBlockedSlotsForDate: vi.fn(),
  getProfessionalWorkingHours: vi.fn(),
  checkProfessionalHasService: vi.fn(),
  createBlockedSlot: vi.fn(),
  listBlockedSlots: vi.fn(),
  deleteBlockedSlot: vi.fn(),
  getCalendarAppointments: vi.fn(),
  getCalendarBlockedSlots: vi.fn(),
}))

// ── vi.mock deve vir antes dos imports de módulos que o usam ─────────────────
const mockBillingInstance = vi.hoisted(() => ({
  createForAppointment: vi.fn(),
  createManual: vi.fn(),
}))

const mockBillingRepoInstance = vi.hoisted(() => ({
  findById: vi.fn(),
}))

const mockPackagesInstance = vi.hoisted(() => ({
  linkSession: vi.fn(),
  findLinkedSession: vi.fn(),
  redeemSession: vi.fn(),
  unlinkSession: vi.fn(),
}))

vi.mock('../../database/prisma/client', () => ({ prisma: mockPrisma }))

vi.mock('./appointments.repository', () => ({
  AppointmentsRepository: vi.fn(function AppointmentsRepository() {
    return mockRepo
  }),
}))

vi.mock('../packages/packages.repository', () => ({
  PackagesRepository: vi.fn(function PackagesRepository() {
    return mockPackagesInstance
  }),
}))

vi.mock('../billing/billing.service', () => ({
  BillingService: vi.fn(function BillingService() {
    return mockBillingInstance
  }),
}))

vi.mock('../billing/billing.repository', () => ({
  BillingRepository: vi.fn(function BillingRepository() {
    return mockBillingRepoInstance
  }),
}))

import { NotFoundError } from '../../shared/errors/app-error'
import { AppointmentsService } from './appointments.service'

// ── Fábricas de dados de teste ────────────────────────────────────────────────

function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: 'service-1',
    name: 'Limpeza de Pele',
    durationMinutes: 60,
    price: 15000, // R$ 150,00 em centavos
    active: true,
    ...overrides,
  }
}

function makeProfessional(overrides: Record<string, unknown> = {}) {
  return {
    id: 'professional-1',
    name: 'Dra. Ana Lima',
    speciality: 'Esteticista',
    clinicId: 'clinic-1',
    active: true,
    ...overrides,
  }
}

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'customer-1',
    name: 'João da Silva',
    email: 'joao@clinica.com',
    clinicId: 'clinic-1',
    ...overrides,
  }
}

function makeEquipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'equip-1',
    name: 'Laser Profissional',
    clinicId: 'clinic-1',
    active: true,
    ...overrides,
  }
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1',
    name: 'Sala 1',
    clinicId: 'clinic-1',
    active: true,
    ...overrides,
  }
}

function makeCreatedAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-created',
    clinicId: 'clinic-1',
    customerId: 'customer-1',
    professionalId: 'professional-1',
    serviceId: 'service-1',
    roomId: 'room-1',
    scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
    durationMinutes: 60,
    price: 15000,
    status: 'draft',
    notes: null,
    customer: makeCustomer(),
    professional: makeProfessional(),
    service: makeService(),
    room: makeRoom(),
    equipment: [],
    serviceItems: [],
    ...overrides,
  }
}

/** DTO mínimo válido para criar um agendamento (serviço único). Inclui roomId pois R10 o exige. */
function makeCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    customerId: 'customer-1',
    professionalId: 'professional-1',
    serviceId: 'service-1',
    roomId: 'room-1',
    scheduledAt: '2026-03-25T10:00:00.000Z',
    ...overrides,
  }
}

/**
 * Configura os mocks padrão para uma criação bem-sucedida de agendamento.
 * Cada teste pode sobrescrever individualmente o mock que deseja testar.
 */
function setupHappyPathMocks() {
  // Dentro da transação
  mockTx.service.findFirst.mockResolvedValue(makeService())
  mockTx.professional.findFirst.mockResolvedValue(makeProfessional())
  mockTx.customer.findFirst.mockResolvedValue(makeCustomer())
  mockTx.appointment.create.mockResolvedValue(makeCreatedAppointment())

  // Repositório
  mockRepo.checkProfessionalHasService.mockResolvedValue(true)
  mockRepo.getConflictingAppointments.mockResolvedValue([])
  mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
  mockRepo.create.mockResolvedValue(makeCreatedAppointment())
  mockRepo.findById.mockResolvedValue(makeCreatedAppointment())

  // Prisma externo (para assertEquipmentAvailable / assertRoomAvailable)
  mockPrisma.equipment.findMany.mockResolvedValue([makeEquipment()])
  mockPrisma.appointmentEquipment.findMany.mockResolvedValue([])
  mockPrisma.appointmentEquipment.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.room.findFirst.mockResolvedValue(makeRoom())
  mockPrisma.appointment.findMany.mockResolvedValue([])
}

// ── Suítes de testes ─────────────────────────────────────────────────────────

describe('AppointmentsService', () => {
  let service: AppointmentsService

  beforeEach(() => {
    vi.clearAllMocks()
    // Reconecta $transaction ao mockTx após clearAllMocks (que limpa call counts, não implementations)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
    )
    service = new AppointmentsService()
  })

  // ── R07 — Equipamento ocupado ────────────────────────────────────────────────
  describe('R07 — create(): equipamento ocupado bloqueia o agendamento', () => {
    it('deve criar agendamento quando o equipamento está livre no horário', async () => {
      setupHappyPathMocks()
      mockPrisma.equipment.findMany.mockResolvedValue([makeEquipment()])
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([]) // sem conflitos

      const result = await service.create(
        'clinic-1',
        makeCreateDto({ equipmentIds: ['equip-1'] }),
      )

      expect(result).toMatchObject({ id: 'appt-created', status: 'draft' })
    })

    it('deve lançar EQUIPMENT_CONFLICT (409) quando equipamento já está em uso no horário', async () => {
      setupHappyPathMocks()
      // Equipamento com agendamento conflitante: 10:00–12:00 (conflita com novo às 10:00 por 60 min)
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([
        {
          equipment: { name: 'Laser Profissional' },
          appointment: {
            scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
            durationMinutes: 120,
          },
        },
      ])

      await expect(
        service.create('clinic-1', makeCreateDto({ equipmentIds: ['equip-1'] })),
      ).rejects.toMatchObject({ statusCode: 409, code: 'EQUIPMENT_CONFLICT' })
    })

    it('deve ignorar agendamentos cancelados ao verificar conflito de equipamento', async () => {
      setupHappyPathMocks()
      // A query do Prisma já filtra cancelled/no_show; mockamos sem conflitos ativos
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([])

      const result = await service.create(
        'clinic-1',
        makeCreateDto({ equipmentIds: ['equip-1'] }),
      )

      expect(result).toMatchObject({ status: 'draft' })
    })

    it('deve lançar erro quando equipamento não pertence à clínica', async () => {
      setupHappyPathMocks()
      // findMany retorna menos equipamentos do que o solicitado → algum não pertence à clínica
      mockPrisma.equipment.findMany.mockResolvedValue([]) // nenhum encontrado

      await expect(
        service.create('clinic-1', makeCreateDto({ equipmentIds: ['equip-externo'] })),
      ).rejects.toMatchObject({ code: 'EQUIPMENT_NOT_FOUND' })
    })
  })

  // ── R08 — Sala ocupada ────────────────────────────────────────────────────────
  describe('R08 — create(): sala ocupada bloqueia o agendamento', () => {
    it('deve criar agendamento quando a sala está livre no horário', async () => {
      setupHappyPathMocks()
      mockPrisma.room.findFirst.mockResolvedValue(makeRoom())
      mockPrisma.appointment.findMany.mockResolvedValue([]) // sala livre

      const result = await service.create('clinic-1', makeCreateDto({ roomId: 'room-1' }))

      expect(result).toMatchObject({ id: 'appt-created' })
    })

    it('deve lançar ROOM_CONFLICT (409) quando sala já está ocupada no horário', async () => {
      setupHappyPathMocks()
      mockPrisma.room.findFirst.mockResolvedValue(makeRoom())
      // Sala com agendamento conflitante no mesmo horário
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
          durationMinutes: 60,
        },
      ])

      await expect(
        service.create('clinic-1', makeCreateDto({ roomId: 'room-1' })),
      ).rejects.toMatchObject({ statusCode: 409, code: 'ROOM_CONFLICT' })
    })

    it('deve permitir agendamento em slots adjacentes (sem sobreposição) na mesma sala', async () => {
      setupHappyPathMocks()
      mockPrisma.room.findFirst.mockResolvedValue(makeRoom())
      // Agendamento existente: 09:00–10:00 — novo agendamento começa às 10:00 exatas (sem overlap)
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T09:00:00.000Z'),
          durationMinutes: 60, // termina às 10:00
        },
      ])

      // scheduledAt = 10:00, slotEnd = 11:00; apptEnd = 10:00 → scheduledAt < apptEnd? 10:00 < 10:00 = FALSE
      const result = await service.create('clinic-1', makeCreateDto({ roomId: 'room-1' }))

      expect(result).toMatchObject({ id: 'appt-created' })
    })

    it('deve lançar erro quando sala não pertence à clínica', async () => {
      setupHappyPathMocks()
      mockPrisma.room.findFirst.mockResolvedValue(null) // sala não encontrada

      await expect(
        service.create('clinic-1', makeCreateDto({ roomId: 'sala-inexistente' })),
      ).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' })
    })
  })

  // ── R09 — Profissional ocupado ────────────────────────────────────────────────
  describe('R09 — create(): profissional ocupado bloqueia o agendamento', () => {
    it('deve criar agendamento quando profissional está livre no horário', async () => {
      setupHappyPathMocks()
      // Sem agendamentos conflitantes e sem slots bloqueados
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      const result = await service.create('clinic-1', makeCreateDto())

      expect(result).toMatchObject({ id: 'appt-created', status: 'draft' })
    })

    it('deve lançar SLOT_UNAVAILABLE (409) quando profissional já tem agendamento no horário', async () => {
      setupHappyPathMocks()
      // Agendamento existente: 10:00–11:00 — novo também às 10:00 → overlap
      mockRepo.getConflictingAppointments.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
          durationMinutes: 60,
        },
      ])

      await expect(service.create('clinic-1', makeCreateDto())).rejects.toMatchObject({
        statusCode: 409,
        code: 'SLOT_UNAVAILABLE',
      })
    })

    it('deve lançar SLOT_UNAVAILABLE quando slot bloqueado cobre o horário solicitado', async () => {
      setupHappyPathMocks()
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      // Slot bloqueado: 09:30–11:30 — cobre 10:00–11:00 → overlap
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([
        { startTime: '09:30', endTime: '11:30' },
      ])

      await expect(service.create('clinic-1', makeCreateDto())).rejects.toMatchObject({
        code: 'SLOT_UNAVAILABLE',
      })
    })

    it('deve permitir agendamento quando o horário do profissional é adjacente (sem overlap)', async () => {
      setupHappyPathMocks()
      // Agendamento anterior: 09:00–10:00; novo às 10:00 → sem overlap (ends == starts)
      mockRepo.getConflictingAppointments.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T09:00:00.000Z'),
          durationMinutes: 60, // termina exatamente às 10:00
        },
      ])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      // slotStart=600, conflito.end=540+60=600 → slotStart < conflito.end? 600 < 600 = FALSE → sem conflito
      const result = await service.create('clinic-1', makeCreateDto())

      expect(result).toMatchObject({ status: 'draft' })
    })

    it('deve permitir agendamento quando o próximo slot do profissional começa exatamente no fim do novo', async () => {
      setupHappyPathMocks()
      // Agendamento posterior: 11:00–12:00; novo às 10:00 por 60 min → sem overlap
      mockRepo.getConflictingAppointments.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T11:00:00.000Z'),
          durationMinutes: 60,
        },
      ])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

      // slotStart=600, slotEnd=660; conflito.start=660 → slotEnd > conflito.start? 660 > 660 = FALSE → sem conflito
      const result = await service.create('clinic-1', makeCreateDto())

      expect(result).toMatchObject({ status: 'draft' })
    })
  })

  // ── R10 — Campos obrigatórios ────────────────────────────────────────────────
  describe('R10 — create(): campos obrigatórios para criar agendamento', () => {
    it('deve lançar NotFoundError quando serviço não existe na clínica', async () => {
      setupHappyPathMocks()
      mockTx.service.findFirst.mockResolvedValue(null) // serviço não encontrado

      await expect(service.create('clinic-1', makeCreateDto())).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    it('deve lançar NotFoundError quando profissional não existe na clínica', async () => {
      setupHappyPathMocks()
      mockTx.professional.findFirst.mockResolvedValue(null) // profissional não encontrado

      await expect(service.create('clinic-1', makeCreateDto())).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    it('deve lançar NotFoundError quando cliente não existe na clínica', async () => {
      setupHappyPathMocks()
      mockTx.customer.findFirst.mockResolvedValue(null) // cliente não encontrado

      await expect(service.create('clinic-1', makeCreateDto())).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    it('[GAP-R10] deve lançar ROOM_REQUIRED (400) quando roomId não for fornecido', async () => {
      setupHappyPathMocks()
      await expect(
        service.create('clinic-1', makeCreateDto({ roomId: undefined })), // sem roomId
      ).rejects.toMatchObject({
        message: 'Sala é obrigatória para confirmar o agendamento',
        statusCode: 400,
        code: 'ROOM_REQUIRED',
      })
    })
  })

  // ── R11 — Profissional não habilitado para o serviço ─────────────────────────
  describe('R11 — create(): profissional deve ser habilitado para o serviço', () => {
    it('deve criar agendamento quando profissional está atribuído ao serviço', async () => {
      setupHappyPathMocks()
      mockRepo.checkProfessionalHasService.mockResolvedValue(true)

      const result = await service.create('clinic-1', makeCreateDto())

      expect(result).toMatchObject({ id: 'appt-created' })
      expect(mockRepo.checkProfessionalHasService).toHaveBeenCalledWith(
        'professional-1',
        'service-1',
      )
    })

    it('deve lançar SERVICE_NOT_ASSIGNED (400) quando profissional não executa o serviço', async () => {
      setupHappyPathMocks()
      mockRepo.checkProfessionalHasService.mockResolvedValue(false)

      await expect(service.create('clinic-1', makeCreateDto())).rejects.toMatchObject({
        statusCode: 400,
        code: 'SERVICE_NOT_ASSIGNED',
      })
    })

    it('deve criar agendamento quando profissional tem allServices=true (habilitado para todos)', async () => {
      // checkProfessionalHasService retorna true para profissionais com allServices=true
      setupHappyPathMocks()
      mockRepo.checkProfessionalHasService.mockResolvedValue(true) // allServices=true internamente retorna true

      const result = await service.create('clinic-1', makeCreateDto())

      expect(result).toMatchObject({ status: 'draft' })
    })

    it('deve verificar vínculo profissional–serviço de forma isolada por clínica (multi-tenant)', async () => {
      setupHappyPathMocks()
      // Professional da clínica-2 NÃO deve afetar a clínica-1
      mockRepo.checkProfessionalHasService.mockResolvedValue(false)

      await expect(
        service.create(
          'clinic-1',
          makeCreateDto({ professionalId: 'professional-outra-clinica' }),
        ),
      ).rejects.toMatchObject({ code: 'SERVICE_NOT_ASSIGNED' })
    })
  })

  // ── R12 — Sobreposição de slot para qualquer recurso ─────────────────────────
  describe('R12 — create(): sobreposição bloqueia para qualquer recurso', () => {
    it('deve bloquear quando profissional E equipamento estão ocupados (profissional detectado primeiro)', async () => {
      setupHappyPathMocks()
      // Profissional tem conflito → lança antes de chegar a assertEquipmentAvailable
      mockRepo.getConflictingAppointments.mockResolvedValue([
        {
          scheduledAt: new Date('2026-03-25T10:00:00.000Z'),
          durationMinutes: 60,
        },
      ])
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([
        {
          equipment: { name: 'Laser' },
          appointment: { scheduledAt: new Date('2026-03-25T10:00:00.000Z'), durationMinutes: 60 },
        },
      ])

      await expect(
        service.create('clinic-1', makeCreateDto({ equipmentIds: ['equip-1'] })),
      ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' })
    })

    it('deve bloquear quando somente equipamento está ocupado (profissional livre)', async () => {
      setupHappyPathMocks()
      mockRepo.getConflictingAppointments.mockResolvedValue([]) // profissional livre
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      mockPrisma.equipment.findMany.mockResolvedValue([makeEquipment()])
      // Equipamento ocupado no mesmo horário
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([
        {
          equipment: { name: 'Laser Profissional' },
          appointment: { scheduledAt: new Date('2026-03-25T10:00:00.000Z'), durationMinutes: 60 },
        },
      ])

      await expect(
        service.create('clinic-1', makeCreateDto({ equipmentIds: ['equip-1'] })),
      ).rejects.toMatchObject({ statusCode: 409, code: 'EQUIPMENT_CONFLICT' })
    })

    it('deve bloquear quando somente sala está ocupada (profissional e equipamento livres)', async () => {
      setupHappyPathMocks()
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      mockPrisma.equipment.findMany.mockResolvedValue([makeEquipment()])
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([]) // equipamento livre
      mockPrisma.room.findFirst.mockResolvedValue(makeRoom())
      // Sala ocupada
      mockPrisma.appointment.findMany.mockResolvedValue([
        { scheduledAt: new Date('2026-03-25T10:00:00.000Z'), durationMinutes: 60 },
      ])

      await expect(
        service.create(
          'clinic-1',
          makeCreateDto({ equipmentIds: ['equip-1'], roomId: 'room-1' }),
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: 'ROOM_CONFLICT' })
    })

    it('deve validar os três recursos quando todos estão livres (caminho feliz completo)', async () => {
      setupHappyPathMocks()
      mockRepo.getConflictingAppointments.mockResolvedValue([])
      mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
      mockPrisma.equipment.findMany.mockResolvedValue([makeEquipment()])
      mockPrisma.appointmentEquipment.findMany.mockResolvedValue([])
      mockPrisma.room.findFirst.mockResolvedValue(makeRoom())
      mockPrisma.appointment.findMany.mockResolvedValue([])

      const result = await service.create(
        'clinic-1',
        makeCreateDto({ equipmentIds: ['equip-1'], roomId: 'room-1' }),
      )

      expect(result).toMatchObject({ id: 'appt-created', status: 'draft' })
    })
  })
})

// ── T15-T19: AppointmentsService.complete() ────────────────────────────────────
describe('AppointmentsService.complete()', () => {
  let service: AppointmentsService

  const makeCompletedAppointment = (overrides: Record<string, unknown> = {}) => ({
    id: 'appt-1',
    clinicId: 'clinic-1',
    customerId: 'customer-1',
    serviceId: 'service-1',
    status: 'in_progress',
    serviceItems: [],
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AppointmentsService()
  })

  // T19 — Regressão: complete() NÃO chama o método legado createForAppointment
  // (mas chama createManual, que é o caminho atual)
  it('T19 (regressão): complete() NÃO chama BillingService.createForAppointment automaticamente', async () => {
    const appt = makeCompletedAppointment()
    mockRepo.findById.mockResolvedValue(appt)
    mockRepo.transition.mockResolvedValue({ ...appt, status: 'completed' })

    // Packages repo — referência direta via mockPackagesInstance (sem dynamic import + if)
    mockPackagesInstance.findLinkedSession.mockResolvedValue(null)

    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-t19' })
    mockBillingRepoInstance.findById.mockResolvedValue({ id: 'billing-t19', status: 'pending' })
    mockPrisma.walletEntry.findMany.mockResolvedValue([])
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-1' })
    mockBillingRepoInstance.findById.mockResolvedValue({ id: 'billing-1', sourceType: 'APPOINTMENT', status: 'pending', amount: 0 })

    await service.complete('clinic-1', 'appt-1')

    // Assertiva determinística — nunca silenciosamente pulada
    expect(mockBillingInstance.createForAppointment).not.toHaveBeenCalled()
  })

  // T16 — complete() retorna serviceVouchers quando há vouchers SERVICE_PRESALE ativos
  it('T16: complete() retorna serviceVouchers com vouchers SERVICE_PRESALE ativos', async () => {
    const appt = makeCompletedAppointment({ serviceId: 'service-1' })
    mockRepo.findById.mockResolvedValue(appt)
    mockRepo.transition.mockResolvedValue({ ...appt, status: 'completed' })

    mockPackagesInstance.findLinkedSession.mockResolvedValue(null)

    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-t16' })
    mockBillingRepoInstance.findById.mockResolvedValue({ id: 'billing-t16', status: 'pending' })
    mockPrisma.walletEntry.findMany.mockResolvedValue([
      { id: 'voucher-1', serviceId: 'service-1', balance: 20000, expirationDate: null, code: 'VCHR-ABC1' },
    ])
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-1' })
    mockBillingRepoInstance.findById.mockResolvedValue({ id: 'billing-1', sourceType: 'APPOINTMENT', status: 'pending', amount: 0 })

    const result = await service.complete('clinic-1', 'appt-1')

    expect(result).toMatchObject({ serviceVouchers: [{ id: 'voucher-1' }] })
  })

  // T17 — complete() retorna serviceVouchers vazio quando não há vouchers ativos
  it('T17: complete() retorna serviceVouchers=[] quando não há vouchers SERVICE_PRESALE', async () => {
    const appt = makeCompletedAppointment()
    mockRepo.findById.mockResolvedValue(appt)
    mockRepo.transition.mockResolvedValue({ ...appt, status: 'completed' })

    mockPackagesInstance.findLinkedSession.mockResolvedValue(null)

    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-t17' })
    mockBillingRepoInstance.findById.mockResolvedValue({ id: 'billing-t17', status: 'pending' })
    mockPrisma.walletEntry.findMany.mockResolvedValue([])
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-1' })
    mockBillingRepoInstance.findById.mockResolvedValue({ id: 'billing-1', sourceType: 'APPOINTMENT', status: 'pending', amount: 0 })

    const result = await service.complete('clinic-1', 'appt-1')

    expect(result).toMatchObject({ serviceVouchers: [] })
  })

  // T18 — complete() retorna { appointment, serviceVouchers: [] } para agendamento via pacote
  it('T18: complete() retorna serviceVouchers=[] quando appointment usa linkedSession (pacote)', async () => {
    const appt = makeCompletedAppointment()
    mockRepo.findById.mockResolvedValue(appt)
    mockRepo.transition.mockResolvedValue({ ...appt, status: 'completed' })

    mockPackagesInstance.findLinkedSession.mockResolvedValue({ id: 'pkg-session-1' })
    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-t18', packageSessionId: 'pkg-session-1' })
    mockBillingRepoInstance.findById.mockResolvedValue({
      id: 'billing-t18',
      status: 'pending',
      packageSessionId: 'pkg-session-1',
    })
    mockPrisma.walletEntry.findMany.mockResolvedValue([])

    const result = await service.complete('clinic-1', 'appt-1')

    expect(result).toMatchObject({ serviceVouchers: [] })
  })
})

// ── R13: AppointmentsService.update() — conflito de horário no reagendamento ──
describe('R13 — AppointmentsService.update(): reagendamento bloqueia conflito de profissional', () => {
  let service: AppointmentsService

  const makeExistingAppointment = (overrides: Record<string, unknown> = {}) => ({
    id: 'appt-1',
    clinicId: 'clinic-1',
    professionalId: 'professional-1',
    serviceId: 'service-1',
    scheduledAt: new Date('2026-03-25T09:00:00.000Z'), // 09:00–10:00
    durationMinutes: 60,
    status: 'draft',
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AppointmentsService()
  })

  it('deve lançar SLOT_UNAVAILABLE ao reagendar para horário conflitante com outro agendamento do profissional', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingAppointment())
    // Outro agendamento do mesmo profissional às 11:00–12:00
    mockRepo.getConflictingAppointments.mockResolvedValue([
      { scheduledAt: new Date('2026-03-25T11:00:00.000Z'), durationMinutes: 60 },
    ])
    mockRepo.getBlockedSlotsForDate.mockResolvedValue([])

    await expect(
      service.update('clinic-1', 'appt-1', { scheduledAt: '2026-03-25T11:00:00.000Z' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'SLOT_UNAVAILABLE' })
  })

  it('deve permitir reagendamento quando novo horário está livre', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingAppointment())
    mockRepo.getConflictingAppointments.mockResolvedValue([]) // sem conflitos
    mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
    mockRepo.update.mockResolvedValue({
      ...makeExistingAppointment(),
      scheduledAt: new Date('2026-03-25T14:00:00.000Z'),
    })

    const result = await service.update('clinic-1', 'appt-1', {
      scheduledAt: '2026-03-25T14:00:00.000Z',
    })

    expect(result).toMatchObject({ id: 'appt-1' })
  })

  it('deve excluir o próprio agendamento da verificação de conflito ao reagendar (sem falso positivo)', async () => {
    // Agendamento A em 09:00. Reagendar para 09:30 sobrepõe o slot atual —
    // sem exclusão do próprio ID, erraria com SLOT_UNAVAILABLE.
    // Com excludeId correto, o repositório ignora o próprio agendamento.
    mockRepo.findById.mockResolvedValue(makeExistingAppointment())
    // getConflictingAppointments já exclui o próprio agendamento (excludeId=appt-1) → retorna vazio
    mockRepo.getConflictingAppointments.mockResolvedValue([])
    mockRepo.getBlockedSlotsForDate.mockResolvedValue([])
    mockRepo.update.mockResolvedValue({
      ...makeExistingAppointment(),
      scheduledAt: new Date('2026-03-25T09:30:00.000Z'),
    })

    const result = await service.update('clinic-1', 'appt-1', {
      scheduledAt: '2026-03-25T09:30:00.000Z',
    })

    // Verifica que o repositório recebeu o excludeId correto
    expect(mockRepo.getConflictingAppointments).toHaveBeenCalledWith(
      'clinic-1',
      'professional-1',
      '2026-03-25',
      'appt-1', // excludeId — obrigatório para evitar falso positivo
    )
    expect(result).toMatchObject({ id: 'appt-1' })
  })

  it('deve bloquear reagendamento em status inválido (completed/cancelled)', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingAppointment({ status: 'completed' }))

    await expect(
      service.update('clinic-1', 'appt-1', { scheduledAt: '2026-03-25T14:00:00.000Z' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_STATUS' })
  })

  it('não deve verificar conflito de horário quando scheduledAt não é alterado', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingAppointment())
    mockRepo.update.mockResolvedValue(makeExistingAppointment({ notes: 'Observação adicionada' }))

    await service.update('clinic-1', 'appt-1', { notes: 'Observação adicionada' })

    // Nenhuma verificação de conflito deve ser feita quando o horário não muda
    expect(mockRepo.getConflictingAppointments).not.toHaveBeenCalled()
  })
})

// ── T-CP01–T-CP05: Novo fluxo pós-atendimento (RN-PA01/02/03/04/05) ──────────
// Spec: Redesenho do Fluxo Pós-Atendimento — billing criado automaticamente no complete()
describe('AppointmentsService.complete() — Novo fluxo pós-atendimento (RN-PA)', () => {
  let service: AppointmentsService

  const apptInProgress = {
    id: 'appt-cp',
    clinicId: 'clinic-1',
    customerId: 'customer-1',
    serviceId: 'service-1',
    price: 18000,
    status: 'in_progress',
    serviceItems: [],
  }
  const apptCompleted = { ...apptInProgress, status: 'completed' }
  const fullBilling = {
    id: 'billing-cp',
    clinicId: 'clinic-1',
    customerId: 'customer-1',
    appointmentId: 'appt-cp',
    serviceId: 'service-1',
    sourceType: 'APPOINTMENT',
    amount: 18000,
    status: 'pending',
    customer: { id: 'customer-1', name: 'João Silva' },
    appointment: { id: 'appt-cp', scheduledAt: new Date(), durationMinutes: 60, service: { id: 'service-1', name: 'Massagem' }, professional: { id: 'prof-1', name: 'Ana' } },
    service: { id: 'service-1', name: 'Massagem' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AppointmentsService()
  })

  // T-CP01: caso geral — sem billing prévio → cria billing APPOINTMENT automaticamente
  it('T-CP01: complete() cria billing APPOINTMENT automaticamente quando não há billing prévio', async () => {
    mockRepo.findById.mockResolvedValue(apptInProgress)
    mockRepo.transition.mockResolvedValue(apptCompleted)
    mockPackagesInstance.findLinkedSession.mockResolvedValue(null)
    mockPrisma.billing.findUnique.mockResolvedValue(null)               // sem billing prévio
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-cp' })
    mockBillingRepoInstance.findById.mockResolvedValue(fullBilling)
    mockPrisma.walletEntry.findMany.mockResolvedValue([])

    const result = await service.complete('clinic-1', 'appt-cp')

    expect(mockBillingInstance.createManual).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-1',
        sourceType: 'APPOINTMENT',
        amount: 18000,
        appointmentId: 'appt-cp',
      }),
      'clinic-1',
      undefined,
      undefined, // sem sessão reservada
    )
    expect(result.billing).toMatchObject({ id: 'billing-cp', sourceType: 'APPOINTMENT', status: 'pending' })
  })

  // T-CP02: linkedSession (sessão de pacote reservada) → billing criado COM packageSessionId
  it('T-CP02: complete() cria billing com packageSessionId quando appointment tem sessão reservada', async () => {
    mockRepo.findById.mockResolvedValue(apptInProgress)
    mockRepo.transition.mockResolvedValue(apptCompleted)
    mockPackagesInstance.findLinkedSession.mockResolvedValue({ id: 'pkg-session-1' })
    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-cp', packageSessionId: 'pkg-session-1' })
    mockBillingRepoInstance.findById.mockResolvedValue({
      ...fullBilling,
      id: 'billing-cp',
      packageSessionId: 'pkg-session-1',
    })
    mockPrisma.walletEntry.findMany.mockResolvedValue([])

    const result = await service.complete('clinic-1', 'appt-cp')

    expect(result.billing).not.toBeNull()
    expect(mockBillingInstance.createManual).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'customer-1', sourceType: 'APPOINTMENT' }),
      'clinic-1',
      undefined,
      expect.objectContaining({ packageSessionId: 'pkg-session-1' }),
    )
    expect(result.serviceVouchers).toEqual([])
  })

  // T-CP03: billing já existe com status 'paid' → retorna billing existente, sem criar novo
  it('T-CP03: complete() retorna billing existente sem criar novo quando já está pago', async () => {
    const paidBilling = { id: 'existing-billing', status: 'paid' }
    mockRepo.findById.mockResolvedValue(apptInProgress)
    mockRepo.transition.mockResolvedValue(apptCompleted)
    mockPackagesInstance.findLinkedSession.mockResolvedValue(null)
    mockPrisma.billing.findUnique.mockResolvedValue(paidBilling)
    mockBillingRepoInstance.findById.mockResolvedValue({ ...fullBilling, id: 'existing-billing', status: 'paid' })

    const result = await service.complete('clinic-1', 'appt-cp')

    expect(mockBillingInstance.createManual).not.toHaveBeenCalled()
    expect(result.billing?.id).toBe('existing-billing')
    expect(result.serviceVouchers).toEqual([])
  })

  // T-CP04: billing pending existente (promoção travada) → usa existente, busca vouchers
  it('T-CP04: complete() usa billing pending existente e busca serviceVouchers normalmente', async () => {
    const pendingBilling = { id: 'locked-billing', status: 'pending' }
    mockRepo.findById.mockResolvedValue(apptInProgress)
    mockRepo.transition.mockResolvedValue(apptCompleted)
    mockPackagesInstance.findLinkedSession.mockResolvedValue(null)
    mockPrisma.billing.findUnique.mockResolvedValue(pendingBilling)
    mockBillingRepoInstance.findById.mockResolvedValue({ ...fullBilling, id: 'locked-billing', status: 'pending' })
    mockPrisma.walletEntry.findMany.mockResolvedValue([
      { id: 'voucher-1', serviceId: 'service-1', balance: 18000, expirationDate: null, code: 'VCHR-LOCK' },
    ])

    const result = await service.complete('clinic-1', 'appt-cp')

    expect(mockBillingInstance.createManual).not.toHaveBeenCalled()
    expect(result.billing?.id).toBe('locked-billing')
    expect(result.serviceVouchers).toHaveLength(1)
  })

  // T-CP05: billing criado → serviceVouchers preenchido quando há vouchers SERVICE_PRESALE ativos
  it('T-CP05: complete() retorna serviceVouchers com voucher SERVICE_PRESALE quando disponível', async () => {
    mockRepo.findById.mockResolvedValue(apptInProgress)
    mockRepo.transition.mockResolvedValue(apptCompleted)
    mockPackagesInstance.findLinkedSession.mockResolvedValue(null)
    mockPrisma.billing.findUnique.mockResolvedValue(null)
    mockBillingInstance.createManual.mockResolvedValue({ id: 'billing-new' })
    mockBillingRepoInstance.findById.mockResolvedValue({ ...fullBilling, id: 'billing-new' })
    mockPrisma.walletEntry.findMany.mockResolvedValue([
      { id: 'voucher-presale', serviceId: 'service-1', balance: 18000, expirationDate: null, code: 'VCHR-PS01' },
    ])

    const result = await service.complete('clinic-1', 'appt-cp')

    expect(result.billing).not.toBeNull()
    expect(result.serviceVouchers).toHaveLength(1)
    expect(result.serviceVouchers[0]).toMatchObject({ id: 'voucher-presale', code: 'VCHR-PS01' })
  })
})
