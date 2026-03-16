import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { CreateProductDto, CreateSaleDto, ListProductsQuery, ListSalesQuery, UpdateProductDto } from './products.dto'
import { ProductsService } from './products.service'

export async function productsRoutes(app: FastifyInstance) {
  const svc = new ProductsService()

  // ── Static routes FIRST (before :id param routes) ─────────────────────────

  app.get('/products', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListProductsQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.post('/products', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, async (req, reply) => {
    const dto = CreateProductDto.parse(req.body)
    return reply.status(201).send(await svc.create(req.clinicId, dto))
  })

  // Must be registered BEFORE /products/:id to avoid Fastify matching "sales"/"sell" as :id
  app.get('/products/sales', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListSalesQuery.parse(req.query)
    return reply.send(await svc.listSales(req.clinicId, q))
  })

  app.post('/products/sell', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const dto = CreateSaleDto.parse(req.body)
    return reply.status(201).send(await svc.sell(req.clinicId, dto))
  })

  // ── Parameterized routes AFTER static ones ────────────────────────────────

  app.get('/products/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.patch('/products/:id', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const dto = UpdateProductDto.parse(req.body)
    return reply.send(await svc.update(req.clinicId, id, dto))
  })

  app.delete('/products/:id', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.delete(req.clinicId, id))
  })
}
