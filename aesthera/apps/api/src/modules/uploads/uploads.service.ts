import crypto from 'node:crypto'
import path from 'node:path'
import {
  generatePresignedGetUrl,
  generatePresignedPutUrl,
  getObjectFirstBytes,
  headObject,
} from '../../integrations/r2/r2.service'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error'
import {
  BODY_DATA_CATEGORIES,
  type ConfirmUploadDto,
  type PresignDto,
} from './uploads.dto'
import { UploadsRepository } from './uploads.repository'

// Magic bytes para validação de MIME type real
const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  'image/webp': (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
  'application/pdf': (b) =>
    b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
}

export class UploadsService {
  private repo = new UploadsRepository()

  /**
   * Gera presigned PUT URL para upload direto ao R2.
   * NUNCA recebe clinicId do body — sempre do JWT.
   */
  async presign(clinicId: string, userId: string, dto: PresignDto) {
    // 1. Proteção IDOR: cross-tenant check — nunca 404
    const customer = await this.repo.findCustomerInClinic(dto.customerId, clinicId)
    if (!customer) {
      throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    }

    // 2. LGPD: consentimento obrigatório para fotos corporais
    if (
      BODY_DATA_CATEGORIES.includes(dto.category as any) &&
      !customer.bodyDataConsentAt
    ) {
      throw new ValidationError('BODY_DATA_CONSENT_REQUIRED')
    }

    // 3. Gerar storageKey: {clinicId}/{customerId}/{uuid}.{ext}
    const ext = path.extname(dto.fileName).toLowerCase() || '.bin'
    const storageKey = `${clinicId}/${dto.customerId}/${crypto.randomUUID()}${ext}`

    const presignedUrl = await generatePresignedPutUrl(storageKey, dto.mimeType, 3600)
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()

    return { presignedUrl, storageKey, expiresAt }
  }

  /**
   * Confirma o upload: verifica existência real + magic bytes + persiste CustomerFile.
   */
  async confirm(clinicId: string, userId: string, dto: ConfirmUploadDto) {
    // 1. Cross-tenant check
    const customer = await this.repo.findCustomerInClinic(dto.customerId, clinicId)
    if (!customer) {
      throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    }

    // 2. Validação de escopo do storageKey — impede confirmar arquivos fora do tenant
    const expectedPrefix = `${clinicId}/${dto.customerId}/`
    if (!dto.storageKey.startsWith(expectedPrefix)) {
      throw new ForbiddenError('INVALID_STORAGE_KEY_PREFIX')
    }
    if (dto.storageKey.split('/').includes('..')) {
      throw new ForbiddenError('INVALID_STORAGE_KEY_PATH')
    }

    // 3. HEAD no storage: verificar existência real
    const exists = await headObject(dto.storageKey)
    if (!exists) {
      throw new ValidationError('FILE_NOT_FOUND_IN_STORAGE')
    }

    // 4. Magic bytes: validar MIME type real
    const magicBytes = await getObjectFirstBytes(dto.storageKey, 12)
    const validator = MAGIC_BYTES[dto.mimeType]
    if (validator && !validator(magicBytes)) {
      throw new ValidationError('MIME_TYPE_MISMATCH')
    }

    // 5. Persistir CustomerFile
    return this.repo.create(clinicId, userId, dto)
  }

  /**
   * Retorna presigned GET URL (TTL 1h) — NUNCA URLs permanentes.
   */
  async getUrl(
    id: string,
    clinicId: string,
    userId: string,
    userRole: string,
    professionalId?: string,
  ) {
    const file = await this.repo.findByIdInClinic(id, clinicId)
    if (!file) {
      // Não expor existência de arquivo de outra clínica
      throw new NotFoundError('CustomerFile')
    }

    // RN18: professional precisa ter tido atendimento com o cliente
    if (userRole === 'professional') {
      if (!professionalId) throw new ForbiddenError('Acesso negado')
      const hasLink = await this.repo.professionalHasAppointmentWithCustomer(
        professionalId,
        file.customerId,
        clinicId,
      )
      if (!hasLink) {
        throw new ForbiddenError(
          'Você não tem permissão para acessar arquivos deste cliente',
        )
      }
    }

    const url = await generatePresignedGetUrl(file.storageKey, 3600)
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()

    return { url, expiresAt }
  }

  /**
   * Soft-delete: atualiza deletedAt — NUNCA hard-delete.
   */
  async softDelete(id: string, clinicId: string) {
    const file = await this.repo.findByIdInClinic(id, clinicId)
    if (!file) throw new NotFoundError('CustomerFile')
    await this.repo.softDelete(id, clinicId)
  }
}
