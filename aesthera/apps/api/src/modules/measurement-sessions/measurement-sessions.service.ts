import type { FastifyBaseLogger } from 'fastify'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error'
import type {
  CreateSessionDto,
  ListSessionsQuery,
  UpdateSessionDto,
} from './measurement-sessions.dto'
import { MeasurementSessionsRepository } from './measurement-sessions.repository'

export class MeasurementSessionsService {
  private repo = new MeasurementSessionsRepository()

  async listSessions(clinicId: string, q: ListSessionsQuery) {
    // Cross-tenant: customer pertence à clínica
    const customer = await this.repo.findCustomerInClinic(q.customerId, clinicId)
    if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    return this.repo.listSessions(clinicId, q)
  }

  async createSession(
    clinicId: string,
    userId: string,
    dto: CreateSessionDto,
    logger: FastifyBaseLogger,
  ) {
    // 1. Cross-tenant: customer pertence à clínica
    const customer = await this.repo.findCustomerInClinic(dto.customerId, clinicId)
    if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // 2. Ao menos 1 sheetRecord com ao menos 1 valor (numérico ou texto)
    const hasAnyValue = dto.sheetRecords.some(
      (sr) =>
        sr.values.some((v) => v.value !== undefined || (v.textValue !== undefined && v.textValue !== '')) ||
        sr.tabularValues.some((v) => v.value !== undefined || (v.textValue !== undefined && v.textValue !== '')),
    )
    if (!hasAnyValue) throw new ValidationError('EMPTY_SESSION')

    // 3. Cross-tenant: sheets pertencem à clínica
    const sheetIds = dto.sheetRecords.map((sr) => sr.sheetId)
    const sheetsOwned = await this.repo.validateSheetsOwnership(sheetIds, clinicId)
    if (!sheetsOwned) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // 4. Cross-tenant: fieldIds pertencem à clínica
    // Deduplicar: fichas TABULAR podem ter o mesmo fieldId em múltiplas colunas
    const allFieldIds = [...new Set([
      ...dto.sheetRecords.flatMap((sr) => sr.values.map((v) => v.fieldId)),
      ...dto.sheetRecords.flatMap((sr) => sr.tabularValues.map((v) => v.fieldId)),
    ])]
    const fieldsOwned = await this.repo.validateFieldsOwnership(allFieldIds, clinicId)
    if (!fieldsOwned) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // 5. Cross-tenant: columnIds pertencem às sheets correspondentes
    const columnSheetMap = new Map<string, string>()
    for (const sr of dto.sheetRecords) {
      for (const tv of sr.tabularValues) {
        columnSheetMap.set(tv.columnId, sr.sheetId)
      }
    }
    const columnsValid = await this.repo.validateColumnsOwnership(
      Array.from(columnSheetMap.keys()),
      columnSheetMap,
    )
    if (!columnsValid) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // 6. Warning para registro retroativo > 7 dias
    const recordedDate = new Date(dto.recordedAt)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (recordedDate < sevenDaysAgo) {
      logger.warn({ clinicId, customerId: dto.customerId, recordedAt: dto.recordedAt }, 'Retroactive measurement session')
    }

    return this.repo.createSession(clinicId, userId, dto)
  }

  async updateSession(
    id: string,
    clinicId: string,
    userId: string,
    userRole: string,
    dto: UpdateSessionDto,
    logger: FastifyBaseLogger,
  ) {
    const session = await this.repo.findSessionById(id, clinicId)
    if (!session) throw new NotFoundError('MeasurementSession')

    // Cross-tenant
    if (session.clinicId !== clinicId) {
      logger.warn({ sessionId: id, sessionClinicId: session.clinicId, reqClinicId: clinicId }, 'updateSession: cross-tenant violation')
      throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    }

    // Permissão: professional só pode editar sessão própria
    if (userRole === 'professional' && session.createdById !== userId) {
      logger.warn({ sessionId: id, createdById: session.createdById, userId, userRole }, 'updateSession: professional trying to edit session not owned by them')
      throw new ForbiddenError('Você só pode editar evoluções criadas por você')
    }

    // Se sheetRecords fornecidos, validar cross-tenant
    if (dto.sheetRecords) {
      const sheetIds = dto.sheetRecords.map((sr) => sr.sheetId)
      const sheetsOwned = await this.repo.validateSheetsOwnership(sheetIds, clinicId)
      if (!sheetsOwned) {
        logger.warn({ sessionId: id, clinicId, sheetIds }, 'updateSession: sheet ownership validation failed')
        throw new ForbiddenError('CROSS_TENANT_VIOLATION')
      }

      // Deduplicar: fichas TABULAR podem ter o mesmo fieldId em múltiplas colunas
      const allFieldIds = [...new Set([
        ...dto.sheetRecords.flatMap((sr) => sr.values?.map((v) => v.fieldId) ?? []),
        ...dto.sheetRecords.flatMap((sr) => sr.tabularValues?.map((v) => v.fieldId) ?? []),
      ])]
      const fieldsOwned = await this.repo.validateFieldsOwnership(allFieldIds, clinicId)
      if (!fieldsOwned) {
        logger.warn({ sessionId: id, clinicId, allFieldIds }, 'updateSession: field ownership validation failed')
        throw new ForbiddenError('CROSS_TENANT_VIOLATION')
      }

      // Impedir sessão vazia após update
      const hasAnyValues = dto.sheetRecords.some(
        (sr) => (sr.values?.length ?? 0) + (sr.tabularValues?.length ?? 0) > 0,
      )
      if (!hasAnyValues) throw new ValidationError('EMPTY_SESSION')

      // Validar consistência columnId → sheetId
      const columnSheetMap = new Map<string, string>()
      for (const sr of dto.sheetRecords) {
        for (const tv of sr.tabularValues ?? []) {
          columnSheetMap.set(tv.columnId, sr.sheetId)
        }
      }
      if (columnSheetMap.size > 0) {
        const columnsValid = await this.repo.validateColumnsOwnership(
          Array.from(columnSheetMap.keys()),
          columnSheetMap,
        )
        if (!columnsValid) {
          logger.warn(
            { sessionId: id, clinicId, columns: Object.fromEntries(columnSheetMap) },
            'updateSession: column ownership validation failed — columnId may not belong to the given sheetId',
          )
          throw new ForbiddenError('CROSS_TENANT_VIOLATION')
        }
      }
    }

    return this.repo.updateSession(id, clinicId, dto)
  }

  async deleteSession(id: string, clinicId: string) {
    const session = await this.repo.findSessionById(id, clinicId)
    if (!session) throw new NotFoundError('MeasurementSession')
    if (session.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    await this.repo.deleteSession(id, clinicId)
  }
}
