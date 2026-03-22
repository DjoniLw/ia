import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { LedgerSummaryQuery, ListLedgerQuery } from './ledger.dto'
import { LedgerService } from './ledger.service'

export async function ledgerRoutes(app: FastifyInstance) {
  const svc = new LedgerService()

  app.get('/ledger', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, async (req, reply) => {
    const q = ListLedgerQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.get('/ledger/summary', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, async (req, reply) => {
    const q = LedgerSummaryQuery.parse(req.query)
    return reply.send(await svc.summary(req.clinicId, q))
  })

  app.get('/ledger/:id', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })
}
