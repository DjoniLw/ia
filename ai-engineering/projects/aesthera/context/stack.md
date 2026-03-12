# Tech Stack

## Frontend
- Framework: Next.js 15 (App Router)
- Styling: Tailwind CSS 4
- Component Library: **shadcn/ui** (Radix UI base — accessible, unstyled, fully customizable)
- State / Data Fetching: TanStack Query v5
- Forms: React Hook Form + Zod (type-safe validation)
- Tables: TanStack Table v8 (sorting, filtering, pagination)
- Charts: Recharts (integrates natively with shadcn)
- Calendar / Scheduler: **FullCalendar** (day/week/month views, drag-and-drop rescheduling)
- Icons: Lucide React
- Command Palette: cmdk (⌘K — quick search across patients, appointments, services)
- Notifications (toast): Sonner
- UI: responsive-first (desktop dashboard + mobile-friendly for receptionists on tablets)

## Frontend Design Language
- **Theme**: Light mode primary (clinics are bright environments) — dark mode optional in v2
- **Color palette**: neutral base (slate/zinc) + single accent (teal/emerald — works for health/wellness)
- **Layout**: sidebar navigation (collapsed icons on mobile, full labels on desktop) + top header
- **Density**: information-dense for staff users — they need to see many records at once
- **Typography**: clean sans-serif, clear hierarchy between headings and data

## Key UI Patterns (ERP-grade)
| Pattern | Where used |
|---------|------------|
| KPI Cards | Dashboard home (appointments today, revenue this month, pending billing) |
| Calendar grid (FullCalendar) | Appointments page — day/week view per professional |
| Data table (TanStack Table) | Customers, services, billing, ledger, notification logs |
| Side sheet / drawer | Create/edit forms (appointment, customer, service) — opens over the current page |
| Command palette (⌘K) | Quick jump to any patient, appointment, or page |
| Status badges | Appointment status, billing status — color-coded |
| Timeline | Customer profile — appointments + billing history in chronological order |
| Charts (Recharts) | Revenue by week/month, occupancy rate per professional |
| Breadcrumb | All inner pages — always shows where the user is |

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

## Integrations
- Payments: MercadoPago (PIX + boleto) · Stripe (card)
- WhatsApp: Z-API or Evolution API (HTTP REST — appointment reminders, confirmations)
- Email: Resend (transactional — receipts, password reset, verification)
- AI: Google Gemini 2.0 Flash (`@google/generative-ai`) — free tier, function calling
- AI SDK: Vercel AI SDK (`ai` package — streaming + `useChat` hook for Next.js)

## Conventions
- Language: TypeScript strict mode
- Linting: ESLint + Prettier
- Tests: Vitest
- Branch strategy: trunk-based
- Tenant key: `clinic_id` on all tables
