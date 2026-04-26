import crypto from 'node:crypto'
import path from 'node:path'
import { redis } from '../../database/redis/client'
import {
  generatePresignedGetUrl,
  generatePresignedPutUrl,
} from '../../integrations/r2/r2.service'
import { createAuditLog } from '../../shared/audit'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error'
import {
  PHOTO_UPLOAD_URL_TTL_SECONDS,
  type CreatePhotosDto,
  type DeletePhotoDto,
  type ListPhotosQueryDto,
  type RequestUploadUrlDto,
} from './customer-photos.dto'
import { CustomerPhotosRepository } from './customer-photos.repository'

const REDIS_KEY_PREFIX = 'photo_upload'
const PRESIGNED_GET_TTL = 3600 // 1h para thumbnails e originais

export class CustomerPhotosService {
  private repo = new CustomerPhotosRepository()

  // ─── POST /customers/:customerId/photos/upload-url ───────────────────────

  async requestUploadUrls(params: {
    clinicId: string
    customerId: string
    userId: string
    dto: RequestUploadUrlDto
    ip?: string
  }) {
    const { clinicId, customerId, userId, dto } = params

    // 1. Verificar que o cliente pertence à clínica
    const customer = await this.repo.findCustomerInClinic(customerId, clinicId)
    if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // 2. LGPD: verificar consentimento para uso de imagens corporais
    if (!customer.bodyDataConsentAt) {
      throw new ValidationError('Consentimento LGPD para uso de imagens corporais não encontrado')
    }

    // 3. Gerar pre-signed URLs e cachear no Redis para anti-IDOR
    const uploads: Array<{ uploadUrl: string; storageKey: string; expiresAt: string }> = []

    for (const file of dto.files) {
      const ext = path.extname(file.filename).toLowerCase() || '.jpg'
      const storageKey = `${clinicId}/${customerId}/${crypto.randomUUID()}${ext}`

      const uploadUrl = await generatePresignedPutUrl(
        storageKey,
        file.mimeType,
        PHOTO_UPLOAD_URL_TTL_SECONDS,
      )

      const expiresAt = new Date(Date.now() + PHOTO_UPLOAD_URL_TTL_SECONDS * 1000).toISOString()

      // Anti-IDOR: associar storageKey → contexto no Redis
      await redis.set(
        `${REDIS_KEY_PREFIX}:${storageKey}`,
        JSON.stringify({ clinicId, customerId, userId }),
        'EX',
        PHOTO_UPLOAD_URL_TTL_SECONDS,
      )

      uploads.push({ uploadUrl, storageKey, expiresAt })
    }

    return { uploads }
  }

  // ─── POST /customers/:customerId/photos ──────────────────────────────────

  async createPhotos(params: {
    clinicId: string
    customerId: string
    userId: string
    professionalId?: string
    dto: CreatePhotosDto
    ip?: string
  }) {
    const { clinicId, customerId, userId, professionalId, dto } = params

    // 1. Verificar cliente
    const customer = await this.repo.findCustomerInClinic(customerId, clinicId)
    if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // 2. Buscar regiões configuradas pela clínica (para validar bodyRegion)
    const allowedRegions = await this.getBodyRegions(clinicId)

    const created = []

    for (const photo of dto.photos) {
      // 3. Anti-IDOR: validar storageKey via Redis
      const cached = await redis.get(`${REDIS_KEY_PREFIX}:${photo.storageKey}`)
      if (!cached) {
        throw new ForbiddenError(`storageKey inválido ou expirado: ${photo.storageKey}`)
      }
      const cachedData = JSON.parse(cached) as {
        clinicId: string
        customerId: string
        userId: string
      }
      if (
        cachedData.clinicId !== clinicId ||
        cachedData.customerId !== customerId ||
        cachedData.userId !== userId
      ) {
        throw new ForbiddenError('CROSS_TENANT_VIOLATION')
      }

      // 4. Validar bodyRegion se informado e se há regiões configuradas
      if (photo.bodyRegion && allowedRegions.length > 0) {
        if (!allowedRegions.includes(photo.bodyRegion)) {
          throw new ValidationError(
            `Região corporal "${photo.bodyRegion}" não está configurada para esta clínica`,
          )
        }
      }

      // 5. Validar sessionId se informado
      if (photo.sessionId) {
        const session = await this.repo.findSessionInClinic(photo.sessionId, clinicId, customerId)
        if (!session) {
          throw new ValidationError('Sessão de avaliação não encontrada ou não pertence a este cliente')
        }
      }

      // 6. Criar registro
      const record = await this.repo.createPending({
        clinicId,
        customerId,
        storageKey: photo.storageKey,
        name: path.basename(photo.storageKey),
        mimeType: this.mimeTypeFromKey(photo.storageKey),
        size: 0, // tamanho real não é verificado no confirm (upload direto)
        category: photo.category,
        uploadedById: userId,
        uploadedByProfessionalId: professionalId ?? undefined,
        takenAt: photo.takenAt ? new Date(photo.takenAt) : undefined,
        bodyRegion: photo.bodyRegion,
        notes: photo.notes,
        measurementSessionId: photo.sessionId,
      })

      // 7. Remover chave do Redis após consumo
      await redis.del(`${REDIS_KEY_PREFIX}:${photo.storageKey}`)

      created.push(record)
    }

    return created
  }

  // ─── GET /customers/:customerId/photos ───────────────────────────────────

  async listPhotos(params: {
    clinicId: string
    customerId: string
    userId: string
    query: ListPhotosQueryDto
    ip?: string
  }) {
    const { clinicId, customerId, userId, query, ip } = params

    const customer = await this.repo.findCustomerInClinic(customerId, clinicId)
    if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    const result = await this.repo.findMany(clinicId, customerId, query)

    // Log de auditoria LGPD Art. 11
    const photoIds = result.items.map((p) => p.id)
    await createAuditLog({
      clinicId,
      userId,
      action: 'photo.VIEW',
      entityId: customerId,
      metadata: { photoIds, page: query.page, limit: query.limit },
      ip,
    })

    // Gerar presigned GET URLs para cada foto
    const itemsWithUrls = await Promise.all(
      result.items.map(async (photo) => {
        const url = await generatePresignedGetUrl(photo.storageKey, PRESIGNED_GET_TTL)
        return { ...photo, url, urlExpiresAt: new Date(Date.now() + PRESIGNED_GET_TTL * 1000).toISOString() }
      }),
    )

    return { ...result, items: itemsWithUrls }
  }

  // ─── GET /customers/:customerId/photos/:photoId/url ──────────────────────

  async getPhotoUrl(params: {
    clinicId: string
    customerId: string
    photoId: string
    userId: string
    ip?: string
  }) {
    const { clinicId, customerId, photoId, userId, ip } = params

    const photo = await this.repo.findById(photoId, clinicId, customerId)
    if (!photo) throw new NotFoundError('CustomerPhoto')

    const url = await generatePresignedGetUrl(photo.storageKey, PRESIGNED_GET_TTL)

    await createAuditLog({
      clinicId,
      userId,
      action: 'photo.GENERATE_URL',
      entityId: photoId,
      ip,
    })

    return {
      url,
      expiresAt: new Date(Date.now() + PRESIGNED_GET_TTL * 1000).toISOString(),
    }
  }

  // ─── DELETE /customers/:customerId/photos/:photoId ───────────────────────

  async deletePhoto(params: {
    clinicId: string
    customerId: string
    photoId: string
    userId: string
    dto: DeletePhotoDto
    ip?: string
  }) {
    const { clinicId, customerId, photoId, userId, dto, ip } = params

    const photo = await this.repo.findById(photoId, clinicId, customerId)
    if (!photo) throw new NotFoundError('CustomerPhoto')

    const deleted = await this.repo.softDelete(photoId, clinicId, customerId, userId, dto.reason)
    if (!deleted) throw new NotFoundError('CustomerPhoto')

    await createAuditLog({
      clinicId,
      userId,
      action: 'photo.DELETE',
      entityId: photoId,
      metadata: { reason: dto.reason },
      ip,
    })

    return deleted
  }

  // ─── Settings: regiões corporais ─────────────────────────────────────────

  async getBodyRegions(clinicId: string): Promise<string[]> {
    const clinic = await this.repo.findClinicSettings(clinicId)
    if (!clinic) return []
    const settings = clinic.settings as Record<string, unknown> | null
    const regions = settings?.photoBodyRegions
    if (!Array.isArray(regions)) return []
    return regions as string[]
  }

  async updateBodyRegions(clinicId: string, regions: string[]): Promise<string[]> {
    await this.repo.updateClinicSettings(clinicId, { photoBodyRegions: regions })
    return regions
  }

  // ─── Job: limpeza do storage ──────────────────────────────────────────────

  async runStorageCleanupBatch(): Promise<number> {
    const { deleteObject } = await import('../../integrations/r2/r2.service')
    const batch = await this.repo.findPendingStorageDeletion(100)
    if (batch.length === 0) return 0

    const deleted: string[] = []
    for (const file of batch) {
      try {
        await deleteObject(file.storageKey)
        deleted.push(file.id)
      } catch (err) {
        // Log e continua — próxima execução tentará novamente
        console.error(`[photo-cleanup] Falha ao deletar ${file.storageKey}:`, err)
      }
    }

    if (deleted.length > 0) {
      await this.repo.markStorageDeleted(deleted)
    }

    return deleted.length
  }

  // ─── Helpers privados ────────────────────────────────────────────────────

  private mimeTypeFromKey(storageKey: string): string {
    const ext = path.extname(storageKey).toLowerCase()
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    }
    return map[ext] ?? 'image/jpeg'
  }
}
