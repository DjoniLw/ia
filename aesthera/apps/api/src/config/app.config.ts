import { env } from './env'

export const appConfig = {
  env: env.NODE_ENV,
  port: env.PORT,
  // isProduction = false apenas quando AMBIENTE_DEV=S está definida (homologação/dev no Railway).
  // Sem a variável (padrão), o sistema opera como produção.
  isProduction: env.AMBIENTE_DEV?.toUpperCase() !== 'S',
  isTest: env.NODE_ENV === 'test',

  db: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    // refreshSecret removido: refresh tokens são opacos (hash SHA-256 no Redis), não JWT assinados
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  mercadopago: {
    accessToken: env.MP_ACCESS_TOKEN,
    webhookSecret: env.MP_WEBHOOK_SECRET,
  },

  email: {
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  },

  whatsapp: {
    instanceId: env.ZAPI_INSTANCE_ID,
    token: env.ZAPI_TOKEN,
    clientToken: env.ZAPI_CLIENT_TOKEN,
  },

  ai: {
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
  },

  cors: {
    // '*' means allow all origins. Set CORS_ORIGIN env var to lock it down.
    origin:
      env.CORS_ORIGIN === '*'
        ? true
        : env.CORS_ORIGIN
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
  },

  frontendUrl: env.FRONTEND_URL,
} as const
