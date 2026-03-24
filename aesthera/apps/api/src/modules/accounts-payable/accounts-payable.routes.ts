import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreateAccountsPayableDto,
  ListAccountsPayableQuery,
  PayAccountsPayableDto,
  UpdateAccountsPayableDto,
} from './accounts-payable.dto'
import { AccountsPayableService } from './accounts-payable.service'

export async function accountsPayableRoutes(app: FastifyInstance) {
  const svc = new AccountsPayableService()

  app.get(
    '/accounts-payable',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const q = ListAccountsPayableQuery.parse(req.query)
      return reply.send(await svc.list(req.clinicId, q))
    },
  )

  app.get(
    '/accounts-payable/summary',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      return reply.send(await svc.getSummary(req.clinicId))
    },
  )

  app.get(
    '/accounts-payable/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.get(req.clinicId, id))
    },
  )

  app.post(
    '/accounts-payable',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateAccountsPayableDto.parse(req.body)
      return reply.status(201).send(await svc.create(req.clinicId, dto))
    },
  )

  app.patch(
    '/accounts-payable/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateAccountsPayableDto.parse(req.body)
      return reply.send(await svc.update(req.clinicId, id, dto))
    },
  )

  app.post(
    '/accounts-payable/:id/pay',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = PayAccountsPayableDto.parse(req.body)
      return reply.send(await svc.pay(req.clinicId, id, dto))
    },
  )

  app.post(
    '/accounts-payable/:id/cancel',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.cancel(req.clinicId, id))
    },
  )

  // Internal cron endpoint
  app.post(
    '/accounts-payable/cron/overdue',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (_req, reply) => {
      return reply.send(await svc.runOverdueCron())
    },
  )
}
