/**
 * Rotas que NÃO passam pelo tenantMiddleware.
 *
 * Adicione aqui toda rota que seja genuinamente pública (sem X-Clinic-Slug):
 * - Endpoints de auth baseados em e-mail ou token (sem slug da clínica ainda)
 * - Webhooks externos que não enviam X-Clinic-Slug
 * - Utilitários públicos (health, raiz)
 *
 * ⚠️  Esta é a fonte única de verdade para PUBLIC_ROUTES.
 *     Use-a em app.ts e importe-a em testes de regressão.
 */
export const PUBLIC_ROUTES = new Set([
  '/',
  '/health',
  '/auth/register',
  '/auth/verify-email',
  '/auth/refresh',
  '/auth/logout',
  '/auth/resolve-slug',       // busca clínica por e-mail — não há slug ainda
  '/auth/recover-access',
  '/auth/reset-password',
  '/auth/resend-verification',
  '/auth/resend-transfer',
  '/auth/confirm-transfer',
  '/auth/reject-transfer',
  '/payments/webhooks/stripe',      // Stripe não envia X-Clinic-Slug
  '/payments/webhooks/mercadopago', // MercadoPago não envia X-Clinic-Slug
])
