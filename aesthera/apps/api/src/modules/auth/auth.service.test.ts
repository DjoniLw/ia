import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 1. Hoisted mocks (devem ser declarados ANTES dos vi.mock()) ───────────────

const mockRepo = vi.hoisted(() => ({
  findActiveMembershipsByEmail: vi.fn(),
  findLatestUnverifiedClinicByEmail: vi.fn(),
  findLatestPendingTransferByEmail: vi.fn(),
  findClinicBySlug: vi.fn(),
  findClinicById: vi.fn(),
  findClinicByVerificationToken: vi.fn(),
  findUserByEmail: vi.fn(),
  findTransferByToken: vi.fn(),
  findPendingTransferForResend: vi.fn(),
  findAdminUserByClinic: vi.fn(),
  findProfessionalByEmail: vi.fn(),
  updateUnverifiedClinicForReRegistration: vi.fn(),
  createClinicWithAdmin: vi.fn(),
  createClinic: vi.fn(),
  createTransferToken: vi.fn(),
  verifyClinicEmail: vi.fn(),
  updateClinicVerificationToken: vi.fn(),
  updateUserLastLogin: vi.fn(),
  updateUserPassword: vi.fn(),
}))

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  getdel: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ping: vi.fn(),
  ttl: vi.fn(),
}))

/** Objeto de transação Prisma usado dentro de $transaction callbacks */
const mockTx = vi.hoisted(() => ({
  transferToken: {
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  clinic: { update: vi.fn() },
  user: {
    update: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  transferToken: { update: vi.fn() },
  user: { findUnique: vi.fn() },
}))

const mockBcrypt = vi.hoisted(() => ({
  hash: vi.fn(),
  compare: vi.fn(),
}))

/** Objeto mutável — cada suite pode ajustar isProduction, email.apiKey etc. */
const mockAppConfig = vi.hoisted(() => ({
  isProduction: false,
  email: { apiKey: undefined as string | undefined },
  jwt: { expiresIn: '15m' },
  frontendUrl: 'https://app.test',
}))

// ── 2. Mocks de módulos ───────────────────────────────────────────────────────

vi.mock('./auth.repository', () => ({ authRepository: mockRepo }))
vi.mock('../../database/redis/client', () => ({ redis: mockRedis }))
vi.mock('../../database/prisma/client', () => ({ prisma: mockPrisma }))
vi.mock('../../config/app.config', () => ({ appConfig: mockAppConfig }))
vi.mock('../../config/company.config', () => ({
  companyConfig: { name: 'Aesthera', supportEmail: '' },
}))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))
vi.mock('../notifications/notifications.service', () => ({
  NotificationsService: vi.fn().mockImplementation(() => ({ sendEmail: vi.fn().mockResolvedValue(undefined) })),
}))
vi.mock('../../shared/logger/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('../../shared/utils/id', () => ({
  generateId: vi.fn().mockReturnValue('generated-id'),
}))
vi.mock('../../shared/utils/transfer-email', () => ({
  buildTransferEmailHtml: vi.fn().mockReturnValue('<html>email</html>'),
}))

// ── 3. Import do módulo sendo testado (DEPOIS dos vi.mock) ────────────────────

import type { FastifyInstance } from 'fastify'
import { AuthService } from './auth.service'
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/app-error'

// ── 4. Factories de dados de teste ────────────────────────────────────────────

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    clinicId: 'clinic-1',
    name: 'Ana Oliveira',
    email: 'ana@clinica.com.br',
    passwordHash: '$2b$12$hashed',
    role: 'admin' as const,
    lastLoginAt: null,
    clinic: {
      id: 'clinic-1',
      slug: 'clinica-ana',
      name: 'Clínica Ana',
      emailVerified: true,
      status: 'active',
    },
    ...overrides,
  }
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    clinicId: 'clinic-1',
    name: 'Ana Oliveira',
    email: 'ana@clinica.com.br',
    passwordHash: '$2b$12$hashed',
    role: 'admin' as const,
    active: true,
    screenPermissions: [],
    ...overrides,
  }
}

function makeTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transfer-1',
    token: 'token-uuid-abc',
    email: 'admin@clinica.com.br',
    sourceClinicId: 'clinic-1',
    sourceUserId: 'user-1',
    targetClinicId: 'clinic-2',
    targetUserId: null as string | null,
    role: 'admin' as const,
    kind: 'clinic_registration' as const,
    status: 'pending' as const,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h no futuro
    createdAt: new Date(),
    sourceClinic: { id: 'clinic-1', name: 'Clínica Origem', slug: 'clinica-origem' },
    targetClinic: {
      id: 'clinic-2',
      name: 'Clínica Destino',
      slug: 'clinica-destino',
      emailVerified: false,
    },
    sourceUser: {
      id: 'user-1',
      name: 'Admin Origem',
      email: 'admin@clinica.com.br',
      passwordHash: '$2b$12$hashed',
      active: true,
    },
    targetUser: null as null | { id: string; name: string; email: string; passwordHash: string; active: boolean },
    ...overrides,
  }
}

/** App Fastify fake — apenas jwt.sign é necessário */
const mockApp = {
  jwt: { sign: vi.fn().mockReturnValue('mock-access-token') },
} as unknown as FastifyInstance

// ── 5. Setup global de mocks antes de cada teste ──────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()

  // Resetar estado mutável do appConfig
  mockAppConfig.isProduction = false
  mockAppConfig.email.apiKey = undefined

  // Valores padrão para chamadas comuns
  mockBcrypt.hash.mockResolvedValue('$2b$12$hashed')
  mockBcrypt.compare.mockResolvedValue(true)
  mockRedis.ping.mockResolvedValue('PONG')
  mockRedis.setex.mockResolvedValue('OK')
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.del.mockResolvedValue(1)
  mockRedis.get.mockResolvedValue(null)
  mockRedis.getdel.mockResolvedValue(null)
  mockRedis.incr.mockResolvedValue(1)
  mockRedis.expire.mockResolvedValue(1)
  mockRedis.ttl.mockResolvedValue(30)
  ;(mockApp.jwt.sign as ReturnType<typeof vi.fn>).mockReturnValue('mock-access-token')

  // $transaction executa o callback com o mockTx
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  )

  // Valores padrão dos métodos do repositório
  mockRepo.findActiveMembershipsByEmail.mockResolvedValue([])
  mockRepo.findLatestUnverifiedClinicByEmail.mockResolvedValue(null)
  mockRepo.findLatestPendingTransferByEmail.mockResolvedValue(null)
  mockRepo.findClinicBySlug.mockResolvedValue(null)
  mockRepo.findClinicById.mockResolvedValue(null)
  mockRepo.verifyClinicEmail.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana' })
  mockRepo.updateUserLastLogin.mockResolvedValue({ id: 'user-1' })
  mockRepo.findAdminUserByClinic.mockResolvedValue({ id: 'user-1', clinicId: 'clinic-1', role: 'admin' })
})

// ═════════════════════════════════════════════════════════════════════════════
// resolveSlug
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.resolveSlug()', () => {
  it('deve retornar o slug quando e-mail tem vínculo ativo', async () => {
    mockRepo.findActiveMembershipsByEmail.mockResolvedValue([makeMembership()])

    const service = new AuthService(mockApp)
    const result = await service.resolveSlug('ana@clinica.com.br')

    expect(result).toEqual({ slug: 'clinica-ana' })
  })

  it('deve retornar { slug: null } quando e-mail não tem vínculo ativo', async () => {
    mockRepo.findActiveMembershipsByEmail.mockResolvedValue([])

    const service = new AuthService(mockApp)
    const result = await service.resolveSlug('desconhecido@clinica.com.br')

    expect(result).toEqual({ slug: null })
  })

  it('deve usar o primeiro vínculo quando usuário tem múltiplos vínculos', async () => {
    const memberships = [
      makeMembership({ clinic: { id: 'clinic-1', slug: 'clinica-principal', name: 'Principal', emailVerified: true, status: 'active' } }),
      makeMembership({ clinic: { id: 'clinic-2', slug: 'clinica-secundaria', name: 'Secundária', emailVerified: true, status: 'active' } }),
    ]
    mockRepo.findActiveMembershipsByEmail.mockResolvedValue(memberships)

    const service = new AuthService(mockApp)
    const result = await service.resolveSlug('ana@clinica.com.br')

    expect(result.slug).toBe('clinica-principal')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// registerClinic
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.registerClinic()', () => {
  const freshDto = {
    clinicName: 'Clínica Nova',
    adminName: 'Carlos Silva',
    email: 'carlos@nova.com.br',
    password: 'Senha@123',
    phone: undefined,
    clinicDocument: undefined,
    confirmTransfer: undefined,
  }

  describe('modo dev (isProduction=false)', () => {
    it('deve realizar cadastro, auto-verificar e retornar tokens', async () => {
      mockRepo.createClinicWithAdmin.mockResolvedValue({
        id: 'clinic-new',
        slug: 'clinica-nova',
        name: 'Clínica Nova',
      })

      const service = new AuthService(mockApp)
      const result = await service.registerClinic(freshDto)

      expect(result).toMatchObject({
        clinic: { slug: 'clinica-nova', name: 'Clínica Nova' },
        user: { email: 'carlos@nova.com.br', role: 'admin' },
        autoVerified: true,
        emailVerificationSent: false,
        accessToken: 'mock-access-token',
      })
      expect(mockRepo.verifyClinicEmail).toHaveBeenCalledOnce()
    })

    it('deve lançar SERVICE_UNAVAILABLE quando Redis estiver indisponível em dev', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'))

      const service = new AuthService(mockApp)
      await expect(service.registerClinic(freshDto)).rejects.toThrow(AppError)
      await expect(service.registerClinic(freshDto)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      })
    })

    it('deve regenerar cadastro não confirmado sem exigir novo e-mail único', async () => {
      mockRepo.findLatestUnverifiedClinicByEmail.mockResolvedValue({
        id: 'clinic-unverified',
        slug: 'clinica-nova',
        name: 'Clínica Nova',
        emailVerified: false,
      })
      mockRepo.updateUnverifiedClinicForReRegistration.mockResolvedValue({
        id: 'clinic-unverified',
        slug: 'clinica-nova',
        name: 'Clínica Nova',
      })

      const service = new AuthService(mockApp)
      const result = await service.registerClinic(freshDto)

      expect(mockRepo.updateUnverifiedClinicForReRegistration).toHaveBeenCalledOnce()
      expect(result).toMatchObject({ autoVerified: true })
    })

    it('deve lançar SLUG_LINKED_SAME_CLINIC quando slug gerado pertence à mesma clínica do usuário (dev)', async () => {
      // Usuário já tem vínculo ativo em dev mode (sem confirmTransfer lógica de prod)
      mockRepo.findActiveMembershipsByEmail.mockResolvedValue([
        makeMembership({ clinicId: 'clinic-already' }),
      ])
      mockRepo.findClinicBySlug.mockResolvedValue({
        id: 'clinic-already',
        slug: 'clinica-nova',
        name: 'Clínica Nova',
      })

      const service = new AuthService(mockApp)
      await expect(service.registerClinic(freshDto)).rejects.toMatchObject({
        code: 'SLUG_LINKED_SAME_CLINIC',
        statusCode: 409,
      })
    })
  })

  describe('modo produção (isProduction=true)', () => {
    beforeEach(() => {
      mockAppConfig.isProduction = true
    })

    it('deve lançar TRANSFER_PENDING quando já existe transferência pendente para o e-mail', async () => {
      mockRepo.findLatestPendingTransferByEmail.mockResolvedValue({
        id: 'transfer-1',
        targetClinicId: 'clinic-2',
        kind: 'clinic_registration',
      })

      const service = new AuthService(mockApp)
      await expect(service.registerClinic(freshDto)).rejects.toMatchObject({
        code: 'TRANSFER_PENDING',
        statusCode: 409,
      })
    })

    it('deve lançar EMAIL_CONFLICT_ADMIN quando admin tenta cadastrar nova clínica sem confirmTransfer', async () => {
      mockRepo.findActiveMembershipsByEmail.mockResolvedValue([
        makeMembership({ role: 'admin', clinic: { id: 'clinic-1', slug: 'clinica-ana', name: 'Clínica Ana', emailVerified: true, status: 'active' } }),
      ])

      const service = new AuthService(mockApp)
      await expect(service.registerClinic({ ...freshDto, confirmTransfer: false })).rejects.toMatchObject({
        code: 'EMAIL_CONFLICT_ADMIN',
        statusCode: 409,
      })
    })

    it('deve lançar EMAIL_CONFLICT_MEMBER quando membro tenta cadastrar nova clínica sem confirmTransfer', async () => {
      mockRepo.findActiveMembershipsByEmail.mockResolvedValue([
        makeMembership({ role: 'staff' }),
      ])

      const service = new AuthService(mockApp)
      await expect(service.registerClinic({ ...freshDto, confirmTransfer: false })).rejects.toMatchObject({
        code: 'EMAIL_CONFLICT_MEMBER',
        statusCode: 409,
      })
    })

    it('deve lançar SLUG_LINKED_SAME_CLINIC quando slug da nova clínica colide com a clínica de origem', async () => {
      mockRepo.findActiveMembershipsByEmail.mockResolvedValue([
        makeMembership({ clinicId: 'clinic-origem' }),
      ])
      mockRepo.findClinicBySlug.mockResolvedValue({
        id: 'clinic-origem',
        slug: 'clinica-nova',
        name: 'Clínica Nova',
      })

      const service = new AuthService(mockApp)
      await expect(service.registerClinic({ ...freshDto, confirmTransfer: true })).rejects.toMatchObject({
        code: 'SLUG_LINKED_SAME_CLINIC',
        statusCode: 409,
      })
    })

    it('deve criar clínica e transferência pendente quando confirmTransfer=true', async () => {
      mockRepo.findActiveMembershipsByEmail.mockResolvedValue([makeMembership()])
      mockRepo.findClinicBySlug.mockResolvedValue(null)
      mockRepo.createClinic.mockResolvedValue({
        id: 'clinic-new',
        slug: 'clinica-nova',
        name: 'Clínica Nova',
        email: 'carlos@nova.com.br',
        plan: 'free',
        status: 'active',
      })
      mockRepo.createTransferToken.mockResolvedValue({
        id: 'transfer-1',
        token: 'token-uuid',
        email: 'carlos@nova.com.br',
        targetClinicId: 'clinic-new',
        targetUserId: null,
        role: 'admin',
        kind: 'clinic_registration',
        expiresAt: new Date(),
      })

      const service = new AuthService(mockApp)
      const result = await service.registerClinic({ ...freshDto, confirmTransfer: true })

      expect(mockRepo.createTransferToken).toHaveBeenCalledOnce()
      expect(result).toMatchObject({
        transferPending: true,
        emailVerificationSent: false,
        clinic: { slug: 'clinica-nova' },
      })
    })

    it('deve fazer cadastro normal e retornar emailVerificationSent=false quando sem API key de e-mail', async () => {
      mockAppConfig.email.apiKey = undefined
      mockRepo.createClinicWithAdmin.mockResolvedValue({
        id: 'clinic-new',
        slug: 'clinica-nova',
        name: 'Clínica Nova',
      })

      const service = new AuthService(mockApp)
      const result = await service.registerClinic(freshDto)

      expect(result).toMatchObject({
        emailVerificationSent: false,
        clinic: { slug: 'clinica-nova' },
      })
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// verifyEmail
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.verifyEmail()', () => {
  it('deve verificar e-mail, ativar clínica e retornar tokens', async () => {
    mockRepo.findClinicByVerificationToken.mockResolvedValue({
      id: 'clinic-1',
      slug: 'clinica-ana',
      emailVerified: false,
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
    })
    mockRepo.findAdminUserByClinic.mockResolvedValue({ id: 'user-1', clinicId: 'clinic-1', role: 'admin' })

    const service = new AuthService(mockApp)
    const result = await service.verifyEmail('valid-token-hex')

    expect(mockRepo.verifyClinicEmail).toHaveBeenCalledWith('clinic-1')
    expect(result).toMatchObject({
      clinic: { slug: 'clinica-ana' },
      accessToken: 'mock-access-token',
    })
  })

  it('deve lançar NotFoundError quando token não existe', async () => {
    mockRepo.findClinicByVerificationToken.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    await expect(service.verifyEmail('token-invalido')).rejects.toThrow(NotFoundError)
  })

  it('deve lançar ForbiddenError quando token expirou', async () => {
    mockRepo.findClinicByVerificationToken.mockResolvedValue({
      id: 'clinic-1',
      slug: 'clinica-ana',
      emailVerified: false,
      emailVerificationExpiresAt: new Date(Date.now() - 1000), // já expirado
    })

    const service = new AuthService(mockApp)
    await expect(service.verifyEmail('expired-token')).rejects.toThrow(ForbiddenError)
    await expect(service.verifyEmail('expired-token')).rejects.toMatchObject({
      message: expect.stringContaining('expirou'),
    })
  })

  it('deve ser idempotente — retornar tokens quando e-mail já foi verificado', async () => {
    mockRepo.findClinicByVerificationToken.mockResolvedValue({
      id: 'clinic-1',
      slug: 'clinica-ana',
      emailVerified: true,
      emailVerificationExpiresAt: null,
    })
    mockRepo.findAdminUserByClinic.mockResolvedValue({ id: 'user-1', clinicId: 'clinic-1', role: 'admin' })

    const service = new AuthService(mockApp)
    const result = await service.verifyEmail('already-verified-token')

    // Não deve tentar atualizar o banco novamente
    expect(mockRepo.verifyClinicEmail).not.toHaveBeenCalled()
    expect(result).toMatchObject({ accessToken: 'mock-access-token' })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// resendVerification
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.resendVerification()', () => {
  it('deve retornar { sent: false } quando clínica não encontrada', async () => {
    mockRepo.findLatestUnverifiedClinicByEmail.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    const result = await service.resendVerification('desconhecido@clinica.com.br')

    expect(result).toEqual({ sent: false })
    // Não deve expor a ausência do cadastro vazando informação
    expect(mockRepo.updateClinicVerificationToken).not.toHaveBeenCalled()
  })

  it('deve retornar { sent: false } quando clínica já verificada', async () => {
    mockRepo.findLatestUnverifiedClinicByEmail.mockResolvedValue({
      id: 'clinic-1',
      slug: 'clinica-ana',
      name: 'Clínica Ana',
      emailVerified: true,
    })

    const service = new AuthService(mockApp)
    const result = await service.resendVerification('ana@clinica.com.br')

    expect(result).toEqual({ sent: false })
    expect(mockRepo.updateClinicVerificationToken).not.toHaveBeenCalled()
  })

  it('deve renovar token de verificação mesmo quando sem API key de e-mail', async () => {
    mockAppConfig.email.apiKey = undefined
    mockRepo.findLatestUnverifiedClinicByEmail.mockResolvedValue({
      id: 'clinic-1',
      slug: 'clinica-ana',
      name: 'Clínica Ana',
      emailVerified: false,
    })
    mockRepo.updateClinicVerificationToken.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', name: 'Clínica Ana' })

    const service = new AuthService(mockApp)
    const result = await service.resendVerification('ana@clinica.com.br')

    expect(mockRepo.updateClinicVerificationToken).toHaveBeenCalledOnce()
    expect(result).toEqual({ sent: false })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// login
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.login()', () => {
  const dto = { email: 'ana@clinica.com.br', password: 'Senha@123' }

  it('deve autenticar com sucesso e retornar user + tokens', async () => {
    mockRepo.findClinicById.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', emailVerified: true })
    mockRepo.findUserByEmail.mockResolvedValue(makeUser())

    const service = new AuthService(mockApp)
    const result = await service.login('clinic-1', dto)

    expect(result).toMatchObject({
      user: { id: 'user-1', email: 'ana@clinica.com.br', role: 'admin' },
      accessToken: 'mock-access-token',
    })
    expect(result.refreshToken).toBeDefined()
  })

  it('deve lançar ForbiddenError quando e-mail da clínica não foi confirmado', async () => {
    mockRepo.findClinicById.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', emailVerified: false })

    const service = new AuthService(mockApp)
    await expect(service.login('clinic-1', dto)).rejects.toThrow(ForbiddenError)
    await expect(service.login('clinic-1', dto)).rejects.toMatchObject({
      message: expect.stringContaining('e-mail'),
    })
  })

  it('deve lançar UnauthorizedError com mensagem genérica quando usuário não encontrado', async () => {
    mockRepo.findClinicById.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', emailVerified: true })
    mockRepo.findUserByEmail.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    // Mensagem genérica — não revelar se e-mail existe
    await expect(service.login('clinic-1', dto)).rejects.toThrow(UnauthorizedError)
    await expect(service.login('clinic-1', dto)).rejects.toMatchObject({
      message: 'Invalid email or password',
      statusCode: 401,
    })
  })

  it('deve lançar ForbiddenError quando conta está desativada', async () => {
    mockRepo.findClinicById.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', emailVerified: true })
    mockRepo.findUserByEmail.mockResolvedValue(makeUser({ active: false }))

    const service = new AuthService(mockApp)
    await expect(service.login('clinic-1', dto)).rejects.toThrow(ForbiddenError)
  })

  it('deve lançar ForbiddenError quando conta está bloqueada por tentativas excessivas', async () => {
    mockRepo.findClinicById.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', emailVerified: true })
    mockRepo.findUserByEmail.mockResolvedValue(makeUser())
    // Redis retorna 5 tentativas = LOCK_TTL atingido
    mockRedis.get.mockResolvedValue('5')

    const service = new AuthService(mockApp)
    await expect(service.login('clinic-1', dto)).rejects.toThrow(ForbiddenError)
    await expect(service.login('clinic-1', dto)).rejects.toMatchObject({
      message: expect.stringContaining('15 minutes'),
    })
  })

  it('deve lançar UnauthorizedError com mensagem genérica quando senha está errada', async () => {
    mockRepo.findClinicById.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', emailVerified: true })
    mockRepo.findUserByEmail.mockResolvedValue(makeUser())
    mockBcrypt.compare.mockResolvedValue(false)

    const service = new AuthService(mockApp)
    await expect(service.login('clinic-1', dto)).rejects.toMatchObject({
      message: 'Invalid email or password',
      statusCode: 401,
    })
    // Deve registrar a tentativa falha
    expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('login-lock:'))
  })

  it('deve limpar lockout no Redis após login bem-sucedido', async () => {
    mockRepo.findClinicById.mockResolvedValue({ id: 'clinic-1', slug: 'clinica-ana', emailVerified: true })
    mockRepo.findUserByEmail.mockResolvedValue(makeUser())

    const service = new AuthService(mockApp)
    await service.login('clinic-1', dto)

    expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining('login-lock:'))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// professionalLogin
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.professionalLogin()', () => {
  const dto = { email: 'pro@clinica.com.br', password: 'Pro@123' }

  function makeProfessional(overrides: Record<string, unknown> = {}) {
    return {
      id: 'prof-1',
      clinicId: 'clinic-1',
      name: 'Profissional Teste',
      email: 'pro@clinica.com.br',
      active: true,
      auth: {
        passwordHash: '$2b$12$hashed',
        failedAttempts: 0,
        lockedUntil: null as Date | null,
      },
      ...overrides,
    }
  }

  it('deve autenticar profissional e retornar dados + tokens', async () => {
    mockRepo.findProfessionalByEmail.mockResolvedValue(makeProfessional())

    const service = new AuthService(mockApp)
    const result = await service.professionalLogin('clinic-1', dto)

    expect(result).toMatchObject({
      professional: { id: 'prof-1', role: 'professional' },
      accessToken: 'mock-access-token',
    })
  })

  it('deve lançar UnauthorizedError com mensagem genérica quando profissional não encontrado', async () => {
    mockRepo.findProfessionalByEmail.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    await expect(service.professionalLogin('clinic-1', dto)).rejects.toMatchObject({
      message: 'Invalid email or password',
      statusCode: 401,
    })
  })

  it('deve lançar ForbiddenError quando profissional inativo', async () => {
    mockRepo.findProfessionalByEmail.mockResolvedValue(makeProfessional({ active: false }))

    const service = new AuthService(mockApp)
    await expect(service.professionalLogin('clinic-1', dto)).rejects.toThrow(ForbiddenError)
  })

  it('deve lançar ForbiddenError quando conta de profissional está lockedUntil no futuro', async () => {
    mockRepo.findProfessionalByEmail.mockResolvedValue(
      makeProfessional({ auth: { passwordHash: '$2b$hash', failedAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) } }),
    )

    const service = new AuthService(mockApp)
    await expect(service.professionalLogin('clinic-1', dto)).rejects.toThrow(ForbiddenError)
  })

  it('deve lançar UnauthorizedError com mensagem genérica quando senha errada', async () => {
    mockRepo.findProfessionalByEmail.mockResolvedValue(makeProfessional())
    mockBcrypt.compare.mockResolvedValue(false)

    const service = new AuthService(mockApp)
    await expect(service.professionalLogin('clinic-1', dto)).rejects.toMatchObject({
      message: 'Invalid email or password',
      statusCode: 401,
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// recoverAccess
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.recoverAccess()', () => {
  it('deve retornar { sent: false } quando e-mail não tem vínculo ativo', async () => {
    mockRepo.findActiveMembershipsByEmail.mockResolvedValue([])

    const service = new AuthService(mockApp)
    const result = await service.recoverAccess('desconhecido@email.com')

    // Resposta genérica — não expõe ausência do e-mail
    expect(result).toEqual({ sent: false })
    expect(mockRedis.setex).not.toHaveBeenCalledWith(
      expect.stringContaining('pwd-reset:'),
      expect.anything(),
      expect.anything(),
    )
  })

  it('deve retornar { sent: false } quando Redis estiver indisponível', async () => {
    mockRepo.findActiveMembershipsByEmail.mockResolvedValue([makeMembership()])
    mockRedis.setex.mockRejectedValue(new Error('Redis down'))

    const service = new AuthService(mockApp)
    const result = await service.recoverAccess('ana@clinica.com.br')

    expect(result).toEqual({ sent: false })
  })

  it('deve armazenar token no Redis e retornar { sent: false } quando sem API key de e-mail', async () => {
    mockAppConfig.email.apiKey = undefined
    mockRepo.findActiveMembershipsByEmail.mockResolvedValue([makeMembership()])

    const service = new AuthService(mockApp)
    const result = await service.recoverAccess('ana@clinica.com.br')

    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringContaining('pwd-reset:'),
      3600,
      expect.stringContaining('"clinicId":"clinic-1"'),
    )
    expect(result).toEqual({ sent: false })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// resetPassword
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.resetPassword()', () => {
  it('deve redefinir senha e remover token do Redis', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({ email: 'ana@clinica.com.br', clinicId: 'clinic-1', userId: 'user-1' }),
    )
    mockRepo.updateUserPassword.mockResolvedValue({ id: 'user-1' })

    const service = new AuthService(mockApp)
    const result = await service.resetPassword('valid-reset-token', 'NovaSenha@123')

    expect(mockBcrypt.hash).toHaveBeenCalledWith('NovaSenha@123', 12)
    expect(mockRepo.updateUserPassword).toHaveBeenCalledWith('user-1', '$2b$12$hashed')
    expect(mockRedis.del).toHaveBeenCalledWith('pwd-reset:valid-reset-token')
    expect(result).toEqual({ success: true })
  })

  it('deve lançar INVALID_RESET_TOKEN quando token não existe no Redis', async () => {
    mockRedis.get.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    await expect(service.resetPassword('token-invalido', 'NovaSenha@123')).rejects.toMatchObject({
      code: 'INVALID_RESET_TOKEN',
      statusCode: 400,
    })
    expect(mockRepo.updateUserPassword).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// resendTransfer
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.resendTransfer()', () => {
  it('deve retornar { sent: false } quando não há transferência pendente', async () => {
    mockRepo.findPendingTransferForResend.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    const result = await service.resendTransfer('sem-transfer@clinica.com.br')

    expect(result).toEqual({ sent: false })
  })

  it('deve retornar { sent: false } quando sem API key de e-mail', async () => {
    mockAppConfig.email.apiKey = undefined
    mockRepo.findPendingTransferForResend.mockResolvedValue({
      id: 'transfer-1',
      email: 'ana@clinica.com.br',
      sourceClinicId: 'clinic-1',
      sourceUserId: 'user-1',
      targetClinicId: 'clinic-2',
      targetUserId: null,
      role: 'admin',
      kind: 'clinic_registration',
      sourceClinic: { name: 'Clínica Origem' },
      targetClinic: { name: 'Clínica Destino' },
      sourceUser: { role: 'admin' },
    })

    const service = new AuthService(mockApp)
    const result = await service.resendTransfer('ana@clinica.com.br')

    expect(result).toEqual({ sent: false })
    // Não deve rotacionar o token sem ter como enviar e-mail
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('deve lançar COOLDOWN_ACTIVE quando dentro do período de cooldown', async () => {
    mockAppConfig.email.apiKey = 'api-key-test'
    mockRepo.findPendingTransferForResend.mockResolvedValue({
      id: 'transfer-1',
      email: 'ana@clinica.com.br',
      sourceClinicId: 'clinic-1',
      sourceUserId: 'user-1',
      targetClinicId: 'clinic-2',
      targetUserId: null,
      role: 'admin',
      kind: 'clinic_registration',
      sourceClinic: { name: 'Clínica Origem' },
      targetClinic: { name: 'Clínica Destino' },
      sourceUser: { role: 'admin' },
    })
    // SET NX retorna null → cooldown ativo
    mockRedis.set.mockResolvedValue(null)
    mockRedis.ttl.mockResolvedValue(42)

    const service = new AuthService(mockApp)
    await expect(service.resendTransfer('ana@clinica.com.br')).rejects.toMatchObject({
      code: 'COOLDOWN_ACTIVE',
      statusCode: 429,
      data: expect.objectContaining({ secondsRemaining: 42 }),
    })
  })

  it('deve lançar SERVICE_UNAVAILABLE quando Redis estiver fora (fail-closed)', async () => {
    mockAppConfig.email.apiKey = 'api-key-test'
    mockRepo.findPendingTransferForResend.mockResolvedValue({
      id: 'transfer-1',
      email: 'ana@clinica.com.br',
      sourceClinicId: 'clinic-1',
      sourceUserId: 'user-1',
      targetClinicId: 'clinic-2',
      targetUserId: null,
      role: 'admin',
      kind: 'clinic_registration',
      sourceClinic: { name: 'Clínica Origem' },
      targetClinic: { name: 'Clínica Destino' },
      sourceUser: { role: 'admin' },
    })
    mockRedis.set.mockRejectedValue(new Error('Redis unavailable'))

    const service = new AuthService(mockApp)
    await expect(service.resendTransfer('ana@clinica.com.br')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// confirmTransfer
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.confirmTransfer()', () => {
  it('deve confirmar transferência clinic_registration e retornar slug da clínica destino', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(makeTransfer())

    const service = new AuthService(mockApp)
    const result = await service.confirmTransfer('token-uuid-abc')

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
    expect(mockTx.user.upsert).toHaveBeenCalledOnce()
    expect(mockTx.clinic.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailVerified: true }) }),
    )
    expect(mockTx.transferToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'confirmed' } }),
    )
    expect(result).toMatchObject({
      message: 'Transferência confirmada com sucesso.',
      clinicSlug: 'clinica-destino',
    })
  })

  it('deve confirmar transferência user_invite criando usuário quando targetUserId não existe', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(
      makeTransfer({ kind: 'user_invite', targetUserId: null }),
    )

    const service = new AuthService(mockApp)
    await service.confirmTransfer('token-uuid-abc')

    expect(mockTx.user.create).toHaveBeenCalledOnce()
  })

  it('deve confirmar transferência user_invite atualizando usuário quando targetUserId existe', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(
      makeTransfer({ kind: 'user_invite', targetUserId: 'user-target' }),
    )

    const service = new AuthService(mockApp)
    await service.confirmTransfer('token-uuid-abc')

    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-target' } }),
    )
  })

  it('deve desativar usuário da clínica de origem após confirmação', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(makeTransfer())

    const service = new AuthService(mockApp)
    await service.confirmTransfer('token-uuid-abc')

    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { active: false },
      }),
    )
  })

  it('deve lançar NotFoundError quando token não existe', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    await expect(service.confirmTransfer('token-invalido')).rejects.toThrow(NotFoundError)
  })

  it('deve lançar ForbiddenError quando transferência já não está pendente', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(makeTransfer({ status: 'confirmed' }))

    const service = new AuthService(mockApp)
    await expect(service.confirmTransfer('token-uuid-abc')).rejects.toThrow(ForbiddenError)
    await expect(service.confirmTransfer('token-uuid-abc')).rejects.toMatchObject({
      message: expect.stringContaining('pendente'),
    })
  })

  it('deve lançar ForbiddenError e marcar como expirado quando link de transferência venceu', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(
      makeTransfer({ expiresAt: new Date(Date.now() - 1000) }),
    )

    const service = new AuthService(mockApp)
    await expect(service.confirmTransfer('token-uuid-abc')).rejects.toThrow(ForbiddenError)
    expect(mockPrisma.transferToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'expired' } }),
    )
  })

  it('deve lançar TRANSFER_SOURCE_INVALID quando usuário de origem não tem senha', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(
      makeTransfer({ sourceUser: { id: 'user-1', name: 'Admin', email: 'admin@test.com', passwordHash: null as unknown as string, active: true } }),
    )

    const service = new AuthService(mockApp)
    await expect(service.confirmTransfer('token-uuid-abc')).rejects.toMatchObject({
      code: 'TRANSFER_SOURCE_INVALID',
      statusCode: 422,
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// rejectTransfer
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.rejectTransfer()', () => {
  it('deve rejeitar transferência de registro de clínica com sucesso', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(makeTransfer({ kind: 'clinic_registration' }))

    const service = new AuthService(mockApp)
    const result = await service.rejectTransfer('token-uuid-abc')

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
    expect(mockTx.transferToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'rejected' } }),
    )
    expect(result).toMatchObject({ message: 'Transferência recusada com sucesso.' })
  })

  it('deve excluir usuário convidado inativo ao rejeitar user_invite', async () => {
    const inactiveTarget = {
      id: 'user-target',
      name: 'Convidado',
      email: 'convidado@clinica.com.br',
      passwordHash: '',
      active: false,
    }
    mockRepo.findTransferByToken.mockResolvedValue(
      makeTransfer({ kind: 'user_invite', targetUserId: 'user-target', targetUser: inactiveTarget }),
    )

    const service = new AuthService(mockApp)
    await service.rejectTransfer('token-uuid-abc')

    expect(mockTx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-target' } })
  })

  it('deve lançar NotFoundError quando token não existe', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    await expect(service.rejectTransfer('token-invalido')).rejects.toThrow(NotFoundError)
  })

  it('deve lançar ForbiddenError quando transferência não está mais pendente', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(makeTransfer({ status: 'rejected' }))

    const service = new AuthService(mockApp)
    await expect(service.rejectTransfer('token-uuid-abc')).rejects.toThrow(ForbiddenError)
  })

  it('deve lançar ForbiddenError e marcar como expirado quando link venceu', async () => {
    mockRepo.findTransferByToken.mockResolvedValue(
      makeTransfer({ expiresAt: new Date(Date.now() - 1000) }),
    )

    const service = new AuthService(mockApp)
    await expect(service.rejectTransfer('token-uuid-abc')).rejects.toThrow(ForbiddenError)
    expect(mockPrisma.transferToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'expired' } }),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// refresh
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.refresh()', () => {
  it('deve rotacionar o refresh token e retornar novos tokens', async () => {
    mockRedis.getdel.mockResolvedValue(
      JSON.stringify({ userId: 'user-1', clinicId: 'clinic-1', role: 'admin' }),
    )

    const service = new AuthService(mockApp)
    const result = await service.refresh('valid-refresh-token')

    // Token antigo deve ser revogado atomicamente via getdel
    expect(mockRedis.getdel).toHaveBeenCalledWith(expect.stringContaining('user-refresh:'))
    // Novo token deve ser emitido
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringContaining('user-refresh:'),
      expect.any(Number),
      expect.any(String),
    )
    expect(result).toMatchObject({ accessToken: 'mock-access-token' })
    expect(result.refreshToken).toBeDefined()
  })

  it('deve lançar UnauthorizedError quando refresh token não existe no Redis', async () => {
    mockRedis.getdel.mockResolvedValue(null)

    const service = new AuthService(mockApp)
    await expect(service.refresh('token-inexistente')).rejects.toMatchObject({
      message: 'Invalid or expired refresh token',
      statusCode: 401,
    })
    // Não deve emitir novos tokens
    expect(mockRedis.setex).not.toHaveBeenCalled()
  })

  it('deve buscar screenPermissions do banco para usuários staff', async () => {
    mockRedis.getdel.mockResolvedValue(
      JSON.stringify({ userId: 'user-staff', clinicId: 'clinic-1', role: 'staff' }),
    )
    mockPrisma.user.findUnique.mockResolvedValue({
      screenPermissions: ['clients', 'scheduling'],
    })

    const service = new AuthService(mockApp)
    await service.refresh('valid-staff-token')

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-staff' } }),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// logout
// ═════════════════════════════════════════════════════════════════════════════

describe('AuthService.logout()', () => {
  it('deve remover o refresh token do Redis', async () => {
    const service = new AuthService(mockApp)
    await service.logout('my-refresh-token')

    expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining('user-refresh:'))
  })

  it('deve ser silencioso sem lançar erros', async () => {
    mockRedis.del.mockResolvedValue(0) // token já não existia

    const service = new AuthService(mockApp)
    await expect(service.logout('token-ja-expirado')).resolves.toBeUndefined()
  })
})
