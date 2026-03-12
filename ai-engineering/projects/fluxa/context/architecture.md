# Architecture

## Pattern
[Modular Monolith]

## Folder Structure
```
src/
├── modules/
│
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.dto.ts
│   │   └── auth.test.ts
│
│   ├── companies/
│   │   ├── companies.controller.ts
│   │   ├── companies.service.ts
│   │   ├── companies.repository.ts
│   │   ├── companies.dto.ts
│   │   └── companies.test.ts
│
│   ├── customers/
│   │   ├── customers.controller.ts
│   │   ├── customers.service.ts
│   │   ├── customers.repository.ts
│   │   ├── customers.dto.ts
│   │   └── customers.test.ts
│
│   ├── invoices/
│   │   ├── invoices.controller.ts
│   │   ├── invoices.service.ts
│   │   ├── invoices.repository.ts
│   │   ├── invoices.entity.ts
│   │   ├── invoices.dto.ts
│   │   └── invoices.test.ts
│
│   ├── payments/
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   ├── payments.repository.ts
│   │   ├── payments.dto.ts
│   │   └── payments.test.ts
│
│   ├── notifications/
│   │   ├── notifications.service.ts
│   │   ├── email.provider.ts
│   │   ├── webhook.provider.ts
│   │   └── notifications.test.ts
│
│   ├── integrations/
│   │   ├── stripe/
│   │   │   └── stripe.service.ts
│   │   └── mercadopago/
│   │       └── mercadopago.service.ts
│   │
│   └── ledger/
│       ├── ledger.service.ts
│       ├── ledger.repository.ts
│       └── ledger-entry.entity.ts
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
Request
 ↓
Controller          (validate input via Zod, apply guard)
 ↓
Service             (business rules, emit domain events)
 ↓ ┌──────────────────────────────────┐
   │ if external call needed:         │
   │ integrations/stripe.service.ts   │
   │ integrations/mercadopago.service │
   └──────────────────────────────────┘
 ↓
Repository          (Prisma — always filter by company_id)
 ↓
Database

## Payment Flow
empresa cria cobrança
        ↓
invoice criada
        ↓
link de pagamento
        ↓
cliente paga
        ↓
gateway envia webhook
        ↓
payments module processa
        ↓
invoice atualizada
        ↓
empresa notificada

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Language | TypeScript | Type safety e melhor integração com Node |
| Runtime | Node.js | Ecossistema forte para APIs |
| Framework | Fastify | Mais rápido que Express |
| ORM | Prisma | Type-safe queries e migrations |
| Database | PostgreSQL | Confiável para sistemas financeiros |
| Auth | JWT + Refresh Token | Stateless e escalável |
| Validation | Zod | Validação forte e type-safe |
| Architecture | Modular Monolith | Simples de evoluir e manter |
| Multi-tenancy | company_id em todas tabelas | Separação de dados entre empresas |
| Event System | Domain Events | Permite automação e escalabilidade |
| Queue | BullMQ + Redis | Processamento assíncrono |
| Payments | Gateway Integration | Evita lidar diretamente com dinheiro |
| Idempotency | Idempotency Keys | Evitar cobrança duplicada |
| Logging | Pino | Logging estruturado e rápido |
| Error Handling | Centralized Error Middleware | Padronização de erros |
| API Style | REST | Simples para integração |
| Testing | Vitest | Testes rápidos e simples |
| Rate Limiting | Fastify Rate Limit | Proteção da API |

## External Services
| Service | Purpose | v1 |
|---------|---------|-----|
| Stripe | Card payments | ✅ |
| MercadoPago | PIX + Boleto | ✅ |
| Resend | Transactional email | ✅ |
| Twilio / WhatsApp API | Notifications via WhatsApp | ❌ v2 |

## Security Baseline
- DTO validation (Zod)
- Guards on all authenticated routes
- company_id filter on every DB query (multi-tenancy)
- Webhook signature verification before processing
- Secrets via environment variables only
