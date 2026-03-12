# Tech Stack

## Frontend
- Framework: Next.js 15
- Styling: Tailwind CSS 4
- State: TanStack Query v5

## Backend
- Runtime: Node.js 22
- Framework: Fastify 5
- Auth: JWT + Refresh Token (`@fastify/jwt`)
- Validation: Zod 3
- Queue: BullMQ 5
- Logging: Pino (built-in Fastify)

## Database
- Primary: PostgreSQL 16
- Cache: Redis 7
- ORM: Prisma 6

## Infrastructure
- Hosting: Railway (MVP) → AWS (scale)
- CI/CD: GitHub Actions
- Containers: Docker

## Conventions
- Language: TypeScript strict mode
- Linting: ESLint + Prettier
- Tests: Vitest
- Branch strategy: trunk-based
