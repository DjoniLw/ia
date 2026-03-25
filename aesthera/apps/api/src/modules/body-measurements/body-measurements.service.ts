import type { FastifyBaseLogger } from 'fastify'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error'
import {
  MAX_ACTIVE_FIELDS,
  type CreateFieldDto,
  type CreateRecordDto,
  type ListRecordsQuery,
  type UpdateFieldDto,
} from './body-measurements.dto'
import { BodyMeasurementsRepository } from './body-measurements.repository'

export class BodyMeasurementsService {
  private repo = new BodyMeasurementsRepository()

  // ─── Fields ────────────────────────────────────────────────────────────────

  async listFields(clinicId: string) {
    return this.repo.listFields(clinicId)
  }

  async createField(clinicId: string, dto: CreateFieldDto) {
    const activeCount = await this.repo.countActiveFields(clinicId)
    if (activeCount >= MAX_ACTIVE_FIELDS) {
      throw new ValidationError('MAX_FIELDS_REACHED')
    }
    return this.repo.createField(clinicId, dto)
  }

  async updateField(id: string, clinicId: string, dto: UpdateFieldDto) {
    const field = await this.repo.findFieldById(id, clinicId)
    if (!field) throw new NotFoundError('BodyMeasurementField')

    // Proteção cross-tenant (já garantida pelo findFieldById com clinicId)
    if (field.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // Reativação: verificar limite de 30
    if (dto.active === true && !field.active) {
      const activeCount = await this.repo.countActiveFields(clinicId)
      if (activeCount >= MAX_ACTIVE_FIELDS) {
        throw new ValidationError('MAX_FIELDS_REACHED')
      }
    }

    return this.repo.updateField(id, clinicId, dto)
  }

  async deleteField(id: string, clinicId: string) {
    const field = await this.repo.findFieldById(id, clinicId)
    if (!field) throw new NotFoundError('BodyMeasurementField')
    if (field.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // Soft-delete: active = false — NUNCA DELETE físico
    return this.repo.deactivateField(id, clinicId)
  }

  // ─── Records ───────────────────────────────────────────────────────────────

  async listRecords(
    clinicId: string,
    q: ListRecordsQuery,
    userRole: string,
    userId: string,
  ) {
    // RN18: professional só pode ver registros de clientes com quem já teve atendimento
    if (userRole === 'professional') {
      const hasLink = await this.repo.professionalHasAppointmentWithCustomer(
        userId,
        q.customerId,
        clinicId,
      )
      if (!hasLink) {
        throw new ForbiddenError(
          'Você não tem permissão para visualizar os dados de evolução deste cliente',
        )
      }
    }

    return this.repo.listRecords(clinicId, q)
  }

  async createRecord(
    clinicId: string,
    userId: string,
    dto: CreateRecordDto,
    logger: FastifyBaseLogger,
  ) {
    // 1. Cross-tenant: customer pertence à clínica
    const customer = await this.repo.findCustomerInClinic(dto.customerId, clinicId)
    if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // 2. Cross-tenant: todos os fieldIds pertencem à clínica
    if (dto.values.length > 0) {
      const fieldIds = dto.values.map((v) => v.fieldId)
      const allOwned = await this.repo.validateFieldsOwnership(fieldIds, clinicId)
      if (!allOwned) throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    }

    // 3. Registro retroativo: log de warning se recordedAt < now - 7 dias
    const recordedDate = new Date(dto.recordedAt)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (recordedDate < sevenDaysAgo) {
      logger.warn(
        { clinicId, customerId: dto.customerId, recordedAt: dto.recordedAt },
        'Retroactive measurement record',
      )
    }

    // 4. Criar registro com valores
    const record = await this.repo.createRecord(clinicId, userId, dto)

    // 5. Vincular arquivos confirmados ao registro
    if (dto.fileIds && dto.fileIds.length > 0) {
      await this.repo.linkFilesToRecord(record.id, dto.fileIds, clinicId, dto.customerId)
    }

    return record
  }

  async deleteRecord(id: string, clinicId: string) {
    const record = await this.repo.findRecordById(id, clinicId)
    if (!record) throw new NotFoundError('BodyMeasurementRecord')
    if (record.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    return this.repo.deleteRecord(id, clinicId)
  }
}
