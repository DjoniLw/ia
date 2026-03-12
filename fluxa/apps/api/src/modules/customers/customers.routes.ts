import { FastifyInstance } from 'fastify'
import { customersController } from './customers.controller'
import { jwtGuard } from '../../shared/guards/jwt.guard'
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersDto } from './customers.dto'

export async function customersRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateCustomerDto }>('/customers', { onRequest: jwtGuard }, async (request, reply) => {
    const validated = CreateCustomerDto.parse(request.body)
    request.body = validated
    await customersController.create(request, reply)
  })

  app.get<{ Querystring: ListCustomersDto }>('/customers', { onRequest: jwtGuard }, async (request, reply) => {
    const validated = ListCustomersDto.parse(request.query)
    request.query = validated
    await customersController.list(request, reply)
  })

  app.get<{ Params: { id: string } }>('/customers/:id', { onRequest: jwtGuard }, async (request, reply) => {
    await customersController.getById(request, reply)
  })

  app.patch<{ Params: { id: string }; Body: UpdateCustomerDto }>(
    '/customers/:id',
    { onRequest: jwtGuard },
    async (request, reply) => {
      const validated = UpdateCustomerDto.parse(request.body)
      request.body = validated
      await customersController.update(request, reply)
    },
  )

  app.delete<{ Params: { id: string } }>('/customers/:id', { onRequest: jwtGuard }, async (request, reply) => {
    await customersController.delete(request, reply)
  })

  app.get<{ Querystring: { q: string } }>('/customers/search', { onRequest: jwtGuard }, async (request, reply) => {
    await customersController.search(request, reply)
  })
}
