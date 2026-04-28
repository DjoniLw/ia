# Base de Conhecimento — Aesthera Product Owner

> Este arquivo é mantido automaticamente pelo agente `aesthera-product-owner`.
> Lido obrigatoriamente no início de toda sessão.
> Atualizado sempre que uma nova spec, decisão de produto ou regra de negócio for definida.

---

## Estado do Produto (atualizado em: 13/04/2026)

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
| **Notifications** | ⚠️ Parcial | WhatsApp via **Evolution API** + e-mail (SMTP clínica / Resend), `NotificationLog`, log de envios. **BullMQ instalado mas NÃO utilizado** — envios são síncronos (fire-and-forget). Lembrete D-1 ausente em código apesar de documentado. |
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
| **Fichas de Avaliação (Expandidas)** | 📋 Especificado | Categorias de avaliação + fichas por cliente + redesign da config. Spec: `outputs/po/fichas-avaliacao-expandidas-doc.md` |
| **Pacotes — Redesign Fluxo de Sessão** | 📋 Especificado | Sessão reservada no agendamento, consumida na cobrança (modelo igual ao vale). Fix de cache incluído. Spec: `outputs/po/pacotes-sessao-cobranca-redesign-doc.md` |
| **Pacotes — Integração no Modal de Recebimento** | 📋 Especificado | Sessão de pacote dentro do `ReceiveManualModal` como sub-opção separada de vales; remoção do `PayWithPackageSection` avulso; priorização automática SERVICE_PRESALE > Pacote. Spec: `outputs/po/pacotes-recebimento-modal-integracao-doc.md` |
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
- **Double-submit**: frontend deve manter estado local `isSubmitting` para bloquear envios duplicados antes da mutation ser registrada como `isPending`
- **Mapeamento de erros**: códigos `DOUBLE_BOOKING`, `PROFESSIONAL_UNAVAILABLE`, `ROOM_CONFLICT`, `EQUIPMENT_CONFLICT`, `ROOM_REQUIRED` devem ter mensagens PT-BR específicas no frontend
- **View do calendário**: persistida em `localStorage` chave `aesthera:appointments:view` — data sempre resetada para hoje ao montar a tela
- **Agenda Inteligente**: busca de disponibilidade orientada a recurso (serviço + equipamento + sala? + profissional?) — endpoint `GET /appointments/smart-availability` — retorna disponibilidade por dia/slot no intervalo solicitado

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
- Lembrete D-1 → WhatsApp (**job delayed ausente em código — pendente issue #131 corrigida**)
- Link de pagamento → WhatsApp + e-mail
- Recibo ao pagar → WhatsApp
- Vencimento de cobrança → WhatsApp

### Notificações — Estado real do provider e fila
- Provider WhatsApp: **Evolution API** (não Z-API). Endpoint: `POST /message/sendText/{instance}`, header `apikey`
- Instância por clínica (`Clinic.whatsappInstance`) tem prioridade sobre `EVOLUTION_INSTANCE` global
- Envios são síncronos via `void sendWhatsApp(...)` — **sem fila real**
- BullMQ 5 instalado (`package.json`) mas sem uso no módulo de notificações
- O lembrete D-1 **não está implementado** apesar de marcado como [x] no PLAN.md Fase 6
- Issue #131 foi reescrita — spec corrigida: `outputs/tasks/014-messaging-queue-bullmq-evolution.md`

### Notificações — Ajustes de Envio WhatsApp/E-mail (28/04/2026)
- **smtpEnabled**: novo campo booleano em `Clinic` (DEFAULT TRUE). Quando `false`, envios por e-mail são bloqueados mesmo que SMTP esteja configurado. Não apaga dados de SMTP.
- **Fallback wa.me**: quando `WhatsappSettings.connected === false`, o frontend abre `https://wa.me/{phone}?text={msg}` em nova aba ao invés de enviar phone ao backend. Backend NÃO cria NotificationLog de WhatsApp no fallback.
- **SEC2 mantida**: endpoints de anamnese e contratos devem retornar `signUrl` (URL completa), nunca o `signToken` bruto.
- **Botão "Remover instância"**: aparece em Configurações/WhatsApp quando `configured && !connected` (não apenas quando `connected === true`).
- **Regra de disponibilidade de canal nos dialogs**: e-mail disponível somente quando `configured && enabled`; WhatsApp conectado = envio direto via backend; WhatsApp desconectado = wa.me fallback.

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

## Módulos em Planejamento / Especificados

| Módulo | Status | Notas |
|--------|--------|-------|
| **BodyMeasurements** | 📋 Especificado | Medidas corporais configuráveis + fotos. Pré-requisito: módulo `uploads`. Spec: `fase3-cliente-relacionamento-doc.md` |
| **Uploads** | 📋 Especificado | Pre-signed URL (Cloudflare R2 / S3), CustomerFile, TTL 1h. Pré-requisito do BodyMeasurements. |
| **Anamnesis** | 📋 Especificado | Módulo próprio de anamnese separado do prontuário. Entidade com ciclo de vida completo (draft → assinada), envio ao cliente, comparativo de alterações e assinatura digital. Spec: `outputs/po/anamnese-redesign-doc.md` |
| **Galeria de Fotos** | 📋 Especificado | Aba "Fotos" no perfil do cliente, upload direto sem sessão, lightbox navegável, comparação side-by-side de 2 fotos, tags (Antes/Depois/Progresso), regiões corporais configuráveis. Entidade: `CustomerPhoto`. Spec: `outputs/po/galeria-fotos-evolucao-doc.md` |

---

## Regras de Negócio — FASE 3

### Medidas Corporais
- Campos de medida são configurados por clínica (não globais) — máximo 30 campos ativos
- Campos inativos não aparecem em novos registros, mas preservam dados históricos
- Registros são imutáveis após criação (padrão do prontuário); exclusão apenas por admin
- Um registro pode ter campos parcialmente preenchidos — campos vazios não são salvos

### Arquivos / Fotos
- Tipos aceitos: `image/jpeg`, `image/png`, `image/webp`, `application/pdf` — máximo 10 MB por arquivo
- Máximo de 10 arquivos por registro de medida
- URLs de acesso never permanentes — sempre pre-signed com TTL 1h (LGPD)
- Guardar apenas `storageKey` no banco, nunca a URL

### Galeria de Fotos do Cliente (CustomerPhoto)
- Entidade `CustomerPhoto` centraliza TODAS as fotos do cliente independente da origem
- Fotos de sessões de avaliação criam `CustomerPhoto` com `sessionId` preenchido; upload direto cria com `sessionId = null`
- Tipos aceitos: `image/jpeg`, `image/png`, `image/webp` — máximo **20 MB** por arquivo (mais permissivo que medidas)
- Máximo de **5 arquivos por operação de upload**
- `takenAt` é definida pelo usuário (pode ser data retroativa) — não é data do upload
- Tags fixas: `ANTES`, `DEPOIS`, `PROGRESSO` (enum não configurável pela clínica)
- Regiões corporais são configuradas pela clínica em `/settings` — máximo 30 regiões ativas
- Exclusão: somente admin, soft delete, justificativa obrigatória (≥ 10 chars), arquivo no storage retido 90 dias
- Comparação requer exatamente 2 fotos; foto mais antiga vai para a esquerda por padrão
- `professional` só acessa fotos de clientes com agendamento `confirmed/in_progress/completed`
- Sem download direto pelo sistema (LGPD — dado sensível de imagem corporal)

### Carteira — Labels
- Mapeamento de `WalletOriginType` para PT-BR centralizado em `lib/wallet-labels.ts`
- `OVERPAYMENT` → "Troco de cobrança" | `GIFT` → "Presente / Brinde" | `REFUND` → "Estorno" | `CASHBACK_PROMOTION` → "Cashback de promoção" | `PACKAGE_PURCHASE` → "Compra de pacote" | `VOUCHER_SPLIT` → "Troco de voucher"

### Carteira — Filtros
- Padrão da tela global `/carteira`: últimos 6 meses + status ACTIVE
- "Limpar filtros" retorna ao padrão (não a "sem filtros")
- Endpoint `GET /wallet` aceita `createdAtFrom` e `createdAtTo` ISO date opcionais

---

## Specs Geradas pelo PO

| Spec | Data | Arquivo |
|------|------|---------|
| Fase 3 — Cliente, Relacionamento, Carteira | 2026-03 | `outputs/fase3-cliente-relacionamento-doc.md` |
| Fase 3 — Spec Final Consolidada | 2026-03 | `outputs/fase3-cliente-relacionamento-spec-final.md` |
| **Pagamento, Pacotes e Promoções** | **2026-03-24** | **`outputs/po/fluxo-pagamento-pacotes-promocoes-doc.md`** |
| **Melhorias Modal de Agendamento** | **2026-04-07** | **`outputs/po/agendamento-melhorias-modal-doc.md`** |
| **Agenda Inteligente (ex-Avançada)** | **2026-04-07** | **`outputs/po/agenda-inteligente-doc.md`** |
| **Redesign Módulo de Anamnese** | **2026-04-08** | **`outputs/po/anamnese-redesign-doc.md`** |
| **Fichas de Avaliação Expandidas** | **2026-04-13** | **`outputs/po/fichas-avaliacao-expandidas-doc.md`** |
| **Pacotes — Redesign Sessão via Cobrança** | **2026-04-26** | **`outputs/po/pacotes-sessao-cobranca-redesign-doc.md`** |
| **Pacotes — Integração no Modal de Recebimento** | **2026-04-27** | **`outputs/po/pacotes-recebimento-modal-integracao-doc.md`** |
| **Ajustes Envio WhatsApp e E-mail** | **2026-04-28** | **`outputs/po/ajustes-envio-whatsapp-email-doc.md`** |

---

## Regras de Negócio — Pacotes (atualizado 26/04/2026 — REDESIGN)

- **Sessão de pacote** tem 4 estados: `AVAILABLE` (sem agendamento, sem uso), `RESERVED` (agendamento vinculado, aguardando cobrança), `USED` (cobrança confirmada via pacote), `EXPIRED` (pacote vencido — estado derivado)
- **MUDANÇA DE FLUXO:** sessão é **reservada** ao criar agendamento (não consumida). Consumo ocorre na cobrança
- `Billing` é **sempre criado** ao completar agendamento — inclusive agendamentos com pacote vinculado
- Sessão reservada (`RESERVED`) não aparece como disponível em novos agendamentos
- Cancelar agendamento → sessão volta para `AVAILABLE`
- Na cobrança: se havia sessão reservada → proposta de "Pagar com Pacote" pré-selecionada
- Na cobrança: sem reserva prévia → operador pode aplicar sessão disponível (mesmo fluxo de vale)
- Trocar método de pagamento na cobrança → libera sessão reservada de volta para `AVAILABLE`
- `POST /billing/:id/pay-with-package` confirma pagamento: sessão → `USED`, billing → `paid`, Ledger entry com `origin = PACKAGE_SESSION`
- Endpoint `reserve` substitui `redeem` no momento do agendamento
- Endpoint `release` libera reserva (cancela agendamento ou troca de método)
- **Fix urgente (independente do redesign):** invalidar query `['packages', 'customer', customerId]` no `onSuccess` da mutation de criação de agendamento
- Spec completa: `outputs/po/pacotes-sessao-cobranca-redesign-doc.md`
- **Frontend redesenhado em spec separada:** integração no `ReceiveManualModal` — `outputs/po/pacotes-recebimento-modal-integracao-doc.md`
- **Regra de carteira:** entradas `WalletEntry.type = PACKAGE` **não aparecem** no seletor de vales/créditos do modal de recebimento
- **Prioridade de auto-seleção no modal:** SERVICE_PRESALE > sessão reservada no billing > sessão ABERTO mais antiga > dinheiro
- **Sessão de pacote** não combina com promoção/cupom (mesmo comportamento do SERVICE_PRESALE)
- **Botão `PayWithPackageSection`** (criado no PR #168 em `billing/page.tsx`) deve ser **removido** — substituído pela integração no modal

---

## Regras de Negócio — Promoções (atualizado 24/03/2026)

- **Bug conhecido:** Frontend envia `validFrom` como `"YYYY-MM-DD"` mas DTO exige ISO datetime completo → promoção não salva. Fix: frontend deve enviar `"YYYY-MM-DDTHH:mm:ss.000Z"`
- Campo `maxUsesPerCustomer` ainda não existe no modelo — precisa de migration
- Campo `applicableProductIds` ainda não existe — precisa de migration para suporte a promoções em produtos
- Promoção auto-aplicada em cobrança deve ser **opt-in** (sugestão + confirmação), não automática
- Promoção em produto aplica-se automaticamente na tela de venda
- Uma promoção por cobrança (não acumular cupons)
- Promoções não se aplicam a cobranças do tipo `PACKAGE_SALE`
- Validação de cupom requer `customerId` para verificar `maxUsesPerCustomer`

---

## Campos Pendentes de Migration (identificados em 24/03/2026)

| Tabela | Campo | Tipo | Descrição |
|--------|-------|------|-----------|
| `Promotion` | `applicableProductIds` | `String[] @default([])` | Produtos vinculados |
| `Promotion` | `maxUsesPerCustomer` | `Int?` | Limite de uso por cliente |
| `Billing` | `sourceType` | `Enum(APPOINTMENT, PACKAGE_SALE, PRODUCT_SALE, MANUAL)` | Origem da cobrança |
| `Billing` | `packageSessionId` | `String?` | FK → CustomerPackageSession — sessão usada para pagar (redesign 26/04) |
| `CustomerPackageSession` | `status` | `Enum(AVAILABLE, RESERVED, USED)` | Status explícito — **NOVO DESIGN: não é mais derivado** |
| `CustomerPackageSession` | `reservedAt` | `DateTime?` | Quando foi reservada (agendamento vinculado) |
| `CustomerPackageSession` | `billingId` | `String?` | FK → Billing — cobrança em que foi consumida |

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

## Regras de Negócio — Anamnese Digital (atualizado 30/03/2026)

- Token de assinatura: `crypto.randomBytes(32).toString('hex')` — nunca UUID diretamente para tokens públicos
- Links de anamnese expiram em **72h** por padrão (configurável futuramente)
- Dois modos: `blank` (cliente preenche) e `prefilled` (staff preenche, cliente valida)
- Questões do grupo são **snapshot** no momento do envio — imutáveis após criação do `AnamnesisRequest`
- Status: `pending → signed` (final) | `pending → expired` | `pending → correction_requested` | `expired → pending` (reenvio)
- Assinatura é atômica com criação do `ClinicalRecord` (tipo `anamnesis`) — transação Prisma
- `ClinicalRecord` criado é append-only — nunca pode ser deletado (dados clínicos LGPD)
- Endpoint público retorna 410 se token expirado; 409 se já assinado
- Reenvio de ficha `pending`/`expired` renova `expiresAt` se restam < 24h
- `clinic_id` em todas as queries (multi-tenancy obrigatório)

---

## Regras de Negócio — Fichas de Avaliação Expandidas (13/04/2026)

- Aba "Evolução" no perfil do cliente renomeada para **"Avaliações"** — "Evolução Corporal" removido
- `MeasurementSheet` ganha `category` (enum: CORPORAL, FACIAL, DERMATO_FUNCIONAL, NUTRICIONAL, POSTURAL, PERSONALIZADA) e `scope` (system | customer) + `customerId?`
- Fichas existentes recebem `category = CORPORAL` e `scope = system` via migration não-destrutiva
- **Fichas do sistema** (`scope=system`): max 20 ativas por clínica; visíveis para todos os clientes
- **Fichas do cliente** (`scope=customer`): max 10 ativas por cliente; apenas na aba do cliente vinculado
- Categoria da ficha é mutável; tipo (SIMPLE/TABULAR) continua imutável após criação
- Toggle "D/E" na configuração = `subColumns = ["D","E"]` no banco (estrutura já existe)
- Templates da biblioteca são constantes no código (não no banco); `POST /measurement-sheets/templates/:id/copy` cria cópia editável
- Templates incluídos: Perimetria, Bioimpedância, Condição Estética, Firmeza Tissular, Avaliação Facial, Avaliação Postural
- Professional pode criar ficha por cliente apenas se tiver agendamento confirmado com o cliente

---

## Padrões de Filtros (obrigatório em specs)

> Definido em: 25/03/2026 — revisão transversal de filtros (`outputs/ux/aesthera-ux-review-filtros-padronizacao-2026-03-25.md`)
> Referência canônica de implementação: `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`

Qualquer spec que descreva uma tela com filtros **DEVE especificar obrigatoriamente**:

1. **Quais filtros usam pills** — status, tipo, categoria fixa com ≤ 6 opções
2. **Quais campos usam ComboboxSearch** — qualquer campo que carrega dados da API (cliente, serviço, profissional, insumo). **NUNCA** especificar como "select" ou "dropdown simples"
3. **Se há filtro de período** — se sim, incluir presets (Hoje / 7 dias / 30 dias / 6 meses) e date range
4. **Como é a legenda descritiva** — texto dinâmico que resume os filtros ativos (`bg-muted/50` + ícone `Info`)
5. **Qual é o estado padrão** — o "Restaurar padrão" retorna a este estado, não a vazio

**Validação obrigatória em specs pré-desenvolvimento:** antes de aprovar uma spec que mencione filtros, verificar os 5 itens acima. Se não estiverem cobertos, devolver para complementação.

---

## Módulos / Funcionalidades Especificadas por Este Agente

> Seção atualizada automaticamente quando novas specs são criadas.

| Data | Funcionalidade | Arquivo de spec | Status |
|------|---------------|-----------------|--------|
| 2026-03-24 | FASE 3 — Cliente e Relacionamento (itens 3, 10, 11, 20) | ai-engineering/projects/aesthera/features/fase3-cliente-relacionamento-doc.md | Especificado |
| 2026-03-30 | Ficha de Anamnese Digital com Assinatura Eletrônica | outputs/po/anamnese-assinatura-digital-doc.md | Especificado |
| 2026-04-13 | Fichas de Avaliação Expandidas (categorias + por cliente + redesign config) | outputs/po/fichas-avaliacao-expandidas-doc.md | Especificado |
| 2026-04-21 | Galeria de Fotos e Comparação de Evolução | outputs/po/galeria-fotos-evolucao-doc.md | Especificado |

---

## Decisões de Produto Registradas

> Decisões que impactam o escopo ou direção do produto, documentadas para referência futura.

| Data | Decisão | Contexto |
|------|---------|----------|
| 2026-03-24 | Infraestrutura de upload de arquivos (pre-signed URL + Cloudflare R2) deve ser issue separada e pré-requisito do Item 20 | R2 tem zero egress fee no Railway, compatível com S3 SDK — escolha ideal para MVP |
| 2026-03-24 | Fotos e medidas corporais são dados sensíveis de saúde (LGPD Art. 11) — URLs sempre temporárias (TTL 1h), bucket privado | Evita exposição permanente de dados clínicos |
| 2026-03-24 | **DP-01** Promoção em cobrança: **(A) Sugestão com confirmação** — banner âmbar no ReceiveManualModal, não auto-aplicar | Recepcionista pode intencionalmente não aplicar; auto-apply cria risco financeiro sem rastreabilidade |
| 2026-03-24 | **DP-02** Promoção em venda de pacote: **(A) Bloquear** (RB-05 mantido) | Pacote tem preço próprio; desconto via promoção criaria dupla complexidade. Extensão futura via produto "promoção de pacote" |
| 2026-03-24 | **DP-04** Múltiplas promoções ativas: **(A) Maior desconto** (RN-PR04 mantido) | Mais intuitivo; admin que quer exclusividade deve desativar as demais |
| 2026-03-24 | **DP-05** Idempotency-Key TTL: **(B) 7 dias** | 24h curto para problemas percebidos após fim de semana; sem expiração acumula dados desnecessários |
| 2026-03-24 | **DP-06** Pacote expirado com sessões AGENDADO: **(B) Alerta visual na UI** (não cron/WhatsApp) | Badge âmbar na aba de pacotes do cliente e na listagem de agendamentos. WhatsApp ao cliente = evolução futura |
| 2026-03-24 | **DP-07** GET /packages/sold filtros: **(B) Período + cliente + status + serviceId** | Tela de gestão financeira; custo marginal de implementar completo vs. refatorar depois |
| 2026-03-30 | **DP-08** Assinatura de anamnese segue exatamente o padrão de contratos (`/sign/[token]`) — nova rota `/anamnese/[token]` com `SignatureCanvas` reutilizado | Consistência UX; cliente já conhece o fluxo; componente compartilhável |
| 2026-03-30 | **DP-09** AnamnesisRequest armazena snapshot das perguntas no momento do envio | Imutabilidade — alterações futuras no formulário da clínica não afetam fichas já enviadas |
| 2026-03-30 | **DP-10** Criação do ClinicalRecord (type=anamnesis) deve ser atômica com a assinatura (transação Prisma) | Garantia de consistência: ficha nunca é marcada como assinada sem o registro clínico correspondente |
| 2026-04-13 | **DP-11** Categoria DERMATO_FUNCIONAL separada de CORPORAL | Dermato é especialidade específica; permite ocultar a categoria para clínicas gerais |
| 2026-04-13 | **DP-12** Fichas personalizadas participam do comparativo de sessões | Lógica existente por `sheetId` já funciona sem alteração |
| 2026-04-13 | **DP-13** Sessão pode misturar fichas system e customer | Sessão é container neutro; separação apenas na UI de seleção |
| 2026-04-13 | **DP-14** Templates da biblioteca em código (constante), não em seed SQL | Sempre typesafe, versionado com o código |
| 2026-04-21 | **DP-15** `CustomerPhoto.takenAt` definida pelo usuário (não data do upload nem EXIF) | Permite retroativamente incluir fotos antigas; data do arquivo pode diferir de quando foto foi tirada no contexto clínico |
| 2026-04-21 | **DP-16** Fotos de sessões de avaliação criam registros `CustomerPhoto` com `sessionId` preenchido — galeria é ponto único de verdade | Evita duplicação; sessão referencia a foto, não armazena binário próprio |
| 2026-04-21 | **DP-17** URL das fotos nunca permanente — sempre pre-signed TTL 1h, gerada sob demanda | LGPD: fotos são dados sensíveis de imagem corporal; URL permanente exporia dado clínico indefinidamente |
