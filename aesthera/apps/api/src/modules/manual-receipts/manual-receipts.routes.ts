import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { CreateManualReceiptDto } from './manual-receipts.dto'
import { ManualReceiptsService } from './manual-receipts.service'

export async function manualReceiptsRoutes(app: FastifyInstance) {
  const svc = new ManualReceiptsService()

  app.post(
    '/billing/:id/receive',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = CreateManualReceiptDto.parse(req.body)
      return reply.status(201).send(await svc.receive(req.clinicId, id, dto))
    },
  )

  app.get(
    '/billing/:id/receipt',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.getReceipt(req.clinicId, id))
    },
  )
}
