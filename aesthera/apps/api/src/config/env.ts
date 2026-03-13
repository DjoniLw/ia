import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

// ── Fallback secrets (used when JWT_SECRET / JWT_REFRESH_SECRET are not set) ──
// These are generated fresh on every cold start, so tokens issued without
// explicit secrets will be invalidated on restart.  Always set explicit secrets
// in production via Railway environment variables.
const _fallbackJwtSecret = randomBytes(64).toString('hex')
const _fallbackJwtRefreshSecret = randomBytes(64).toString('hex')

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
  JWT_REFRESH_SECRET: z.string().min(32).default(_fallbackJwtRefreshSecret),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@aesthera.com.br'),

  ZAPI_INSTANCE_ID: z.string().optional(),
  ZAPI_TOKEN: z.string().optional(),
  ZAPI_CLIENT_TOKEN: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),

  // Allowed origin(s) for CORS. Comma-separated list, or '*' for all origins.
  // Example: https://app.aesthera.com,https://aesthera-web.up.railway.app
  // Defaults to '*' so the web frontend can reach the API out of the box.
  CORS_ORIGIN: z.string().default('*'),
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

  if (!process.env.JWT_REFRESH_SECRET) {
    console.warn(
      '⚠️  JWT_REFRESH_SECRET is not set — using a random ephemeral secret.',
    )
    console.warn(
      '   ⛔ INSECURE: All issued refresh tokens will be invalidated on every restart.',
    )
    console.warn(
      '   Set JWT_REFRESH_SECRET in Railway environment variables to fix this.',
    )
  }

  return data
}

export const env = loadEnv()
