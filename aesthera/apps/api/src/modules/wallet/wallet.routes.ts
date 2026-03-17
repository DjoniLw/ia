import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { AdjustWalletEntryDto, CreateWalletEntryDto, ListWalletQuery } from './wallet.dto'
import { WalletService } from './wallet.service'

export async function walletRoutes(app: FastifyInstance) {
  const svc = new WalletService()

  app.get('/wallet', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListWalletQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.get('/wallet/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.post(
    '/wallet',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateWalletEntryDto.parse(req.body)
      return reply.status(201).send(await svc.create(req.clinicId, dto))
    },
  )

  app.patch(
    '/wallet/:id/adjust',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = AdjustWalletEntryDto.parse(req.body)
      return reply.send(await svc.adjust(req.clinicId, id, dto))
    },
  )
}
