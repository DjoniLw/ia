FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# Build
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run db:generate
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/main.js"]
