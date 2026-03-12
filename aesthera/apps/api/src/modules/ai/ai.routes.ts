import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { aiService } from './ai.service'

const ChatBody = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().default(() => crypto.randomUUID()),
})

export async function aiRoutes(app: FastifyInstance) {
  // ── Streaming chat (SSE) ───────────────────────────────────────────────────
  app.post(
    '/ai/chat',
    { preHandler: [jwtClinicGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { message, sessionId } = ChatBody.parse(req.body)
      const clinicId = req.clinicId

      reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Session-Id', sessionId)
      reply.raw.flushHeaders()

      try {
        await aiService.streamChat(clinicId, message, sessionId, (chunk) => {
          reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`)
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI error'
        reply.raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
      } finally {
        reply.raw.write('data: [DONE]\n\n')
        reply.raw.end()
      }

      return reply
    },
  )

  // ── Customer summary ───────────────────────────────────────────────────────
  app.post(
    '/ai/summary/customer/:customerId',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { customerId } = req.params as { customerId: string }
      const summary = await aiService.getCustomerSummary(req.clinicId, customerId)
      return reply.send({ summary })
    },
  )

  // ── Daily briefing ─────────────────────────────────────────────────────────
  app.post('/ai/briefing', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const briefing = await aiService.getDailyBriefing(req.clinicId)
    return reply.send({ briefing })
  })
}
