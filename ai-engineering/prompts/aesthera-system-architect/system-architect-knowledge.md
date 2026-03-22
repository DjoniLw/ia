# Base de Conhecimento Técnica — Aesthera System Architect

> Este arquivo é mantido automaticamente pelo agente `aesthera-system-architect`.
> Lido obrigatoriamente no início de toda sessão.
> Atualizado sempre que uma decisão de arquitetura for tomada, um schema for alterado, um padrão for estabelecido ou um trade-off for resolvido.

---

## Estado Técnico do Sistema (atualizado em: 22/03/2026)

**Fase atual: MVP concluído.** Schema Prisma definitivo. Todos os módulos core implementados.

---

## Stack Definitiva

| Camada | Tecnologia | Versão / Detalhe |
|--------|-----------|------------------|
| Runtime | Node.js | 22 |
| Framework API | Fastify | 5 |
| Linguagem | TypeScript | strict mode |
| ORM | Prisma | 6 |
| Banco primário | PostgreSQL | 16 |
| Cache / Filas | Redis | 7 |
| Fila de jobs | BullMQ | 5 |
| Validação | Zod | 3 |
| Testes | Vitest | — |
| Framework frontend | Next.js | 15 (App Router) |
| Styling | Tailwind CSS | 4 |
| Componentes | shadcn/ui (Radix UI base) | — |
| Data fetching | TanStack Query | v5 |
| Formulários | React Hook Form + Zod | — |
| Tabelas | TanStack Table | v8 |
| Calendário | FullCalendar | dia/semana, drag-and-drop |
| Ícones | Lucide React | — |
| Toast | Sonner | — |
| IA | Google Gemini 2.0 Flash + Vercel AI SDK | streaming SSE |
| Infra | Railway (MVP) | → AWS no scale |

---

## Enums do Schema (estado atual)

```
ClinicStatus:       active | suspended | cancelled
ClinicPlan:         trial | starter | pro | enterprise
UserRole:           admin | staff
TransferStatus:     pending | confirmed | rejected | expired
TransferKind:       clinic_registration | user_invite
AppointmentStatus:  draft | confirmed | in_progress | completed | cancelled | no_show
BillingStatus:      pending | paid | overdue | cancelled
PaymentGateway:     stripe | mercadopago
PaymentMethod:      pix | boleto | card
PaymentStatus:      pending | paid | failed | expired | refunded | disputed
LedgerEntryType:    credit | debit
WalletEntryType:    VOUCHER | CREDIT | CASHBACK | PACKAGE
WalletEntryStatus:  ACTIVE | USED | EXPIRED
WalletOriginType:   OVERPAYMENT | GIFT | REFUND | CASHBACK_PROMOTION | PACKAGE_PURCHASE | VOUCHER_SPLIT
WalletTransactionType: CREATE | USE | SPLIT | ADJUST
NotificationType:   whatsapp | email
NotificationStatus: pending | sent | failed
RecurrenceType:     none | daily | weekly
PromotionDiscountType: PERCENTAGE | FIXED
PromotionStatus:    active | inactive | expired
```

---

## Tabelas do Banco de Dados

| Tabela | Modelo Prisma | Notas-chave |
|--------|--------------|-------------|
| `clinics` | `Clinic` | Entidade central. `slug` único = subdomínio. `settings` JSON. `document` = CNPJ. |
| `clinic_auth` | `ClinicAuth` | 1:1 com Clinic. `failedAttempts` + `lockedUntil` para brute-force. |
| `business_hours` | `BusinessHour` | `dayOfWeek` 0–6. `openTime/closeTime` = HH:MM string. Unique `[clinicId, dayOfWeek]`. |
| `payment_method_configs` | `PaymentMethodConfig` | 1:1 com Clinic. Parcelamento e duplicata configuráveis. |
| `api_keys` | `ApiKey` | `keyHash` (hash da chave). `keyPrefix` = 8 primeiros chars para exibição. |
| `users` | `User` | `role`: admin/staff. `screenPermissions: String[]`. `passwordHash` nulo até aceitar convite. |
| `transfer_tokens` | `TransferToken` | Convite de usuário e registro de clínica. `kind` diferencia os dois. |
| `professionals` | `Professional` | `allServices` bool: quando true, atende todos os serviços automaticamente. Soft-delete. |
| `professional_auth` | `ProfessionalAuth` | Auth separado do User. Brute-force protection. |
| `professional_working_hours` | `ProfessionalWorkingHour` | `startTime/endTime` HH:MM. Unique `[professionalId, dayOfWeek]`. |
| `professional_services` | `ProfessionalService` | N:N entre Professional e Service. PK composta `[professionalId, serviceId]`. |
| `services` | `Service` | `durationMinutes` deve ser múltiplo de 15. `price` em BRL cents. Soft-delete. |
| `customers` | `Customer` | `phone` = E.164 para WhatsApp. `document` = CPF. Soft-delete. |
| `blocked_slots` | `BlockedSlot` | Recorrência: `none/daily/weekly`. `dayOfWeek` usado quando `recurrence=weekly`. |
| `appointments` | `Appointment` | `price` copiado do serviço no momento do agendamento. `reminderJobId` = BullMQ job. |
| `billing` | `Billing` | `appointmentId` UNIQUE (1:1). Auto-criado por evento `appointment.completed`. `paymentToken` público. |
| `payments` | `Payment` | `gatewayPaymentId` UNIQUE. `gatewayEventId` = idempotência em webhooks. |
| `ledger_entries` | `LedgerEntry` | Append-only. Sem `updatedAt`. Nunca atualizar/deletar. |
| `notification_logs` | `NotificationLog` | Log de envios WhatsApp/email. `retryCount`. |
| `products` | `Product` | Catálogo de produtos vendidos. `stockQuantity`. |
| `product_sales` | `ProductSale` | Venda de produto. Debita estoque. |
| `clinical_records` | `ClinicalRecord` | Prontuário clínico. Por profissional. |
| `equipment` | `Equipment` | Equipamentos da clínica. Soft-delete. |
| `appointment_equipment` | `AppointmentEquipment` | N:N Appointment ↔ Equipment. |
| `rooms` | `Room` | Salas de atendimento. Soft-delete. |
| `supplies` | `Supply` | Insumos. `stockQuantity`, `minStock`. Soft-delete. |
| `service_supplies` | `ServiceSupply` | N:N Service ↔ Supply. `quantityUsed` por sessão. |
| `supply_purchases` | `SupplyPurchase` | Compras de insumo. `conversionFactor`. Cancelamento estorna estoque. |
| `wallet_entries` | `WalletEntry` | Vouchers, créditos, cashback, pacotes. Log append-only via `WalletTransaction`. |
| `wallet_transactions` | `WalletTransaction` | Log imutável de movimentações da carteira. |
| `promotions` | `Promotion` | Códigos de desconto. `maxUses`, `currentUses`, `minAmount`. |
| `service_packages` | `ServicePackage` | Pacotes de serviços. `totalSessions`, `price`. |
| `service_package_items` | `ServicePackageItem` | Itens de um pacote (serviço + quantidade). |
| `customer_packages` | `CustomerPackage` | Pacote comprado por cliente. `sessionsUsed`. |
| `audit_logs` | `AuditLog` | Log de auditoria de ações críticas. |

**Convenções globais do schema:**
- `clinic_id` em **todas** as tabelas — sem exceção
- Valores monetários: `Int` em BRL cents (nunca float)
- Timestamps de horário: `String "HH:MM"` (Prisma não tem tipo Time nativo)
- Soft-delete via `deleted_at DateTime?` (nunca DELETE físico em dados de negócio)
- UUIDs como PK em todas as tabelas (`@default(uuid())`)
- Snake_case no banco (`@map`), camelCase no Prisma

---

## Guards de Autenticação

| Guard | Verifica | Aplicado em |
|-------|---------|------------|
| `JwtClinicGuard` | JWT válido, role admin/staff, clínica ativa | Todas as rotas do dashboard |
| `RoleGuard(admin)` | Adicionalmente: role = admin | Financeiro, configurações, gestão de usuários |
| `JwtProfessionalGuard` | JWT válido, role = professional, mesma clínica | Portal do profissional |
| `ApiKeyGuard` | Hash da chave válido, clínica ativa | Rotas de integração |
| `JwtAdminGuard` | JWT válido, role = platform_admin | Rotas da plataforma |

> ⚠️ **Regra crítica de segurança**: `RoleGuard` no backend é **obrigatório** para dados sensíveis. Ocultar componente React não é proteção.

---

## Fluxo de Dados (Request → Response)

```
Request (clinicaana.aesthera.com.br)
  ↓
Tenant Middleware    (X-Clinic-Slug header → slug → clinic_id via Redis cache → DB fallback)
  ↓
Controller          (Zod validation → guard aplicado)
  ↓
Service             (regras de negócio → emite domain events)
  ↓  [se necessário]
Integrations        (stripe.service / mercadopago.service / whatsapp.service)
  ↓
Repository          (Prisma — sempre filtra por clinic_id)
  ↓
PostgreSQL
```

---

## Fluxo Appointment → Billing → Payment → Ledger

```
appointment criado
  → BullMQ: agenda reminder D-1
  → WhatsApp: confirmação enviada

appointment.completed (domain event)
  → billing criado automaticamente (amount = price do appointment)
  → payment link gerado
  → WhatsApp + email: link enviado ao cliente

webhook gateway (Stripe / MercadoPago)
  → payment.succeeded
  → billing.status = paid
  → LedgerEntry criada (credit, append-only)
  → WhatsApp: recibo enviado

cron diário
  → billing pending + vencido → overdue
  → WhatsApp: lembrete enviado
```

---

## Padrões de Comunicação entre Módulos

- **Domain Events** (arquivo `shared/events/event-bus.ts`) — única forma de comunicação entre módulos
- **Nunca** chamadas diretas service-to-service
- Eventos conhecidos: `appointment.created`, `appointment.completed`, `appointment.cancelled`, `payment.succeeded`, `payment.failed`

---

## Estrutura de Pastas (Backend)

```
src/modules/{nome}/
  {nome}.controller.ts   ← rotas Fastify, entrada/saída
  {nome}.service.ts      ← regras de negócio
  {nome}.repository.ts   ← queries Prisma (sempre com clinic_id)
  {nome}.dto.ts          ← schemas Zod de input/output
  {nome}.test.ts         ← testes Vitest

src/shared/
  middleware/            ← tenant, auth
  guards/                ← JwtClinicGuard, RoleGuard, etc.
  errors/                ← classes de erro padronizadas
  events/                ← event-bus.ts, domain-event.ts
  utils/
  logger/

src/integrations/
  stripe/stripe.service.ts
  mercadopago/mercadopago.service.ts
  whatsapp/whatsapp.service.ts      ← Z-API / Evolution API HTTP client
  resend/resend.service.ts
  gemini/gemini.service.ts          ← Google Gemini 2.0 Flash
```

---

## Decisões de Arquitetura Registradas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Multi-tenancy | `clinic_id` em todas as tabelas | Isolamento de dados sem schema separado por tenant |
| Resolução de tenant | Slug do subdomínio → Redis cache → DB | Zero lookup auth-before-tenant |
| Valores monetários | `Int` BRL cents | Evita erros de float em operações financeiras |
| Horários | `String "HH:MM"` | Prisma não tem tipo Time nativo sem `@db.Time` |
| Soft-delete | `deleted_at DateTime?` | Nunca deletar dados de negócio fisicamente |
| Ledger | Append-only, sem `updatedAt` | Auditabilidade financeira imutável |
| Wallet | Append-only via `WalletTransaction` | Rastreabilidade de todas as movimentações |
| Billing | Auto-criado por domain event | Nunca por chamada direta na API |
| Disponibilidade | Verificada dentro de transação DB | Previne double-booking com lock pessimista |
| Notificações | Sempre assíncronas via BullMQ | Nunca bloquear request do usuário |
| WhatsApp | Z-API / Evolution API HTTP REST | MVP-friendly, sem aprovação Meta |
| Autenticação IA | Rate limiting 30 req/h por clínica | Evitar abuso do Gemini |
| Histórico IA | Redis TTL 1h, janela 20 mensagens | Balanço entre contexto e custo |

---

## Módulos Pendentes / Incompletos

| Módulo | Status | Detalhe |
|--------|--------|---------|
| **Contracts** | 🔲 Spec existe, código não | `features/contracts.md` existe; `clinical.service.ts` ausente |
| **Clinical Records** | ⚠️ Parcial | DTO e repository criados; `clinical.service.ts` ausente; tela não implementada |
| **Sales page** | ⚠️ Parcial | Pasta `/sales` no frontend existe; página não implementada |

---

## Decisões Técnicas Registradas por Este Agente

> Seção atualizada automaticamente quando novas decisões são tomadas.

| Data | Decisão | Módulo/Área impactada |
|------|---------|----------------------|
| — | — | — |
