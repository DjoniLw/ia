import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreateFieldDto,
  CreateSheetDto,
  CreateSubColumnDto,
  ListSheetsQuery,
  ReorderFieldsDto,
  UpdateFieldDto,
  UpdateSheetDto,
  UpdateSubColumnDto,
} from './measurement-sheets.dto'
import { MeasurementSheetsService } from './measurement-sheets.service'

export async function measurementSheetsRoutes(app: FastifyInstance) {
  const svc = new MeasurementSheetsService()

  // ─── Fichas ──────────────────────────────────────────────────────────────────

  /** GET /measurement-sheets — lista fichas da clínica */
  app.get(
    '/measurement-sheets',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const q = ListSheetsQuery.parse(req.query)
      return reply.send(await svc.listSheets(req.clinicId, q))
    },
  )

  /** POST /measurement-sheets — cria nova ficha (admin only) */
  app.post(
    '/measurement-sheets',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateSheetDto.parse(req.body)
      return reply.status(201).send(await svc.createSheet(req.clinicId, dto))
    },
  )

  /** PATCH /measurement-sheets/:id — atualiza ficha (admin only) */
  app.patch(
    '/measurement-sheets/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateSheetDto.parse(req.body)
      return reply.send(await svc.updateSheet(id, req.clinicId, dto))
    },
  )

  /** DELETE /measurement-sheets/:id — exclui ficha (admin only) */
  app.delete(
    '/measurement-sheets/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.deleteSheet(id, req.clinicId)
      return reply.status(204).send()
    },
  )

  // ─── Campos ──────────────────────────────────────────────────────────────────

  /** GET /measurement-sheets/:sheetId/fields — lista campos de uma ficha */
  app.get(
    '/measurement-sheets/:sheetId/fields',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { sheetId } = req.params as { sheetId: string }
      return reply.send(await svc.listFields(sheetId, req.clinicId))
    },
  )

  /** POST /measurement-sheets/:sheetId/fields — cria campo (admin only) */
  app.post(
    '/measurement-sheets/:sheetId/fields',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId } = req.params as { sheetId: string }
      const dto = CreateFieldDto.parse(req.body)
      return reply.status(201).send(await svc.createField(sheetId, req.clinicId, dto))
    },
  )

  /** PATCH /measurement-sheets/:sheetId/fields/:fieldId — atualiza campo (admin only) */
  app.patch(
    '/measurement-sheets/:sheetId/fields/:fieldId',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId, fieldId } = req.params as { sheetId: string; fieldId: string }
      const dto = UpdateFieldDto.parse(req.body)
      return reply.send(await svc.updateField(sheetId, fieldId, req.clinicId, dto))
    },
  )

  /** DELETE /measurement-sheets/:sheetId/fields/:fieldId — exclui campo (admin only) */
  app.delete(
    '/measurement-sheets/:sheetId/fields/:fieldId',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId, fieldId } = req.params as { sheetId: string; fieldId: string }
      await svc.deleteField(sheetId, fieldId, req.clinicId)
      return reply.status(204).send()
    },
  )

  /** POST /measurement-sheets/:sheetId/fields/reorder — reordena campos (admin only) */
  app.post(
    '/measurement-sheets/:sheetId/fields/reorder',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId } = req.params as { sheetId: string }
      const dto = ReorderFieldsDto.parse(req.body)
      return reply.send(await svc.reorderFields(sheetId, req.clinicId, dto))
    },
  )

  // ─── Sub-colunas ──────────────────────────────────────────────────────────────

  /** POST /measurement-sheets/:sheetId/fields/:fieldId/columns — cria sub-coluna (admin only) */
  app.post(
    '/measurement-sheets/:sheetId/fields/:fieldId/columns',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId, fieldId } = req.params as { sheetId: string; fieldId: string }
      const dto = CreateSubColumnDto.parse(req.body)
      return reply.status(201).send(await svc.createSubColumn(sheetId, fieldId, req.clinicId, dto))
    },
  )

  /** PATCH /measurement-sheets/:sheetId/fields/:fieldId/columns/:colId — atualiza sub-coluna (admin only) */
  app.patch(
    '/measurement-sheets/:sheetId/fields/:fieldId/columns/:colId',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId, fieldId, colId } = req.params as { sheetId: string; fieldId: string; colId: string }
      const dto = UpdateSubColumnDto.parse(req.body)
      return reply.send(await svc.updateSubColumn(sheetId, fieldId, colId, req.clinicId, dto))
    },
  )

  /** DELETE /measurement-sheets/:sheetId/fields/:fieldId/columns/:colId — exclui sub-coluna (admin only) */
  app.delete(
    '/measurement-sheets/:sheetId/fields/:fieldId/columns/:colId',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId, fieldId, colId } = req.params as { sheetId: string; fieldId: string; colId: string }
      await svc.deleteSubColumn(sheetId, fieldId, colId, req.clinicId)
      return reply.status(204).send()
    },
  )
}
