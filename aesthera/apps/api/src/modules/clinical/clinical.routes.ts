import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { NotFoundError } from '../../shared/errors/app-error'
import { CreateClinicalRecordDto, ListClinicalRecordsQuery, UpdateClinicalRecordDto } from './clinical.dto'
import { ClinicalRepository } from './clinical.repository'
import { createAuditLog } from '../../shared/audit'

const repo = new ClinicalRepository()

export async function clinicalRoutes(app: FastifyInstance) {
  // List clinical records
  app.get('/clinical-records', { preHandler: [jwtClinicGuard] }, async (req, _reply) => {
    const q = ListClinicalRecordsQuery.parse(req.query)
    return repo.findAll(req.clinicId, q)
  })

  // Create clinical record
  app.post('/clinical-records', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const dto = CreateClinicalRecordDto.parse(req.body)
    const record = await repo.create(req.clinicId, dto)
    await createAuditLog({
      clinicId: req.clinicId,
      userId: req.user.sub,
      action: 'clinical_record.created',
      entityId: record.id,
      ip: req.ip,
    })
    return reply.code(201).send(record)
  })

  // Update clinical record (title, content, type, performedAt are editable)
  app.patch('/clinical-records/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await repo.findById(req.clinicId, id)
    if (!existing) throw new NotFoundError('Clinical record not found')
    const dto = UpdateClinicalRecordDto.parse(req.body)
    const updated = await repo.update(req.clinicId, id, dto)
    await createAuditLog({
      clinicId: req.clinicId,
      userId: req.user.sub,
      action: 'clinical_record.updated',
      entityId: id,
      ip: req.ip,
    })
    return reply.send(updated)
  })
}
