import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './customers.dto'
import { CustomersService } from './customers.service'
import { prisma } from '../../database/prisma/client'

export async function customersRoutes(app: FastifyInstance) {
  const svc = new CustomersService()

  // ── Static routes FIRST ───────────────────────────────────────────────────

  app.get('/customers', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListCustomersQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.post('/customers', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const dto = CreateCustomerDto.parse(req.body)
    return reply.status(201).send(await svc.create(req.clinicId, dto))
  })

  /**
   * GET /customers/birthdays?days=7
   * Returns customers whose birthday falls within the next `days` days (default 7).
   * Birthday is compared using month+day only (ignoring year).
   */
  app.get('/customers/birthdays', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(30).default(7) }).parse(req.query)
    const clinicId = req.clinicId

    // Fetch all non-deleted customers with a birthDate
    const customers = await prisma.customer.findMany({
      where: { clinicId, deletedAt: null, birthDate: { not: null } },
      select: { id: true, name: true, phone: true, email: true, birthDate: true },
    })

    const today = new Date()
    const todayMMDD = today.getMonth() * 100 + today.getDate()

    // Pre-compute set of month*100+day values in the window — avoids recreating Date objects per customer
    const targetMMDDs = new Set<number>()
    for (let d = 0; d <= days; d++) {
      const check = new Date(today)
      check.setDate(today.getDate() + d)
      targetMMDDs.add(check.getMonth() * 100 + check.getDate())
    }

    const upcoming = customers
      .filter((c) => {
        const bd = new Date(c.birthDate!)
        return targetMMDDs.has(bd.getMonth() * 100 + bd.getDate())
      })
      .map((c) => {
        const bd = new Date(c.birthDate!)
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          birthDate: c.birthDate,
          age: today.getFullYear() - bd.getFullYear(),
          isToday: bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate(),
        }
      })
      .sort((a, b) => {
        // Sort: today first, then by upcoming day
        if (a.isToday && !b.isToday) return -1
        if (!a.isToday && b.isToday) return 1
        const aBd = new Date(a.birthDate!)
        const bBd = new Date(b.birthDate!)
        const aDays = ((aBd.getMonth() * 100 + aBd.getDate()) - todayMMDD + 10000) % 10000
        const bDays = ((bBd.getMonth() * 100 + bBd.getDate()) - todayMMDD + 10000) % 10000
        return aDays - bDays
      })

    return reply.send({ items: upcoming, total: upcoming.length })
  })

  /**
   * GET /customers/:id/history
   * Returns appointments + product sales for this customer
   */
  app.get('/customers/:id/history', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const clinicId = req.clinicId

    const [appointments, sales] = await Promise.all([
      prisma.appointment.findMany({
        where: { customerId: id, clinicId },
        include: {
          service: { select: { id: true, name: true, price: true } },
          professional: { select: { id: true, name: true } },
          billing: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      }),
      prisma.productSale.findMany({
        where: { customerId: id, clinicId },
        include: {
          product: { select: { id: true, name: true, unit: true, category: true } },
        },
        orderBy: { soldAt: 'desc' },
        take: 50,
      }),
    ])

    return reply.send({ appointments, sales })
  })

  // ── Parameterized routes AFTER static ones ────────────────────────────────

  app.get('/customers/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
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
