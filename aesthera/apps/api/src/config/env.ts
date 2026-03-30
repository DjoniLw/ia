import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

// ── Fallback secret (used when JWT_SECRET is not set) ──────────────────────
// Generated fresh on every cold start — tokens will be invalidated on restart.
// Always set JWT_SECRET explicitly in production via Railway environment variables.
// NOTE: Refresh tokens are opaque tokens managed via Redis (NOT JWT-signed).
// Therefore, JWT_REFRESH_SECRET is not needed and does not exist in this project.
const _fallbackJwtSecret = randomBytes(64).toString('hex')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // DATABASE_URL falls back to a local placeholder so the process does not
  // crash at startup before the HTTP server binds.  All database operations
  // will fail gracefully until a real URL is provided via Railway variables.
  DATABASE_URL: z
    .string()
    .min(1)
    .default(
      'postgresql://PLACEHOLDER_SET_DATABASE_URL_IN_RAILWAY:unconfigured@localhost:5432/aesthera',
    ),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32).default(_fallbackJwtSecret),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@aesthera.com.br'),

  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  // Integração Assinafy via n8n
  N8N_CONTRACTS_WEBHOOK_URL: z.string().url().optional(),
  CONTRACTS_WEBHOOK_SECRET: z.string().optional(),

  // Allowed origin(s) for CORS. Comma-separated list, or '*' for all origins.
  // Example: https://app.aesthera.com,https://aesthera-web.up.railway.app
  // Defaults to '*' so the web frontend can reach the API out of the box.
  CORS_ORIGIN: z.string().default('*'),

  // Base URL of the web frontend, used to build e-mail links (e.g. email verification).
  // Example: https://app.aesthera.com
  FRONTEND_URL: z.string().default('http://localhost:3001'),

  // Defina AMBIENTE_DEV=S no Railway para indicar que o serviço é homologação/dev.
  // Quando ausente ou diferente de 'S', o sistema considera ambiente de produção.
  AMBIENTE_DEV: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }

  const data = result.data

  // Warn loudly whenever falling back to placeholder/auto-generated values so
  // operators know the service is running in a degraded / insecure state.
  if (!process.env.DATABASE_URL) {
    console.warn(
      '⚠️  DATABASE_URL is not set — the service will start but all database operations will fail.',
    )
    console.warn(
      '   Add a PostgreSQL service in Railway and link DATABASE_URL to fix this.',
    )
  }

  if (!process.env.JWT_SECRET) {
    console.warn(
      '⚠️  JWT_SECRET is not set — using a random ephemeral secret.',
    )
    console.warn(
      '   ⛔ INSECURE: All issued tokens will be invalidated on every restart.',
    )
    console.warn(
      '   Set JWT_SECRET in Railway environment variables to fix this.',
    )
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      '⚠️  RESEND_API_KEY is not set — email sending is DISABLED.',
    )
    console.warn(
      '   Users will NOT receive verification emails or any other notifications.',
    )
    console.warn(
      '   1. Create a free account at https://resend.com',
    )
    console.warn(
      '   2. Generate an API key and add RESEND_API_KEY to your Railway environment variables.',
    )
    console.warn(
      '   3. Verify your sending domain (or use the sandbox address) in the Resend dashboard.',
    )
  }

  return data
}

export const env = loadEnv()
