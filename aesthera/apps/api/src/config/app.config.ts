import { env } from './env'

export const appConfig = {
  env: env.NODE_ENV,
  port: env.PORT,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  db: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
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
  },
} as const
