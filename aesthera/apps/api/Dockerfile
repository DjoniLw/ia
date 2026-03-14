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

# Start the server directly.  Schema migration (prisma db push) is handled
# non-blocking inside main.ts AFTER the HTTP port is bound, so Railway's
# health check always sees a live server.
CMD ["node", "dist/main.js"]
