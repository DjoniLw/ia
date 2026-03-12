# Fluxa — Session Start

Use este arquivo para iniciar qualquer nova sessão de desenvolvimento.

---

## Como usar no VS Code (Copilot Chat)

Adicione os arquivos como contexto com `#file` e indique a etapa:

```
#file:projects/fluxa/START.md
#file:projects/fluxa/context/stack.md
#file:projects/fluxa/context/architecture.md
#file:projects/fluxa/features/[modulo].md

Etapa X — [descrição do que fazer]
```

## Como usar em chat externo (ChatGPT, Claude etc.)

Cole o conteúdo deste arquivo + `context/stack.md` + `context/architecture.md` + o `features/[modulo].md` relevante.

---

## Caminhos do Projeto

| O quê | Caminho |
|-------|---------|
| 📁 Documentação (este repo) | `c:\Disco_D\Desenvolvimento\IA\ai-engineering\projects\fluxa\` |
| 💻 Código Backend (API) | `c:\Disco_D\Desenvolvimento\IA\fluxa\apps\api\` |
| 🌐 Código Frontend (Web) | `c:\Disco_D\Desenvolvimento\IA\fluxa\apps\web\` |

> Ao iniciar uma sessão de código, indique sempre em qual pasta está trabalhando.

---

## Identidade do Projeto

- **Nome**: Fluxa
- **O que é**: Plataforma de billing e cobrança API-first — empresas usam o Fluxa para cobrar seus clientes via PIX, boleto e cartão
- **Padrão**: Modular Monolith (Node.js + Fastify + TypeScript + PostgreSQL + Redis)
- **Multi-tenancy**: `company_id` em todas as tabelas — dados nunca vazam entre tenants
- **Auth**: JWT (dashboard da empresa) + API Key (integrações via código) + Admin JWT (interno)
- **Gateways**: Stripe (cartão) · MercadoPago (PIX + boleto)
- **Infra MVP**: Railway + Docker
- **Stage atual**: Idea → MVP (1 dev, budget low, 3–6 meses)

---

## Mapa de Arquivos de Contexto

| Arquivo | Conteúdo |
|---------|----------|
| `context/project.md` | Goal, constraints, out of scope |
| `context/stack.md` | Stack completo com versões |
| `context/architecture.md` | Estrutura de pastas, data flow, decisões |
| `features/auth.md` | Login empresa, API keys, guards, Redis tokens |
| `features/companies.md` | Tenant, API keys, webhooks, planos |
| `features/customers.md` | Pagadores vinculados à empresa |
| `features/invoices.md` | Core do produto — máquina de estado de cobrança |
| `features/payments.md` | Webhooks Stripe/MP, processamento, idempotência |
| `features/notifications.md` | Email (Resend) + webhooks empresa via BullMQ |
| `features/ledger.md` | Registro financeiro imutável (append-only) |
| `agents/system-architect.md` | Persona do agente com regras de comportamento |

## Prompts Compartilhados (reaproveitáveis entre projetos)

| Arquivo | Conteúdo |
|---------|----------|
| `shared/prompts/create-module.md` | Template para gerar módulo completo |
| `shared/prompts/code-review.md` | Template de revisão com checklist |
| `shared/prompts/generate-tests.md` | Template para gerar testes |
| `shared/agents/base-architect.md` | Regras base de comportamento do agente |

---

## Ordem de Desenvolvimento (MVP)

| # | Etapa | Arquivos relevantes |
|---|-------|---------------------|
| 1 | Setup base (projeto, Docker, Prisma, config) | `stack.md` · `architecture.md` |
| 2 | Prisma schema completo | todos os `features/*.md` |
| 3 | Auth | `features/auth.md` |
| 4 | Companies | `features/companies.md` |
| 5 | Customers | `features/customers.md` |
| 6 | Invoices | `features/invoices.md` |
| 7 | Payments (webhooks) | `features/payments.md` |
| 8 | Notifications | `features/notifications.md` |
| 9 | Ledger | `features/ledger.md` |
| 10 | Cron jobs (overdue, expired) | `features/invoices.md` |
| 11 | Frontend dashboard | `stack.md` (Next.js 15) |

---

## Regras Críticas (nunca ignorar)

- Todo query no banco **deve filtrar por `company_id`**
- Webhooks do Stripe e MercadoPago **devem verificar assinatura** antes de processar
- Criação de invoice e payment **devem ser idempotentes** (`idempotency_key`)
- Entradas no ledger são **append-only** — nunca update, nunca delete
- Eventos de domínio são emitidos **depois** da mudança de estado, nunca antes
- Tarefas longas (email, webhooks empresa) **sempre via BullMQ**, nunca síncronas
- Segredos **sempre em variáveis de ambiente** — nunca hardcoded

---
