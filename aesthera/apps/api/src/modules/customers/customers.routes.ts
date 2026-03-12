import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './customers.dto'
import { CustomersService } from './customers.service'

export async function customersRoutes(app: FastifyInstance) {
  const svc = new CustomersService()

  app.get('/customers', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListCustomersQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.get('/customers/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.post('/customers', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const dto = CreateCustomerDto.parse(req.body)
    return reply.status(201).send(await svc.create(req.clinicId, dto))
  })

  app.patch('/customers/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const dto = UpdateCustomerDto.parse(req.body)
    return reply.send(await svc.update(req.clinicId, id, dto))
  })

  app.delete('/customers/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.delete(req.clinicId, id))
  })
}
