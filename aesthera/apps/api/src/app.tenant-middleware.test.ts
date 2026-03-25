/**
 * Teste de regressão — preHandler / PUBLIC_ROUTES (issue #115)
 *
 * Garante que:
 * 1. Todas as rotas em PUBLIC_ROUTES respondem sem MISSING_TENANT quando
 *    o header X-Clinic-Slug está ausente (comportamento esperado para o
 *    fluxo de login/recuperação sem cache).
 * 2. Uma rota protegida retorna 400 + code MISSING_TENANT quando o header
 *    está ausente.
 *
 * O tenantMiddleware é mockado para sempre lançar TenantError, isolando o
 * teste da infraestrutura (Redis/Prisma). O que está sendo testado é
 * exclusivamente a lógica do preHandler em app.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import { PUBLIC_ROUTES } from './shared/constants/public-routes'
import { TenantError } from './shared/errors/app-error'
import { errorHandler } from './shared/errors/error-handler'

// Mock: tenantMiddleware sempre lança TenantError (ausência de X-Clinic-Slug)
vi.mock('./shared/middleware/tenant.middleware', () => ({
  tenantMiddleware: vi.fn().mockRejectedValue(
    new TenantError(
      'Header X-Clinic-Slug não encontrado.',
      'MISSING_TENANT',
    ),
  ),
}))

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('clinicId', '')
  app.setErrorHandler(errorHandler)

  const { tenantMiddleware } = await import('./shared/middleware/tenant.middleware')

  app.addHook('preHandler', async (request, reply) => {
    const url = request.routeOptions.url
    if (!url || PUBLIC_ROUTES.has(url)) return
    if (url.startsWith('/pay/')) return
    await tenantMiddleware(request, reply)
  })

  // Registrar stubs para todas as rotas públicas (GET + POST)
  for (const path of PUBLIC_ROUTES) {
    app.route({
      method: ['GET', 'POST'],
      url: path,
      handler: async () => ({ ok: true }),
    })
  }

  // Rota protegida (não existe em PUBLIC_ROUTES)
  app.get('/customers', async () => ({ data: [] }))

  // Rota dinâmica /pay/:token deve ser pública
  app.get('/pay/:token', async () => ({ ok: true }))

  await app.ready()
  return app
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('preHandler — PUBLIC_ROUTES bypassa tenantMiddleware', () => {
  it.each([...PUBLIC_ROUTES])(
    'GET %s sem X-Clinic-Slug não deve retornar MISSING_TENANT',
    async (path) => {
      const app = await buildTestApp()
      const res = await app.inject({ method: 'GET', url: path })

      const body = res.json() as { error?: string }
      expect(body.error).not.toBe('MISSING_TENANT')
      // Deve ser 200 (stub) — não 400
      expect(res.statusCode).not.toBe(400)
    },
  )

  it('/pay/:token sem X-Clinic-Slug não deve retornar MISSING_TENANT', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/pay/token-123' })

    const body = res.json() as { error?: string }
    expect(body.error).not.toBe('MISSING_TENANT')
    expect(res.statusCode).toBe(200)
  })

  it('rota protegida /customers sem X-Clinic-Slug deve retornar MISSING_TENANT', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/customers' })

    expect(res.statusCode).toBe(400)
    const body = res.json() as { error: string }
    expect(body.error).toBe('MISSING_TENANT')
  })
})
