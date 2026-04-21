import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockRepo = vi.hoisted(() => ({
  findCustomerInClinic: vi.fn(),
  findSessionInClinic: vi.fn(),
  createPending: vi.fn(),
  findMany: vi.fn(),
  findById: vi.fn(),
  softDelete: vi.fn(),
  findClinicSettings: vi.fn(),
  updateClinicSettings: vi.fn(),
  findPendingStorageDeletion: vi.fn(),
  markStorageDeleted: vi.fn(),
}))

const mockRedis = vi.hoisted(() => ({
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
}))

const mockGeneratePresignedPutUrl = vi.hoisted(() => vi.fn())
const mockGeneratePresignedGetUrl = vi.hoisted(() => vi.fn())
const mockDeleteObject = vi.hoisted(() => vi.fn())

const mockCreateAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('./customer-photos.repository', () => ({
  CustomerPhotosRepository: vi.fn(function CustomerPhotosRepository() {
    return mockRepo
  }),
}))

vi.mock('../../database/redis/client', () => ({
  redis: mockRedis,
}))

vi.mock('../../integrations/r2/r2.service', () => ({
  generatePresignedPutUrl: mockGeneratePresignedPutUrl,
  generatePresignedGetUrl: mockGeneratePresignedGetUrl,
  deleteObject: mockDeleteObject,
}))

vi.mock('../../shared/audit', () => ({
  createAuditLog: mockCreateAuditLog,
}))

import { CustomerPhotosService } from './customer-photos.service'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error'

// ── Constantes ──────────────────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-uuid-1'
const USER_ID = 'user-uuid-1'
const CUSTOMER_ID = 'customer-uuid-1'
const PHOTO_ID = 'photo-uuid-1'
const SESSION_ID = 'session-uuid-1'
const STORAGE_KEY = `${CLINIC_ID}/${CUSTOMER_ID}/photo-uuid.jpg`

const CUSTOMER_WITH_CONSENT = {
  id: CUSTOMER_ID,
  bodyDataConsentAt: new Date('2024-01-01'),
}

const CUSTOMER_NO_CONSENT = {
  id: CUSTOMER_ID,
  bodyDataConsentAt: null,
}

const PHOTO_RECORD = {
  id: PHOTO_ID,
  storageKey: STORAGE_KEY,
  category: 'BEFORE_PHOTO',
  takenAt: null,
  bodyRegion: null,
  notes: null,
  measurementSessionId: null,
  uploadedByProfessional: null,
}

// ── Testes ──────────────────────────────────────────────────────────────────────

describe('CustomerPhotosService', () => {
  let service: CustomerPhotosService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CustomerPhotosService()
    // Padrão: clinica com settings sem regiões configuradas
    mockRepo.findClinicSettings.mockResolvedValue({ id: CLINIC_ID, settings: {} })
    mockGeneratePresignedPutUrl.mockResolvedValue('https://r2.example.com/upload-url')
    mockGeneratePresignedGetUrl.mockResolvedValue('https://r2.example.com/get-url')
  })

  // ── requestUploadUrls ─────────────────────────────────────────────────────

  describe('requestUploadUrls', () => {
    const baseDto = {
      files: [{ filename: 'foto.jpg', mimeType: 'image/jpeg', size: 500_000 }],
    }

    it('deve retornar upload URLs quando cliente tem consentimento LGPD', async () => {
      mockRepo.findCustomerInClinic.mockResolvedValue(CUSTOMER_WITH_CONSENT)

      const result = await service.requestUploadUrls({
        clinicId: CLINIC_ID,
        customerId: CUSTOMER_ID,
        userId: USER_ID,
        dto: baseDto,
      })

      expect(result.uploads).toHaveLength(1)
      expect(result.uploads[0].uploadUrl).toBe('https://r2.example.com/upload-url')
      expect(mockRedis.set).toHaveBeenCalledOnce()
    })

    it('deve lançar ValidationError quando cliente não tem consentimento LGPD', async () => {
      mockRepo.findCustomerInClinic.mockResolvedValue(CUSTOMER_NO_CONSENT)

      await expect(
        service.requestUploadUrls({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          userId: USER_ID,
          dto: baseDto,
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('deve lançar ForbiddenError quando cliente não pertence à clínica (cross-tenant)', async () => {
      mockRepo.findCustomerInClinic.mockResolvedValue(null)

      await expect(
        service.requestUploadUrls({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          userId: USER_ID,
          dto: baseDto,
        }),
      ).rejects.toThrow(ForbiddenError)
    })
  })

  // ── createPhotos ──────────────────────────────────────────────────────────

  describe('createPhotos', () => {
    const baseDto = {
      photos: [{ storageKey: STORAGE_KEY, category: 'BEFORE_PHOTO' as const }],
    }

    beforeEach(() => {
      // Redis cache válido por padrão
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ clinicId: CLINIC_ID, customerId: CUSTOMER_ID, userId: USER_ID }),
      )
      mockRepo.findCustomerInClinic.mockResolvedValue(CUSTOMER_WITH_CONSENT)
      mockRepo.createPending.mockResolvedValue(PHOTO_RECORD)
    })

    it('deve criar registros de fotos no caminho feliz', async () => {
      const result = await service.createPhotos({
        clinicId: CLINIC_ID,
        customerId: CUSTOMER_ID,
        userId: USER_ID,
        dto: baseDto,
      })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(PHOTO_ID)
      expect(mockRepo.createPending).toHaveBeenCalledOnce()
      expect(mockRedis.del).toHaveBeenCalledWith(`photo_upload:${STORAGE_KEY}`)
    })

    it('deve lançar ForbiddenError quando storageKey não está no Redis (expirado)', async () => {
      mockRedis.get.mockResolvedValue(null)

      await expect(
        service.createPhotos({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          userId: USER_ID,
          dto: baseDto,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it('deve lançar ForbiddenError quando storageKey pertence a outro tenant (IDOR)', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ clinicId: 'other-clinic', customerId: CUSTOMER_ID, userId: USER_ID }),
      )

      await expect(
        service.createPhotos({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          userId: USER_ID,
          dto: baseDto,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it('deve lançar ValidationError quando bodyRegion não está na lista configurada', async () => {
      mockRepo.findClinicSettings.mockResolvedValue({
        id: CLINIC_ID,
        settings: { photoBodyRegions: ['Abdômen', 'Braços'] },
      })

      await expect(
        service.createPhotos({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          userId: USER_ID,
          dto: {
            photos: [
              {
                storageKey: STORAGE_KEY,
                category: 'BEFORE_PHOTO',
                bodyRegion: 'Região Inválida',
              },
            ],
          },
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('deve lançar ValidationError quando sessionId não pertence ao cliente', async () => {
      mockRepo.findSessionInClinic.mockResolvedValue(null)

      await expect(
        service.createPhotos({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          userId: USER_ID,
          dto: {
            photos: [
              {
                storageKey: STORAGE_KEY,
                category: 'PROGRESS_PHOTO',
                sessionId: SESSION_ID,
              },
            ],
          },
        }),
      ).rejects.toThrow(ValidationError)
    })
  })

  // ── deletePhoto ───────────────────────────────────────────────────────────

  describe('deletePhoto', () => {
    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(PHOTO_RECORD)
      mockRepo.softDelete.mockResolvedValue({ ...PHOTO_RECORD, deletedAt: new Date() })
    })

    it('deve soft-deletar a foto e registrar auditoria', async () => {
      await service.deletePhoto({
        clinicId: CLINIC_ID,
        customerId: CUSTOMER_ID,
        photoId: PHOTO_ID,
        userId: USER_ID,
        dto: { reason: 'Foto duplicada do cliente' },
      })

      expect(mockRepo.softDelete).toHaveBeenCalledWith(
        PHOTO_ID,
        CLINIC_ID,
        CUSTOMER_ID,
        USER_ID,
        'Foto duplicada do cliente',
      )
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'photo.DELETE' }),
      )
    })

    it('deve lançar NotFoundError quando foto não existe', async () => {
      mockRepo.findById.mockResolvedValue(null)

      await expect(
        service.deletePhoto({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          photoId: PHOTO_ID,
          userId: USER_ID,
          dto: { reason: 'Foto duplicada do cliente' },
        }),
      ).rejects.toThrow(NotFoundError)
    })
  })

  // ── getBodyRegions / updateBodyRegions ────────────────────────────────────

  describe('getBodyRegions', () => {
    it('deve retornar lista vazia quando clínica não tem regiões configuradas', async () => {
      mockRepo.findClinicSettings.mockResolvedValue({ id: CLINIC_ID, settings: null })

      const result = await service.getBodyRegions(CLINIC_ID)
      expect(result).toEqual([])
    })

    it('deve retornar regiões configuradas', async () => {
      mockRepo.findClinicSettings.mockResolvedValue({
        id: CLINIC_ID,
        settings: { photoBodyRegions: ['Abdômen', 'Braços', 'Pernas'] },
      })

      const result = await service.getBodyRegions(CLINIC_ID)
      expect(result).toEqual(['Abdômen', 'Braços', 'Pernas'])
    })
  })

  describe('updateBodyRegions', () => {
    it('deve persistir lista de regiões via repositório', async () => {
      mockRepo.updateClinicSettings.mockResolvedValue(undefined)

      await service.updateBodyRegions(CLINIC_ID, ['Abdômen', 'Braços'])

      expect(mockRepo.updateClinicSettings).toHaveBeenCalledWith(CLINIC_ID, {
        photoBodyRegions: ['Abdômen', 'Braços'],
      })
    })
  })
})
