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
ClinicStatus:           active | suspended | cancelled
ClinicPlan:             trial | starter | pro | enterprise
UserRole:               admin | staff
TransferStatus:         pending | confirmed | rejected | expired
TransferKind:           clinic_registration | user_invite
AppointmentStatus:      draft | confirmed | in_progress | completed | cancelled | no_show
BillingStatus:          pending | paid | overdue | cancelled
PaymentGateway:         stripe | mercadopago
PaymentMethod:          pix | boleto | card
PaymentStatus:          pending | paid | failed | expired | refunded | disputed
LedgerEntryType:        credit | debit
WalletEntryType:        VOUCHER | CREDIT | CASHBACK | PACKAGE
WalletEntryStatus:      ACTIVE | USED | EXPIRED
WalletOriginType:       OVERPAYMENT | GIFT | REFUND | CASHBACK_PROMOTION | PACKAGE_PURCHASE | VOUCHER_SPLIT
WalletTransactionType:  CREATE | USE | SPLIT | ADJUST
NotificationType:       whatsapp | email
NotificationStatus:     pending | sent | failed
RecurrenceType:         none | daily | weekly
PromotionDiscountType:  PERCENTAGE | FIXED
PromotionStatus:        active | inactive | expired
AnamnesisStatus:        DRAFT | CLINIC_FILLED | SENT_TO_CLIENT | CLIENT_SUBMITTED | SIGNED | EXPIRED | CANCELLED
  ⚠️ Substituí AnamnesisRequestStatus (pending→SENT_TO_CLIENT, correction_requested→CLIENT_SUBMITTED) — redesign 08/04/2026
ContractStatus:         pending | signed  (CustomerContract)
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
| `billing` | `Billing` | `appointmentId` UNIQUE (1:1). **Não** é mais criado automaticamente por `appointment.completed` — staff confirma via `CompleteAppointmentModal`. `paymentToken` público. |
| `payments` | `Payment` | `gatewayPaymentId` UNIQUE. `gatewayEventId` = idempotência em webhooks. |
| `ledger_entries` | `LedgerEntry` | Append-only. Sem `updatedAt`. Nunca atualizar/deletar. |
| `notification_logs` | `NotificationLog` | Log de envios WhatsApp/email. `retryCount`. Campo `anamnesisId` a adicionar no redesign. |
| `products` | `Product` | Catálogo de produtos vendidos. `stockQuantity`. |
| `product_sales` | `ProductSale` | Venda de produto. Debita estoque. |
| `clinical_records` | `ClinicalRecord` | Prontuário clínico. Por profissional. `type` NÃO inclui mais `anamnesis` após redesign. FK `anamnesisId` mantida para registros históricos. |
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
| `anamnesis` | `Anamnesis` | **RENOMEADO de `anamnesis_requests`** (redesign 08/04/2026). Ciclo de vida próprio — separado de `ClinicalRecord`. Ver seção Módulo Anamnesis abaixo. |
| `contract_templates` | `ContractTemplate` | Templates de contrato da clínica. `storageKey` = chave de arquivo. |
| `customer_contracts` | `CustomerContract` | Contratos gerados por cliente. `signToken` único. `signatureMode`: `assinafy` ou `manual`. `signedPdfKey` = R2 key. |

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
  → billing NÃO é criado automaticamente (regra revogada em PR #148)
  → AppointmentsService.complete() retorna { appointment, serviceVouchers: WalletEntry[] }
  → frontend abre CompleteAppointmentModal para que o staff confirme:
    - "Gerar Cobrança" → POST /billing { sourceType: 'APPOINTMENT', appointmentId, serviceId, amount }
    - "Usar Vale" → billing + wallet.use(voucherId)
    - "Pular" → nenhuma cobrança criada

billing criado via POST /billing (3 sourceTypes):
  APPOINTMENT → pós-serviço, staff confirma após conclusão
  PRESALE     → pré-venda, gera WalletEntry SERVICE_PRESALE ao ser pago
  MANUAL      → cobrança avulsa, sem vínculo obrigatório

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

## Módulo Anamnesis — Estado e Decisões (redesign 08/04/2026)

> Revisão arquitetural completa em `outputs/po/anamnese-redesign-doc.md` (spec PO).

### Estado Real do Módulo
- Tabela `anamnesis_requests` (Prisma: `AnamnesisRequest`) — **implementada e em uso** no branch `feat/anamnese-digital-145`
- Backend: `src/modules/anamnesis/` — service, repository, routes, DTOs, testes — **completo**
- Frontend público: `app/anamnese/[token]/page.tsx` — **implementado**
- Rotas públicas: `GET/POST /public/anamnese/:token` — **implementadas**

### Decisões do Redesign (08/04/2026)

| # | Decisão |
|---|---------|
| D1 | **Renomear** `AnamnesisRequest` → `Anamnesis` (tabela `anamnesis_requests` → `anamnesis`). É EVOLUÇÃO, não substituição do zero. |
| D2 | **Manter obrigatoriamente**: `signatureHash`, `consentGivenAt`, `consentText`, `ipAddress`, `userAgent` — campos LGPD/não-repúdio omitidos na spec PO. |
| D3 | **Adicionar** `diffResolvedAt DateTime?` e `diffResolvedByUserId String?` — rastreabilidade de quem resolveu o diff. |
| D4 | **Atomicidade**: `diffResolution + signedAt + status=SIGNED` em `prisma.$transaction()` no endpoint `resolve-diff`. |
| D5 | **Rota pública**: manter `/public/anamnese/:token` — NÃO alterar para `/anamnese/public/:token` (spec PO errada). Frontend já integrado. |
| D6 | **`templateId` = `groupId`** — referência fraca sem FK física. Grupos de perguntas em Settings são os "templates" de anamnese. Não criar modelo `AnamnesisTemplate` separado. |
| D7 | **Consolidar snapshot**: `groupName + questionsSnapshot` → `templateSnapshot: Json { templateId, templateName, capturedAt, questions }`. |
| D8 | **Migrar `correction_requested`** → `CLIENT_SUBMITTED` antes de remover o estado do enum. Verificar dados em produção antes da migration. |
| D9 | **TTL = 7 dias (168h)** — alterar de 72h para 168h no `anamnesis.service.ts`. |
| D10 | **Adicionar** `anamnesisId String?` em `NotificationLog` + emitir domain events `anamnesis.sent` e `anamnesis.resent`. |
| D11 | **FK** `anamnesisId` em `ClinicalRecord` mantida (renomeada de `anamnesisRequestId`) para integridade histórica. Remoção em sprint futura. |
| D12 | **`SignatureCanvas`** deve ser extraído para `components/shared/signature-canvas.tsx` antes de compartilhar entre anamnese e contratos. |

### Enum `AnamnesisStatus` (novo — substituí `AnamnesisRequestStatus`)
```
DRAFT            -- rascunho local, editável, deletável
CLINIC_FILLED    -- clínica finalizou sem enviar ao cliente
SENT_TO_CLIENT   -- link enviado, aguardando resposta [era: pending]
CLIENT_SUBMITTED -- cliente respondeu, aguarda revisão do diff
SIGNED           -- assinada, imutável [era: signed]
EXPIRED          -- token expirou [era: expired]
CANCELLED        -- link cancelado [era: cancelled]
```

### Schema Canônico `Anamnesis` (após redesign)
Campos obrigatórios preservados (não remover):
- `signatureHash` (SHA-256 para não-repúdio)
- `consentGivenAt` / `consentText` (LGPD art. 11)
- `ipAddress` / `userAgent` (evidência de autoria)
- `reminderJobId` (para cancelamento de BullMQ delayed job)
- `sentAt` (timestamp do envio do link)

---

## Módulos Pendentes / Incompletos

| Módulo | Status | Detalhe |
|--------|--------|---------|
| **Anamnesis** | ⚠️ Em redesign | `AnamnesisRequest` implementado. Redesign propõe renomear + novos estados + diff. Schema real mais completo que spec PO. |
| **Contracts** | ⚠️ Parcial | Schema completo (`CustomerContract`, `ContractTemplate`). Backend parcial; `features/contracts.md` desatualizado (descreve schema mais simples que o real). |
| **Clinical Records** | ⚠️ Parcial | DTO e repository criados; `clinical.service.ts` ausente; tela não implementada. Após redesign de anamnese: remover `anamnesis` do type. |
| **Sales page** | ⚠️ Parcial | Pasta `/sales` no frontend existe; página não implementada. |

---

## Decisões Técnicas Registradas por Este Agente

| Data | Decisão | Módulo/Área impactada |
|------|---------|----------------------|
| 08/04/2026 | Renomear `AnamnesisRequest` → `Anamnesis` (evolução, não substituição) | anamnesis |
| 08/04/2026 | Manter campos LGPD/segurança omitidos na spec PO (`signatureHash`, `consentGivenAt`, etc.) | anamnesis |
| 08/04/2026 | 7 estados em `AnamnesisStatus` + remoção de `correction_requested` com migration | anamnesis |
| 08/04/2026 | `diffResolution` atômico com `status=SIGNED` via `prisma.$transaction()` | anamnesis |
| 08/04/2026 | Manter rota pública `/public/anamnese/:token` (NÃO `/anamnese/public/:token`) | anamnesis, routing |
| 08/04/2026 | TTL de anamnese: 7 dias (168h) em vez de 72h | anamnesis |
| 08/04/2026 | `templateId` na anamnese = `groupId` de Settings > Anamnese (sem modelo separado) | anamnesis, settings |
| 08/04/2026 | `SignatureCanvas` extraído para `components/shared/` antes de compartilhar | contracts, anamnesis, frontend |
