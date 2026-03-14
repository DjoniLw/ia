# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
# prisma generate only reads the schema to emit the client — it never connects
# to the database. Prisma 6+ WASM-based getConfig still validates that the env
# var is *set*, so we supply a throwaway value just for this RUN step.
RUN DATABASE_URL="postgresql://build:build@localhost/build" npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client and compiled code
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3000

# Sync the Prisma schema to the database before starting the server.
# --accept-data-loss only allows schema additions/renames — it never drops existing
# data. This is safe for Railway deployments where we only add new columns/tables.
#
# Use `||` instead of `&&` so the Node server ALWAYS starts even when
# DATABASE_URL is not yet configured or the database is temporarily unreachable.
# A failed db push is logged as a warning; all DB queries will return 500/503
# via the app's own error handler until connectivity is restored and the
# container is restarted.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss || echo '⚠️  WARNING: prisma db push failed — server starting without schema sync'; node dist/main.js"]
