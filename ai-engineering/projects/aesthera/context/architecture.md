# Architecture

## Pattern
Modular Monolith → Microservices (future, per vertical)

## Tenant Key
`clinic_id` — present on every table. Every DB query must filter by `clinic_id`.
Data never leaks between tenants.

## Folder Structure
```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.dto.ts
│   │   └── auth.test.ts
│
│   ├── clinics/              -- tenant management
│   │   ├── clinics.controller.ts
│   │   ├── clinics.service.ts
│   │   ├── clinics.repository.ts
│   │   ├── clinics.dto.ts
│   │   └── clinics.test.ts
│
│   ├── professionals/
│   │   ├── professionals.controller.ts
│   │   ├── professionals.service.ts
│   │   ├── professionals.repository.ts
│   │   ├── professionals.dto.ts
│   │   └── professionals.test.ts
│
│   ├── services/             -- service catalog
│   │   ├── services.controller.ts
│   │   ├── services.service.ts
│   │   ├── services.repository.ts
│   │   ├── services.dto.ts
│   │   └── services.test.ts
│
│   ├── customers/
│   │   ├── customers.controller.ts
│   │   ├── customers.service.ts
│   │   ├── customers.repository.ts
│   │   ├── customers.dto.ts
│   │   └── customers.test.ts
│
│   ├── appointments/
│   │   ├── appointments.controller.ts
│   │   ├── appointments.service.ts
│   │   ├── appointments.repository.ts
│   │   ├── appointments.entity.ts   -- state machine
│   │   ├── appointments.dto.ts
│   │   └── appointments.test.ts
│
│   ├── billing/
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   ├── billing.repository.ts
│   │   ├── billing.dto.ts
│   │   └── billing.test.ts
│
│   ├── payments/
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   ├── payments.repository.ts
│   │   ├── payments.dto.ts
│   │   └── payments.test.ts
│
│   ├── users/                -- clinic staff (admin, staff roles)
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   ├── users.dto.ts
│   │   └── users.test.ts
│
│   ├── notifications/
│   │   ├── notifications.service.ts
│   │   ├── whatsapp.provider.ts
│   │   ├── email.provider.ts
│   │   └── notifications.test.ts
│
│   ├── ledger/
│   │   ├── ledger.service.ts
│   │   ├── ledger.repository.ts
│   │   └── ledger-entry.entity.ts
│
│   ├── ai/                   -- AI assistant (Phase 8)
│   │   ├── ai.controller.ts
│   │   ├── ai.service.ts
│   │   ├── ai.tools.ts       -- function calling tool definitions
│   │   └── ai.test.ts
│
│   └── integrations/
│       ├── stripe/
│       │   └── stripe.service.ts
│       ├── mercadopago/
│       │   └── mercadopago.service.ts
│       ├── whatsapp/
│       │   └── whatsapp.service.ts   -- Z-API / Evolution API HTTP client
│       ├── resend/
│       │   └── resend.service.ts
│       └── gemini/
│           └── gemini.service.ts     -- Google Gemini 2.0 Flash client
│
├── shared/
│   ├── middleware/
│   ├── guards/
│   ├── errors/
│   ├── utils/
│   ├── logger/
│   └── events/
│       ├── event-bus.ts
│       └── domain-event.ts
│
├── database/
│   ├── prisma/
│   └── migrations/
│
├── config/
│   ├── env.ts
│   └── app.config.ts
│
└── main.ts
```

## Data Flow
Request (from clinicaana.aesthera.com.br)
 ↓
Tenant Middleware    (X-Clinic-Slug header → slug → clinic_id via Redis/DB)
 ↓
Controller          (validate input via Zod, apply guard)
 ↓
Service             (business rules, availability check, emit domain events)
 ↓ ┌──────────────────────────────────────┐
   │ if external call needed:             │
   │ integrations/stripe.service.ts       │
   │ integrations/mercadopago.service.ts  │
   │ integrations/whatsapp.service.ts     │
   └──────────────────────────────────────┘
 ↓
Repository          (Prisma — always filter by clinic_id)
 ↓
Database

## Appointment + Billing Flow
clinic books appointment
        ↓
appointment.created → WhatsApp confirmation sent
        ↓
D-1 reminder (BullMQ scheduled job)
        ↓
appointment marked as completed
        ↓
appointment.completed event
        ↓
billing record auto-created
        ↓
payment link sent to customer (WhatsApp + email)
        ↓
gateway webhook → payment confirmed
        ↓
billing updated → ledger entry created
        ↓
clinic notified

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Language | TypeScript | Type safety |
| Framework | Fastify | Performance |
| ORM | Prisma | Type-safe queries |
| Database | PostgreSQL | Reliable for transactional data |
| Auth | JWT + Refresh Token | Stateless, scalable |
| Validation | Zod | Schema-first, type-safe |
| Architecture | Modular Monolith | Simple to evolve, add verticals |
| Multi-tenancy | clinic_id on all tables | Tenant isolation |
| Tenant Resolution | Subdomain slug → clinic_id via middleware + Redis cache | Zero auth-before-tenant lookup |
| Event System | Domain Events | Decoupled modules |
| Queue | BullMQ + Redis | Async: reminders, notifications |
| WhatsApp | Z-API / Evolution API | MVP-friendly, no Meta approval |
| Scheduling | DB-based slots | Simple for MVP |
| Payments | MercadoPago + Stripe | PIX/boleto + card |
| Idempotency | Idempotency Keys | Prevent duplicate charges |
| Ledger | Append-only entries | Financial auditability |
| Testing | Vitest | Fast, simple |

## Guards
| Guard | Checks | Applied to |
|-------|--------|------------|
| `JwtClinicGuard` | Valid JWT, role in (admin, staff), clinic active | All dashboard routes |
| `RoleGuard(admin)` | Additionally checks role = admin | Financial, settings, user management routes |
| `JwtProfessionalGuard` | Valid JWT, role = professional, same clinic | Professional portal |
| `ApiKeyGuard` | Valid key hash, clinic active | Integration routes |
| `JwtAdminGuard` | Valid JWT, role = platform_admin | Platform admin routes |

## Security Baseline
- Zod validation on all inputs
- `clinic_id` filter on every DB query
- Webhook signature verification before processing
- Secrets via environment variables only
- No sensitive data in logs (no CPF raw, no card data, no API keys)
