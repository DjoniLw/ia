import { FastifyInstance } from 'fastify'
import { invoicesController } from './invoices.controller'
import { jwtGuard } from '../../shared/guards/jwt.guard'
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  CancelInvoiceDto,
  MarkAsPaidDto,
} from './invoices.dto'

export async function invoicesRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateInvoiceDto }>('/invoices', { onRequest: jwtGuard }, async (request, reply) => {
    const validated = CreateInvoiceDto.parse(request.body)
    request.body = validated
    await invoicesController.create(request, reply)
  })

  app.get<{ Querystring: ListInvoicesDto }>('/invoices', { onRequest: jwtGuard }, async (request, reply) => {
    const validated = ListInvoicesDto.parse(request.query)
    request.query = validated
    await invoicesController.list(request, reply)
  })

  app.get<{ Params: { id: string } }>('/invoices/:id', { onRequest: jwtGuard }, async (request, reply) => {
    await invoicesController.getById(request, reply)
  })

  app.post<{ Params: { id: string } }>('/invoices/:id/send-to-payment', { onRequest: jwtGuard }, async (request, reply) => {
    await invoicesController.sendToPayment(request, reply)
  })

  app.post<{ Params: { id: string }; Body: CancelInvoiceDto }>(
    '/invoices/:id/cancel',
    { onRequest: jwtGuard },
    async (request, reply) => {
      const validated = CancelInvoiceDto.parse(request.body)
      request.body = validated
      await invoicesController.cancel(request, reply)
    },
  )

  app.post<{ Params: { id: string }; Body: MarkAsPaidDto }>(
    '/invoices/:id/mark-as-paid',
    { onRequest: jwtGuard },
    async (request, reply) => {
      const validated = MarkAsPaidDto.parse(request.body)
      request.body = validated
      await invoicesController.markAsPaid(request, reply)
    },
  )
}
