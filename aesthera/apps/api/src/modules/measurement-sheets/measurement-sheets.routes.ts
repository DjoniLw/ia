import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreateFieldDto,
  CreateSheetColumnDto,
  CreateSheetDto,
  ListSheetsQuery,
  ReorderFieldsDto,
  ReorderSheetColumnsDto,
  ReorderSheetsDto,
  UpdateFieldDto,
  UpdateSheetColumnDto,
  UpdateSheetDto,
} from './measurement-sheets.dto'
import { MeasurementSheetsService } from './measurement-sheets.service'

export async function measurementSheetsRoutes(app: FastifyInstance) {
  const svc = new MeasurementSheetsService()

  // ─── Templates (rotas estáticas ANTES de /:id) ───────────────────────────────

  /** GET /measurement-sheets/templates — lista templates disponíveis */
  app.get(
    '/measurement-sheets/templates',
    { preHandler: [jwtClinicGuard] },
    async (_req, reply) => {
      return reply.send(svc.listTemplates())
    },
  )

  /** POST /measurement-sheets/templates/:id/copy — copia template para a clínica (admin only) */
  app.post(
    '/measurement-sheets/templates/:id/copy',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = req.body as { name?: string } | undefined
      return reply.status(201).send(await svc.copyTemplate(req.clinicId, req.user.sub, req.user.role, id, body?.name))
    },
  )

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

  /** POST /measurement-sheets — cria nova ficha */
  app.post(
    '/measurement-sheets',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const dto = CreateSheetDto.parse(req.body)
      return reply.status(201).send(await svc.createSheet(req.clinicId, dto, req.user.sub, req.user.role))
    },
  )

  /** PATCH /measurement-sheets/:id — atualiza ficha */
  app.patch(
    '/measurement-sheets/:id',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateSheetDto.parse(req.body)
      return reply.send(await svc.updateSheet(id, req.clinicId, dto, req.user.sub, req.user.role))
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

  /** POST /measurement-sheets/reorder — reordena fichas em batch (admin only) */
  app.post(
    '/measurement-sheets/reorder',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = ReorderSheetsDto.parse(req.body)
      return reply.send(await svc.reorderSheets(req.clinicId, dto))
    },
  )

  // ─── Colunas (fichas TABULAR) ─────────────────────────────────────────────────

  /** GET /measurement-sheets/:sheetId/columns — lista colunas de uma ficha */
  app.get(
    '/measurement-sheets/:sheetId/columns',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { sheetId } = req.params as { sheetId: string }
      return reply.send(await svc.listSheetColumns(sheetId, req.clinicId))
    },
  )

  /** POST /measurement-sheets/:sheetId/columns — cria coluna (admin only) */
  app.post(
    '/measurement-sheets/:sheetId/columns',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId } = req.params as { sheetId: string }
      const dto = CreateSheetColumnDto.parse(req.body)
      return reply.status(201).send(await svc.createSheetColumn(sheetId, req.clinicId, dto))
    },
  )

  /** PATCH /measurement-sheets/:sheetId/columns/:colId — atualiza coluna (admin only) */
  app.patch(
    '/measurement-sheets/:sheetId/columns/:colId',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId, colId } = req.params as { sheetId: string; colId: string }
      const dto = UpdateSheetColumnDto.parse(req.body)
      return reply.send(await svc.updateSheetColumn(sheetId, colId, req.clinicId, dto))
    },
  )

  /** DELETE /measurement-sheets/:sheetId/columns/:colId — exclui coluna (admin only) */
  app.delete(
    '/measurement-sheets/:sheetId/columns/:colId',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId, colId } = req.params as { sheetId: string; colId: string }
      await svc.deleteSheetColumn(sheetId, colId, req.clinicId)
      return reply.status(204).send()
    },
  )

  /** POST /measurement-sheets/:sheetId/columns/reorder — reordena colunas (admin only) */
  app.post(
    '/measurement-sheets/:sheetId/columns/reorder',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sheetId } = req.params as { sheetId: string }
      const dto = ReorderSheetColumnsDto.parse(req.body)
      return reply.send(await svc.reorderSheetColumns(sheetId, req.clinicId, dto))
    },
  )
}
