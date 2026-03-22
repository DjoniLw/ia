# Base de Conhecimento — Aesthera Product Owner

> Este arquivo é mantido automaticamente pelo agente `aesthera-product-owner`.
> Lido obrigatoriamente no início de toda sessão.
> Atualizado sempre que uma nova spec, decisão de produto ou regra de negócio for definida.

---

## Estado do Produto (atualizado em: 22/03/2026)

### Fase atual: MVP concluído (Fases 1–9 implementadas)

O sistema está operacional. As fases pendentes são contratos digitais, prontuário clínico completo e a página `/sales` no frontend.

---

## Módulos Existentes e Status

| Módulo | Status | Notas |
|--------|--------|-------|
| **Auth** | ✅ Implementado | Login por e-mail (sem slug manual), CNPJ opcional no cadastro, refresh token, recuperação de senha |
| **Clinics** | ✅ Implementado | Dados da clínica, horários de funcionamento, multi-tenant via `clinic_id` |
| **Users** | ✅ Implementado | Roles: `admin` / `staff`. Convite por e-mail, aceite via `/accept-invite` |
| **Professionals** | ✅ Implementado | CRUD + horários individuais + vínculo com serviços |
| **Services** | ✅ Implementado | Catálogo de tratamentos (nome, duração, preço, categoria) |
| **Customers** | ✅ Implementado | CRUD + filtros + página de detalhe com histórico |
| **Appointments** | ✅ Implementado | State machine completa, disponibilidade, calendário dia/semana, bloqueios |
| **Billing** | ✅ Implementado | Criação automática em `appointment.completed`, link de pagamento, cron de vencimento |
| **Payments** | ✅ Implementado | Stripe (cartão) + MercadoPago (PIX + boleto), webhooks, página pública `/pay/:token` |
| **Ledger** | ✅ Implementado | Entradas em `payment.succeeded`, resumo financeiro por período |
| **Notifications** | ✅ Implementado | WhatsApp (Z-API/Evolution) + e-mail (Resend), filas BullMQ, log de envios |
| **AI** | ✅ Implementado | Chat streaming (Gemini), resumo de cliente, briefing do dashboard, function calling |
| **Equipment** | ✅ Implementado | CRUD de equipamentos + vínculo com agendamentos |
| **Rooms** | ✅ Implementado | CRUD de salas + vínculo com agendamentos |
| **Supplies** | ✅ Implementado | Estoque de insumos + alerta de mínimo + vínculo com serviços + compras com conversão |
| **Wallet** | ✅ Implementado | Vouchers, créditos, cashback, saldo de pacote — log append-only |
| **Promotions** | ✅ Implementado | Códigos de desconto (% / fixo), janela de validade, `maxUses`, `minAmount` |
| **Packages** | ✅ Implementado | Pacotes de serviços, pré-geração de sessões, integração com Wallet |
| **Products** | ✅ Implementado | Catálogo de produtos vendidos (estoque, preço) |
| **Contracts** | 🔲 Não implementado | Spec em `features/contracts.md`, código ausente |
| **Clinical Records** | 🔲 Parcial | DTO e repository criados, `clinical.service.ts` ausente, tela não implementada |
| **Sales** | 🔲 Parcial | Pasta `/sales` existe no frontend, página não implementada |

---

## Perfis de Usuário e Permissões

| Perfil | Acesso |
|--------|--------|
| **admin** | Total — financeiro, relatórios, configurações, usuários, permissões |
| **staff** | Agendamentos, clientes, cobranças (sem financeiro consolidado, sem configurações críticas) |
| **professional** | Apenas sua própria agenda e fichas dos clientes que atende |

> ⚠️ **Regra de segurança crítica**: restrição de acesso a dados sensíveis DEVE ter `roleGuard` no backend. Ocultar componente React não é proteção.

---

## Regras de Negócio Centrais

### Agendamentos
- State machine: `draft → confirmed → in_progress → completed | no_show`; `confirmed/draft → cancelled`
- Disponibilidade verificada com lock de transação (anti double-booking)
- Slots de 15 min, baseado em horários do profissional menos agendamentos existentes e bloqueios
- `completed` dispara evento `appointment.completed` → cria billing automaticamente

### Billing
- Criado automaticamente em `appointment.completed` (nunca por chamada direta)
- `due_date` padrão: data do agendamento + 3 dias (configurável por clínica)
- Cron diário: `pending` vencido → `overdue` + WhatsApp de lembrete
- `paid` é imutável
- Cancelar appointment não cancela billing se já `paid`

### Pagamentos
- PIX e boleto via MercadoPago; cartão via Stripe
- Página pública `/pay/:token` — responsiva para celular
- Webhook recebido → `payment.succeeded` → cria entrada no Ledger

### Multi-tenancy
- `clinic_id` presente em **todas** as tabelas
- Toda query DEVE filtrar por `clinic_id` (sem exceção)
- Slug da URL do subdomínio resolve para `clinic_id` via Redis (cache) → DB

### Notificações automáticas (triggers)
- Confirmação de agendamento → WhatsApp + e-mail
- Lembrete D-1 → WhatsApp
- Link de pagamento → WhatsApp + e-mail
- Recibo ao pagar → WhatsApp
- Vencimento de cobrança → WhatsApp

---

## Arquitetura Resumida

- **Padrão**: Modular Monolith (ex: `src/modules/{nome}/{nome}.controller|service|repository|dto|test`)
- **Backend**: Fastify 5 + Prisma 6 + PostgreSQL 16 + Redis 7 + BullMQ 5
- **Frontend**: Next.js 15 App Router + Tailwind CSS 4 + shadcn/ui + TanStack Query v5 + React Hook Form + Zod
- **Calendário**: FullCalendar (grade dia/semana com drag-and-drop)
- **Tabelas**: TanStack Table v8
- **IA**: Google Gemini 2.0 Flash + Vercel AI SDK (streaming via SSE)
- **Infra**: Railway (MVP)

---

## Convenções de UI (Padrões Estabelecidos)

- Barra de filtros: `flex flex-wrap items-center gap-2`
- Campo de busca: `h-8 w-48 text-sm`
- Cabeçalhos de tabela `<th>`: `text-xs font-medium text-muted-foreground` (sem uppercase)
- Botão salvar em **cadastro novo**: `disabled={isPending || !isValid}` (não `!isDirty`)
- Botão salvar em **edição**: `disabled={isPending || !isDirty}`
- Todo texto visível ao usuário em **Português do Brasil** obrigatoriamente
- Formulários: shadcn/ui `Form` + `react-hook-form` + `zod`

---

## Módulos / Funcionalidades Especificadas por Este Agente

> Seção atualizada automaticamente quando novas specs são criadas.

| Data | Funcionalidade | Arquivo de spec | Status |
|------|---------------|-----------------|--------|
| — | — | — | — |

---

## Decisões de Produto Registradas

> Decisões que impactam o escopo ou direção do produto, documentadas para referência futura.

| Data | Decisão | Contexto |
|------|---------|---------|
| — | — | — |
