import { google } from '@ai-sdk/google'
import { generateText, stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '../../database/prisma/client'
import { redis } from '../../database/redis/client'
import { appConfig } from '../../config/app.config'

type Message = { role: 'user' | 'assistant'; content: string }

const HISTORY_TTL = 3600       // 1h
const HISTORY_MAX_MESSAGES = 20

function chatKey(clinicId: string, sessionId: string) {
  return `ai:chat:${clinicId}:${sessionId}`
}

async function getHistory(clinicId: string, sessionId: string): Promise<Message[]> {
  const raw = await redis.get(chatKey(clinicId, sessionId))
  if (!raw) return []
  try {
    return JSON.parse(raw) as Message[]
  } catch {
    return []
  }
}

async function saveHistory(clinicId: string, sessionId: string, messages: Message[]) {
  const window = messages.slice(-HISTORY_MAX_MESSAGES)
  await redis.set(chatKey(clinicId, sessionId), JSON.stringify(window), 'EX', HISTORY_TTL)
}

export class AiService {
  private getModel() {
    if (!appConfig.ai.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    return google('gemini-2.0-flash-exp')
  }

  async streamChat(
    clinicId: string,
    userMessage: string,
    sessionId: string,
    onChunk: (chunk: string) => void,
    onToolCall?: (toolName: string) => void,
  ): Promise<void> {
    const history = await getHistory(clinicId, sessionId)
    const model = this.getModel()

    const today = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const result = await streamText({
      model,
      system: `Você é a Aes, assistente inteligente da clínica estética no sistema Aesthera. 
Hoje é ${today}. Responda sempre em português do Brasil, de forma profissional e objetiva.
Você tem acesso a ferramentas para buscar informações reais da clínica quando necessário.`,
      messages: [
        ...history,
        { role: 'user', content: userMessage },
      ],
      tools: {
        get_appointments_today: tool({
          description: 'Busca os agendamentos de hoje para a clínica',
          inputSchema: z.object({}),
          execute: async () => this.getAppointmentsToday(clinicId),
        }),
        get_overdue_billing: tool({
          description: 'Busca cobranças vencidas/pendentes da clínica',
          inputSchema: z.object({ limit: z.number().default(10) }),
          execute: async ({ limit }: { limit: number }) => this.getOverdueBilling(clinicId, limit),
        }),
        get_financial_summary: tool({
          description: 'Retorna resumo financeiro da clínica (créditos, débitos, saldo)',
          inputSchema: z.object({
            from: z.string().optional().describe('Data inicial ISO (ex: 2024-01-01)'),
            to: z.string().optional().describe('Data final ISO (ex: 2024-12-31)'),
          }),
          execute: async ({ from, to }: { from?: string; to?: string }) =>
            this.getFinancialSummary(clinicId, from, to),
        }),
        search_customers: tool({
          description: 'Busca clientes da clínica por nome, email ou telefone',
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }: { query: string }) => this.searchCustomers(clinicId, query),
        }),
        get_customer_history: tool({
          description: 'Retorna histórico de agendamentos e cobranças de um cliente',
          inputSchema: z.object({ customerId: z.string().uuid() }),
          execute: async ({ customerId }: { customerId: string }) =>
            this.getCustomerHistory(clinicId, customerId),
        }),
      },
      stopWhen: stepCountIs(5),
    })

    let fullResponse = ''
    for await (const event of result.fullStream) {
      if (event.type === 'text-delta') {
        fullResponse += event.textDelta
        onChunk(event.textDelta)
      } else if (event.type === 'tool-call' && onToolCall) {
        onToolCall(event.toolName)
      }
    }

    const updated: Message[] = [
      ...history,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: fullResponse },
    ]
    await saveHistory(clinicId, sessionId, updated)
  }

  async getCustomerSummary(clinicId: string, customerId: string): Promise<string> {
    const [customer, appointments, billing] = await Promise.all([
      prisma.customer.findFirst({ where: { id: customerId, clinicId } }),
      prisma.appointment.findMany({
        where: { customerId, clinicId },
        include: {
          service: { select: { name: true } },
          professional: { select: { name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
      }),
      prisma.billing.findMany({
        where: { customerId, clinicId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    if (!customer) return 'Cliente não encontrado.'

    const model = this.getModel()
    const cacheKey = `ai:summary:customer:${clinicId}:${customerId}`
    const cached = await redis.get(cacheKey)
    if (cached) return cached

    const context = JSON.stringify({ customer, appointments, billing })
    const { text } = await generateText({
      model,
      prompt: `Gere um resumo clínico executivo do cliente a seguir em português, destacando frequência de visitas, serviços preferidos e status financeiro:\n\n${context}`,
      maxOutputTokens: 500,
    })

    await redis.set(cacheKey, text, 'EX', 600) // 10min cache
    return text
  }

  async getDailyBriefing(clinicId: string): Promise<string> {
    const cacheKey = `ai:briefing:${clinicId}`
    const cached = await redis.get(cacheKey)
    if (cached) return cached

    const model = this.getModel()
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 86400000)

    const [appointments, overdue, summary] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId, scheduledAt: { gte: startOfDay, lt: endOfDay } },
        include: {
          customer: { select: { name: true } },
          service: { select: { name: true } },
          professional: { select: { name: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.billing.count({ where: { clinicId, status: 'overdue' } }),
      prisma.ledgerEntry.aggregate({
        where: {
          clinicId,
          type: 'credit',
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
        _sum: { amount: true },
      }),
    ])

    const context = {
      date: today.toLocaleDateString('pt-BR'),
      appointments: appointments.length,
      appointmentList: appointments.map(a => ({
        time: a.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        customer: a.customer.name,
        service: a.service.name,
        professional: a.professional.name,
        status: a.status,
      })),
      overdueCount: overdue,
      revenueToday: (summary._sum.amount ?? 0) / 100,
    }

    const { text } = await generateText({
      model,
      prompt: `Gere um briefing diário executivo da clínica no seguinte contexto (em português):\n\n${JSON.stringify(context, null, 2)}\n\nSeja conciso e use marcadores.`,
      maxOutputTokens: 600,
    })

    await redis.set(cacheKey, text, 'EX', 300) // 5min cache
    return text
  }

  // ── Tool implementations ────────────────────────────────────────────────────

  private async getAppointmentsToday(clinicId: string) {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const end = new Date(start.getTime() + 86400000)

    const appointments = await prisma.appointment.findMany({
      where: { clinicId, scheduledAt: { gte: start, lt: end } },
      include: {
        customer: { select: { name: true, phone: true } },
        service: { select: { name: true } },
        professional: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    return appointments.map(a => ({
      id: a.id,
      time: a.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      customer: a.customer.name,
      phone: a.customer.phone,
      service: a.service.name,
      professional: a.professional.name,
      status: a.status,
      duration: a.durationMinutes + ' min',
    }))
  }

  private async getOverdueBilling(clinicId: string, limit: number) {
    const billing = await prisma.billing.findMany({
      where: { clinicId, status: { in: ['overdue', 'pending'] } },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        appointment: {
          include: { service: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    })

    return billing.map(b => ({
      id: b.id,
      customer: b.customer.name,
      phone: b.customer.phone,
      amount: `R$ ${(b.amount / 100).toFixed(2)}`,
      dueDate: b.dueDate?.toLocaleDateString('pt-BR'),
      status: b.status,
      service: b.appointment?.service?.name,
    }))
  }

  private async getFinancialSummary(clinicId: string, from?: string, to?: string) {
    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)

    const [credits, debits, monthRevenue] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { clinicId, type: 'credit', ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.ledgerEntry.aggregate({
        where: { clinicId, type: 'debit', ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.billing.count({ where: { clinicId, status: 'overdue' } }),
    ])

    const totalCredits = credits._sum.amount ?? 0
    const totalDebits = debits._sum.amount ?? 0

    return {
      totalCredits: `R$ ${(totalCredits / 100).toFixed(2)}`,
      totalDebits: `R$ ${(totalDebits / 100).toFixed(2)}`,
      netBalance: `R$ ${((totalCredits - totalDebits) / 100).toFixed(2)}`,
      transactions: credits._count + debits._count,
      overdueCount: monthRevenue,
    }
  }

  private async searchCustomers(clinicId: string, query: string) {
    const customers = await prisma.customer.findMany({
      where: {
        clinicId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
      take: 10,
    })
    return customers
  }

  private async getCustomerHistory(clinicId: string, customerId: string) {
    const [appointments, billing] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId, customerId },
        include: {
          service: { select: { name: true } },
          professional: { select: { name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
      }),
      prisma.billing.findMany({
        where: { clinicId, customerId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    return {
      recentAppointments: appointments.map(a => ({
        date: a.scheduledAt.toLocaleDateString('pt-BR'),
        service: a.service.name,
        professional: a.professional.name,
        status: a.status,
      })),
      recentBilling: billing.map(b => ({
        amount: `R$ ${(b.amount / 100).toFixed(2)}`,
        status: b.status,
        dueDate: b.dueDate?.toLocaleDateString('pt-BR'),
      })),
    }
  }
}

export const aiService = new AiService()
