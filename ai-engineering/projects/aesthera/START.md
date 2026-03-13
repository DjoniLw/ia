# Aesthera — Session Start

Use este arquivo para iniciar qualquer nova sessão de desenvolvimento.

---

## Como usar no VS Code (Copilot Chat)

```
#file:projects/aesthera/START.md
#file:projects/aesthera/context/stack.md
#file:projects/aesthera/context/architecture.md
#file:projects/aesthera/features/[modulo].md

Etapa X — [descrição do que fazer]
```

## Como usar em chat externo (ChatGPT, Claude etc.)

Cole o conteúdo deste arquivo + `context/stack.md` + `context/architecture.md` + o `features/[modulo].md` relevante.

---

## Caminhos do Projeto

| O quê | Caminho |
|-------|---------|
| 📁 Documentação (este repo) | `ai-engineering/projects/aesthera/` |
| 💻 Código Backend (API) | `aesthera/apps/api` |
| 🌐 Código Frontend (Web) | `aesthera/apps/web` |

---

## Identidade do Projeto

- **Nome**: Aesthera
- **O que é**: SaaS ERP multi-tenant para clínicas estéticas — gerencia agendamentos, profissionais, serviços, clientes, billing e pagamentos
- **Padrão**: Modular Monolith (Node.js + Fastify + TypeScript + PostgreSQL + Redis)
- **Multi-tenancy**: `clinic_id` em todas as tabelas — dados nunca vazam entre clínicas
- **Auth**: JWT (admin da clínica + profissional) + API Key (integrações) + Admin JWT (plataforma)
- **Pagamentos**: Stripe (cartão) · MercadoPago (PIX + boleto)
- **Notificações**: WhatsApp via Z-API/Evolution API · Email via Resend
- **Infra MVP**: Railway + Docker
- **Expansão futura**: ERP genérico para outras verticais (academias, salões, consultórios)

---

## Mapa de Arquivos de Contexto

| Arquivo | Conteúdo |
|---------|----------|
| `context/project.md` | Goal, constraints, out of scope |
| `context/stack.md` | Stack completo com versões |
| `context/architecture.md` | Estrutura de pastas, data flow, decisões |
| `features/auth.md` | Login clínica + usuários + profissional, guards, tokens |
| `features/clinics.md` | Tenant, horários, API keys |
| `features/users.md` | Usuários da clínica (admin, staff), convites, permissões |
| `features/professionals.md` | Staff, horários, serviços vinculados |
| `features/services.md` | Catálogo de serviços da clínica |
| `features/customers.md` | Clientes/pacientes da clínica |
| `features/appointments.md` | Agendamentos — máquina de estado, disponibilidade |
| `features/billing.md` | Cobranças geradas após atendimento |
| `features/payments.md` | Webhooks Stripe/MP, processamento, idempotência |
| `features/notifications.md` | WhatsApp + Email via BullMQ |
| `features/ledger.md` | Registro financeiro imutável (append-only) |
| `features/ai-assistant.md` | IA embutida — chat, resumos, briefing, function calling |
| `agents/system-architect.md` | Persona do agente com regras Aesthera |

## Prompts Específicos

| Arquivo | Conteúdo |
|---------|----------|
| `prompts/create-module.md` | Template para gerar módulo (versão Aesthera) |
| `prompts/generate-tests.md` | Template para gerar testes (versão Aesthera) |

## Prompts Compartilhados (genéricos)

| Arquivo | Conteúdo |
|---------|----------|
| `shared/prompts/code-review.md` | Template de code review |
| `shared/agents/base-architect.md` | Regras base de comportamento do agente |

---

## Ordem de Desenvolvimento (MVP)

| # | Etapa | Arquivos relevantes |
|---|-------|---------------------|
| 1 | Setup base (projeto, Docker, Prisma, config) | `stack.md` · `architecture.md` |
| 2 | Prisma schema completo | todos os `features/*.md` |
| 3 | Auth (clinic admin + professional) | `features/auth.md` |
| 4 | Clinics (tenant + business hours) | `features/clinics.md` |
| 5 | Users (roles: admin, staff) | `features/users.md` |
| 6 | Professionals + working hours | `features/professionals.md` |
| 7 | Services catalog | `features/services.md` |
| 8 | Customers | `features/customers.md` |
| 9 | Appointments (availability + state machine) | `features/appointments.md` |
| 10 | Billing (auto-create on completion) | `features/billing.md` |
| 11 | Payments (webhooks Stripe + MercadoPago) | `features/payments.md` |
| 12 | Notifications (WhatsApp + email + reminders) | `features/notifications.md` |
| 13 | Ledger | `features/ledger.md` |
| 14 | Cron jobs (billing overdue) | `features/billing.md` |
| 15 | Frontend dashboard | `stack.md` (Next.js 15) |

---

## Regras Críticas (nunca ignorar)

- **Tenant resolution**: toda request passa pelo `TenantMiddleware` — lê `X-Clinic-Slug` → resolve `clinic_id` via Redis/DB antes de qualquer guard ou controller
- Todo query no banco **deve filtrar por `clinic_id`**
- Verificação de disponibilidade **deve rodar dentro de uma transação DB** (previne double-booking)
- Webhooks do Stripe e MercadoPago **devem verificar assinatura** antes de processar
- Billing é criado **automaticamente** pelo evento `appointment.completed` — nunca manualmente
- Entradas no ledger são **append-only** — nunca update, nunca delete
- Eventos de domínio são emitidos **depois** da mudança de estado, nunca antes
- Notificações (WhatsApp + email) **sempre via BullMQ**, nunca síncronas
- Job de lembrete D-1 **deve ser cancelado** se o agendamento for cancelado ou remarcado
- WhatsApp só enviado se o cliente tiver `phone` em formato E.164 — falha silenciosa se ausente
- Segredos **sempre em variáveis de ambiente** — nunca hardcoded

---
