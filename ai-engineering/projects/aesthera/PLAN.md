# Aesthera — Plano de Desenvolvimento

## Filosofia
Cada fase entrega **backend + frontend juntos** — ao final de cada fase você consegue
abrir o navegador e usar o que foi construído. Nenhuma fase entrega só código invisível.

---

## Fase 1 — "Consigo acessar o sistema"

**Objetivo**: abrir o navegador, ver a tela de login, entrar e ver o dashboard.

### Backend
- [x] Setup do projeto (Fastify + Prisma + Docker + PostgreSQL + Redis)
- [x] Prisma schema completo (todas as tabelas — schema definitivo antes de qualquer código)
- [x] Módulo Auth: registro de clínica, login, logout, refresh token
- [x] Tenant Middleware: slug → clinic_id via Redis/DB
- [x] Health check endpoint (`GET /health`)

### Frontend
- [x] Setup Next.js 15 + Tailwind + TanStack Query
- [x] Configuração de subdomínio local para dev (`clinica.localhost`)
- [x] Tela de login (`/login`)
- [x] Tela de registro de clínica (`/register`)
- [x] Tela de verificação de email (`/verify-email`)
- [x] Tela de recuperação de senha (`/forgot-password` e `/reset-password`)
- [x] Shell do dashboard (sidebar, header, área de conteúdo) — layout vazio
- [x] Rota protegida: redireciona para login se não autenticado

### Resultado
> Você acessa `clinicaana.localhost/login`, entra com e-mail e senha, e vê o dashboard vazio.

---

## Fase 2 — "Consigo configurar minha clínica"

**Objetivo**: configurar dados da clínica, horários de funcionamento e criar usuários da equipe.

### Backend
- [x] Módulo Clinics: `GET /clinics/me`, `PATCH /clinics/me`, business hours
- [x] Módulo Users: listagem, convite por email, roles (admin/staff)
- [x] Guard de role: `staff` não acessa rotas restritas

### Frontend
- [x] Página Configurações → aba Clínica (nome, telefone, endereço)
- [x] Página Configurações → aba Horários de funcionamento (grid por dia da semana)
- [x] Página Configurações → aba Usuários (lista + botão convidar)
- [x] Flow de aceitar convite (`/accept-invite?token=...`)

### Resultado
> Você configura o nome da clínica, define que funciona seg–sex 8h–18h e convida uma recepcionista.

---

## Fase 3 — "Consigo cadastrar minha equipe e serviços"

**Objetivo**: ter profissionais e serviços no sistema — base para os agendamentos.

### Backend
- [x] Módulo Professionals: CRUD + working hours + assign services
- [x] Módulo Services: CRUD (catálogo de tratamentos)
- [x] Módulo Customers: CRUD + filtros

### Frontend
- [x] Página Profissionais: lista + criar/editar + horários individuais
- [x] Página Serviços: lista + criar/editar (nome, duração, preço, categoria)
- [x] Página Clientes: lista + criar/editar + página de detalhe do cliente

### Resultado
> Você cadastra "Ana" como dermatologista que faz "Botox" (60min, R$350) e "Limpeza de pele" (45min, R$180).
> Você cadastra o primeiro cliente.

---

## Fase 4 — "Consigo agendar e ver o calendário"

**Objetivo**: o coração do sistema — agendar um atendimento e visualizá-lo no calendário.

### Backend
- [x] Módulo Appointments: CRUD + state machine completa
- [x] `GET /appointments/availability` — slots livres por profissional + dia
- [x] `GET /appointments/calendar` — visão dia/semana agrupada por profissional
- [x] Blocked slots: criar, listar, remover
- [x] Cron / scheduler: lembrete D-1 (BullMQ delayed job)

### Frontend
- [x] Página Calendário: visão do dia/semana com grade por profissional
- [x] Modal de novo agendamento: escolher cliente → profissional → serviço → slot disponível
- [x] Modal de detalhe do agendamento: ver info + mudar status (confirmar, iniciar, concluir, cancelar)
- [x] Gerenciar bloqueios de agenda (folga, almoço, ausência)

### Resultado
> Você abre o calendário, vê a agenda da Ana no dia de hoje, clica em um horário livre,
> seleciona o cliente e o serviço, e o agendamento aparece no calendário.

---

## Fase 5 — "Consigo cobrar o cliente"

**Objetivo**: após o atendimento, o sistema gera a cobrança e envia o link de pagamento.

### Backend
- [x] Módulo Billing: criação automática em `appointment.completed` + cancelamento
- [x] Módulo Payments: integração Stripe (cartão) + MercadoPago (PIX + boleto)
- [x] Webhooks: `POST /payments/webhooks/stripe` e `/mercadopago`
- [x] Página pública de pagamento (`GET /pay/:token`)
- [x] Módulo Ledger: entry criada em `payment.succeeded`

### Frontend
- [x] Página Cobranças: lista com status (pending, paid, overdue, cancelled)
- [x] Detalhe da cobrança: valor, status, botão "reenviar link"
- [x] Página pública de pagamento (`/pay/[token]`) — responsiva para celular
- [x] Página Financeiro: resumo do ledger (total recebido, total pendente, net)

### Resultado
> Você conclui o atendimento da Ana → o sistema cria a cobrança de R$350 automaticamente
> → envia o link → o cliente paga via PIX → status vira "pago" no dashboard.

---

## Fase 6 — "O sistema avisa os clientes automaticamente"

**Objetivo**: WhatsApp e email saem automaticamente nos momentos certos — sem ação manual.

### Backend
- [x] Integração WhatsApp: Z-API ou Evolution API HTTP client
- [x] Integração Resend: templates de email
- [x] Módulo Notifications: filas BullMQ (whatsapp + email)
- [x] Triggers: confirmação de agendamento, D-1 reminder, link de pagamento, recibo
- [x] Logs de notificação + retry manual

### Frontend
- [x] Página Notificações: log de envios (status, canal, evento, data)
- [x] Botão "reenviar" em caso de falha

### Resultado
> O cliente recebe WhatsApp: "Seu agendamento amanhã às 14h com Ana está confirmado."
> No dia seguinte paga via PIX e recebe o recibo no WhatsApp automaticamente.

---

## Fase 7 — "Consigo ver como está meu negócio"

**Objetivo**: visão financeira e operacional consolidada.

### Backend
- [x] `GET /ledger/summary` — total créditos, débitos, saldo líquido por período
- [x] Filtros e aggregations para o dashboard

### Frontend
- [x] Dashboard home: cards de resumo (receita hoje, receita do mês, agendamentos, serviços, vendas, a receber)
- [x] Gráfico de receita por semana/mês (página Financeiro)
- [x] Taxa de ocupação por profissional (dashboard)
- [x] Filtros de período (páginas Financeiro e Relatórios)
- [x] Briefing IA widget (dashboard, usa Gemini 1.5 Flash)
- [x] Página Relatórios: clientes, vendas, serviços, estoque com gráficos

### Resultado
> Você abre o dashboard e vê: "12 agendamentos hoje · R$4.200 recebidos este mês · R$800 pendentes"

---

## Fase 8 — "O sistema me ajuda a trabalhar mais rápido"

**Objetivo**: IA embutida que conhece o sistema e responde perguntas em linguagem natural.

### Backend
- [x] Integração Google Gemini 1.5 Flash (`@ai-sdk/google` + Vercel AI SDK)
- [x] Módulo AI: `POST /ai/chat` (streaming SSE) · `POST /ai/summary/customer/:id` · `POST /ai/briefing`
- [x] Function calling: tools que consultam agendamentos, clientes, cobranças, financeiro
- [x] Histórico de conversa no Redis (TTL 1h, janela de 20 mensagens)
- [x] Rate limiting: 30 req/hora por clínica
- [x] Cache de summaries e briefing (Redis)

### Frontend
- [x] Chat panel flutuante (botão bottom-right em todas as páginas)
- [x] Streaming de resposta em tempo real
- [x] Indicador de tool call ("Consultando agendamentos...")
- [x] Prompts sugeridos na primeira abertura
- [x] Botão "Resumo IA" na ficha do cliente
- [x] Widget de briefing no dashboard home

### Resultado
> Você digita "Quais cobranças estão vencidas essa semana?" e a IA responde com a lista.
> Você abre a ficha da Maria e clica "Resumo IA" — a IA resume os últimos 5 atendimentos e o saldo devedor.

---

## Fase 9 — "Gestão avançada de recursos e fidelização"

**Objetivo**: controle operacional completo — equipamentos, salas, insumos, pacotes, vouchers e promoções.

### Backend
- [x] Módulo Equipment: CRUD de equipamentos + vínculo com agendamentos (`AppointmentEquipment`)
- [x] Módulo Rooms: CRUD de salas de atendimento + vínculo com agendamentos
- [x] Módulo Supplies: CRUD de insumos + estoque + `minStock` + vínculo com serviços (`ServiceSupply`) + compras de insumos com fator de conversão e estorno de estoque no cancelamento (`SupplyPurchase`)
- [x] Módulo Wallet: vouchers, créditos, cashback, saldo de pacote — com log de transações append-only
- [x] Módulo Promotions: códigos de desconto (PERCENTAGE / FIXED) com janela de validade, `maxUses`, `minAmount` e filtro por serviço
- [x] Módulo Packages: pacotes de serviços com pré-geração de sessões + resgate + integração com Wallet

### Frontend
- [x] Página Equipamentos: lista + criar/editar + toggle ativo
- [x] Página Salas: lista + criar/editar + toggle ativo
- [x] Página Insumos: lista com badge de estoque + criar/editar + alerta de estoque baixo
- [x] Página Compras de Insumos: filtros por período/insumo/fornecedor + preview de conversão/estoque + cancelamento com feedback de erro
- [x] Página Carteira (por cliente): lista de entradas + criar voucher/crédito + ajuste de saldo
- [x] Visão geral da carteira: toggle "Visão geral" / "Por cliente", tabela paginada, busca por cliente, filtros reutilizados
- [x] Página Promoções: lista + criar/editar + contador de usos + validar código
- [x] Página Pacotes: lista + criar/editar + comprar pacote + ver sessões do cliente

### Resultado
> Você cadastra o pacote "Botox 5 sessões" por R$1.500, vende para a Maria, ela usa 3 sessões,
> e o sistema rastreia o saldo restante na carteira dela automaticamente.

---

---

## FASE 1 — Fundação (Base do Sistema)

> Issues criadas a partir do roadmap (#42–#49). Itens de padronização e qualidade do sistema.

- [x] #42 — Padronizar nomenclaturas do sistema para Português do Brasil (`overdue: 'Vencido'` em billing/page.tsx; auditoria confirmou todos os demais textos já em PT-BR)
- [x] #44 — Revisar e simplificar lógica de resolução de slug (tenant): middleware.ts com redirect `/sem-acesso` para bare localhost; tenant.middleware.ts com cache `{clinicId,status}` e erros descritivos; README com seção multi-tenant dev; clinics.md atualizado
- [ ] #44 — Revisar e simplificar lógica de resolução de slug (tenant)
- [x] Refatorar autenticação: login por e-mail sem slug manual, CNPJ opcional no cadastro, CNPJ validado nas Configurações e transferência de empresa por e-mail
- [x] #45 — Exibir clínica e usuário logado no header/sidebar
- [x] #46 — Controle de acesso por perfil de usuário no frontend
- [x] #47 — Auto-preenchimento de endereço por CEP (ViaCEP)
- [x] #48 — Máscaras de entrada para CPF, CNPJ, telefone e CEP
- [x] #49 — Cadastro e configuração de formas de pagamento da clínica

---

## FASE 2 — Financeiro Avançado

> Issues criadas a partir do roadmap (#64–#66). Contas a Pagar, Recebimento Manual e tratamento de excedente.

- [x] #64 — Módulo Contas a Pagar: `AccountsPayable` CRUD backend + cron OVERDUE + integração Ledger (débito) + auto-criação a partir de `SupplyPurchase` + página `/contas-a-pagar` com cards de resumo, filtros e tabela
- [x] #65 — Recebimento Manual com Múltiplas Formas de Pagamento: `ManualReceipt` + `ManualReceiptLine` + `POST /billing/:id/receive` + modal `ReceiveManualModal` substituindo `PaymentModal` em Cobranças
- [x] #66 — Troco e Excedente no Recebimento: campo `overpaymentHandling` (discriminated union `cash_change | wallet_credit | wallet_voucher`) no endpoint e no modal — quando `totalPaid > billing.amount` o usuário escolhe como tratar o excedente

---

## Fase 10 — Pendente / Não implementado

> Itens identificados no código ou features que ainda não foram construídos.

### Backend
- [ ] Módulo Contracts: contratos digitais com assinatura eletrônica (`features/contracts.md` existe, código não)
- [ ] `clinical.service.ts` ausente — módulo clinical só tem dto, repository e routes

### Frontend
- [ ] Página Vendas (`/sales`) — pasta existe no frontend mas página não consta no PLAN
- [ ] Página Prontuário Clínico — tela de detalhe do histórico clínico por cliente

---

## Resumo das Fases

| Fase | O que você vê no final | Status |
|------|------------------------|--------|
| 1 | Login + dashboard vazio | ✅ Concluída |
| 2 | Configurações da clínica + usuários | ✅ Concluída |
| 3 | Profissionais + serviços + clientes | ✅ Concluída |
| 4 | **Calendário + agendamentos** | ✅ Concluída |
| 5 | **Cobranças + pagamentos PIX/cartão** | ✅ Concluída |
| 6 | WhatsApp automático | ✅ Concluída |
| 7 | Dashboard financeiro | ✅ Concluída |
| 8 | IA embutida (chat + resumos + briefing) | ✅ Concluída |
| 9 | Equipamentos, salas, insumos, pacotes, wallet, promoções | ✅ Concluída |
| 10 | Contracts, clinical service, sales page | 🔲 Pendente |

> Fases 4 e 5 são as mais complexas e o core do produto.
> Fases 1–3 são fundação — rápidas de fazer, essenciais para o resto funcionar.

---

## Histórico de Atualizações

### [2026-03-23] — #64 #65 #66 — Contas a Pagar, Recebimento Manual e Troco/Excedente
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(enum `AccountsPayableStatus`, modelos `AccountsPayable`, `ManualReceipt`, `ManualReceiptLine`)*
  - `aesthera/apps/api/prisma/migrations/20260323230147_feat_accounts_payable_manual_receipts/migration.sql` *(novo)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.dto.ts` *(novo)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.repository.ts` *(novo)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.service.ts` *(novo)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.routes.ts` *(novo)*
  - `aesthera/apps/api/src/modules/manual-receipts/manual-receipts.dto.ts` *(novo)*
  - `aesthera/apps/api/src/modules/manual-receipts/manual-receipts.service.ts` *(novo)*
  - `aesthera/apps/api/src/modules/manual-receipts/manual-receipts.routes.ts` *(novo)*
  - `aesthera/apps/api/src/app.ts` *(registrados novos módulos)*
  - `aesthera/apps/api/src/modules/supply-purchases/supply-purchases.service.ts` *(auto-criação de AP)*
  - `aesthera/apps/web/lib/hooks/use-accounts-payable.ts` *(novo)*
  - `aesthera/apps/web/lib/hooks/use-appointments.ts` *(hook `useCreateManualReceipt`)*
  - `aesthera/apps/web/lib/nav-items.ts` *(item `/contas-a-pagar`)*
  - `aesthera/apps/web/app/(dashboard)/contas-a-pagar/page.tsx` *(novo)*
  - `aesthera/apps/web/components/receive-manual-modal.tsx` *(novo)*
  - `aesthera/apps/web/app/(dashboard)/billing/page.tsx` *(usa `ReceiveManualModal`)*
- **O que foi feito:**
  - `#64`: Módulo `AccountsPayable` backend completo (CRUD, marcar pago/cancelado, cron OVERDUE, resumo); integração com Ledger (entrada de débito ao pagar); `SupplyPurchase.create()` cria automaticamente um AP vinculado; página `/contas-a-pagar` com 3 cards de resumo (Total Pendente, Total Vencido, Pago no Mês), filtros por fornecedor/status/período, tabela com badge de origem, diálogos de nova conta e registrar pagamento.
  - `#65`: Endpoint `POST /billing/:id/receive` que aceita múltiplas linhas de pagamento (`ManualReceiptLine`) com método e valor por linha; cria `ManualReceipt` + linhas em transação atômica, debita entradas de carteira usadas como pagamento, gera entradas de crédito no Ledger; modal `ReceiveManualModal` com linhas dinâmicas e exibição em tempo real do total pago vs. valor da cobrança.
  - `#66`: Quando `totalPaid > billing.amount`, campo `overpaymentHandling` é obrigatório. Opções: `cash_change` (apenas anota o troco), `wallet_credit` (cria entrada de crédito na carteira), `wallet_voucher` (cria voucher nominal ao cliente). Seção dinâmica no modal exibe opções de rádio somente quando há excedente.
- **Impacto:** Clínicas podem controlar suas contas a pagar (geradas manualmente ou automaticamente via compras de insumos). Recebimentos de cobranças passam a aceitar qualquer combinação de formas de pagamento em vez de apenas um método, com tratamento adequado de troco e crédito/voucher quando o cliente paga a mais.

### [2026-03-21] — #98 #99 #100 — UX Review: carteira dual-view, select shadcn/ui em clientes, campos fiscais colapsáveis
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/products/page.tsx`
  - `aesthera/apps/web/components/ui/select.tsx` *(novo)*
  - `aesthera/apps/web/components/ui/collapsible.tsx` *(novo)*
  - `aesthera/apps/web/lib/hooks/use-wallet.ts`
- **O que foi feito:**
  - `#98`: Página Carteira agora oferece dois modos via toggle: **"Visão geral"** (tabela paginada com colunas Cliente/Tipo/Saldo/Status/Vencimento, busca client-side por nome) e **"Por cliente"** (seletor de cliente + view de cards com histórico de transações). Hook `useWalletOverview` adicionado em `use-wallet.ts`.
  - `#99`: Campo "Gênero" no formulário de clientes substituído de `<select>` nativo pelo componente `Select` do design system (custom, sem Radix UI) via `<Controller>`. Componente `select.tsx` criado com API compatível com shadcn/ui.
  - `#100`: Campos fiscais NCM, CEST e CFOP agrupados em seção colapsável "Dados fiscais (opcional)" no formulário de produtos. Componente `collapsible.tsx` criado. Estado inicial: fechado. Chevron animado indica estado aberto/fechado.
- **Impacto:** Administradores conseguem verificar overview da carteira sem selecionar cliente por vez; formulário de clientes visualmente consistente; formulário de produtos com menor carga cognitiva para usuários não-contábeis.

### [2026-03-23] — GAP-R10 — Validação de roomId obrigatório em appointments.service.create()
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/src/modules/appointments/appointments.service.ts`
  - `ai-engineering/projects/aesthera/features/appointments.md`
- **O que foi feito:** Adicionada guard explícita `if (!dto.roomId)` no método `create()` do `AppointmentsService`, lançando `AppError('Sala é obrigatória para confirmar o agendamento', 400, 'ROOM_REQUIRED')` antes do início da transação DB. A spec `appointments.md` foi atualizada com a regra R10 formalizada.
- **Impacto:** A criação de agendamentos sem `roomId` passa a ser rejeitada com erro 400. O teste `[GAP-R10]` existente em `appointments.service.test.ts` precisa ser atualizado pelo `test-guardian` para esperar o erro em vez do comportamento permissivo anterior.

### [2026-03-23] — Criação do agente test-guardian (guardião de testes e regras de negócio)
- **Arquivo(s) afetado(s):**
  - `.github/agents/test-guardian.agent.md` *(novo)*
  - `ai-engineering/prompts/test-guardian/test-guardian-prompt.md` *(novo)*
- **O que foi feito:** Criado agente `test-guardian` responsável por auditar qualidade de testes, bloquear alterações suspeitas que enfraqueçam cobertura, criar testes baseados nas regras do PO e garantir que regras de negócio críticas estejam protegidas. O agente opera com mentalidade de QA Sênior e emite relatórios estruturados com status (OK/BLOQUEADO) e recomendação de aprovar/bloquear PR.
- **Impacto:** O sistema passa a ter um guardião dedicado à integridade dos testes. Alterações indevidas em testes são detectadas e bloqueadas antes de chegar à produção.

### [2026-03-22] — Criação do agente aesthera-pipeline (orquestrador do fluxo completo)
- **Arquivo(s) afetado(s):**
  - `.github/agents/aesthera-pipeline.agent.md` *(novo)*
  - `ai-engineering/prompts/aesthera-pipeline/aesthera-pipeline-prompt.md` *(novo)*
  - `ai-engineering/projects/aesthera/DEVELOPMENT-FLOW.md` *(atualizado)*
- **O que foi feito:** Criado agente orquestrador `aesthera-pipeline` que recebe uma ideia do usuário, classifica automaticamente o trilho (complexo ou simples), e executa a cadeia completa de agentes em sequência: PO → UX + Security + Arquiteto → Consolidador → Issue-Writer. Entrega a issue pronta no GitHub sem intervenção manual entre etapas.
- **Impacto:** O usuário agora tem um único ponto de entrada para o desenvolvimento de features. Zero fricção entre as etapas do pipeline.

### [2026-03-22] — Criação do agente aesthera-consolidador + fluxo de dois trilhos
- **Arquivo(s) afetado(s):**
  - `.github/agents/aesthera-consolidador.agent.md` *(novo)*
  - `ai-engineering/prompts/aesthera-consolidador/aesthera-consolidador-prompt.md` *(novo)*
  - `ai-engineering/projects/aesthera/DEVELOPMENT-FLOW.md` *(novo)*
  - `ai-engineering/prompts/ux-reviewer/ux-reviewer-prompt.md` *(atualizado)*
  - `ai-engineering/prompts/aesthera-product-owner/aesthera-product-owner-prompt.md` *(atualizado)*
- **O que foi feito:** Criado agente `aesthera-consolidador` que recebe doc.md + revisões de UX, Security e Arquiteto e produz `spec_final.md` pronta para o issue-writer. Documentado fluxo de dois trilhos em `DEVELOPMENT-FLOW.md`: fluxo complexo (PO → revisões em paralelo → consolidador → issue-writer) e fluxo simples (direto para issue-writer). UX reviewer atualizado para também revisar specs pré-desenvolvimento (`doc.md`) com checklist próprio. Product Owner atualizado para referenciar o fluxo e salvar o doc.md no local correto.
- **Impacto:** Pipeline completo de desenvolvimento shift-left implementado. Features críticas agora passam por validação de produto, UX, segurança e arquitetura antes de qualquer linha de código.

### [2026-03-22] — Treinamento do agente aesthera-system-architect: base de conhecimento técnica + auto-treinamento
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-system-architect/system-architect-knowledge.md` *(novo)*
  - `ai-engineering/prompts/aesthera-system-architect/aesthera-system-architect-prompt.md` *(atualizado)*
- **O que foi feito:** Criado arquivo de base de conhecimento técnica (`system-architect-knowledge.md`) com: stack definitiva com versões, todos os enums do schema Prisma, tabela completa de modelos com notas-chave de cada tabela, guards de autenticação, fluxo de dados completo, fluxo appointment→billing→payment→ledger, padrões de comunicação entre módulos, estrutura de pastas do backend, decisões de arquitetura registradas e módulos pendentes. Prompt atualizado com: (1) inicialização obrigatória — agente lê a base de conhecimento antes de qualquer tarefa; (2) rotina de auto-treinamento — agente atualiza a base após cada decisão de arquitetura, alteração de schema ou padrão estabelecido.
- **Impacto:** Agente system-architect agora tem memória técnica persistente do sistema e se auto-treina a cada sessão, prevenindo contradições com decisões anteriores e garantindo consistência com o schema atual.

### [2026-03-22] — Treinamento do agente aesthera-product-owner: base de conhecimento + auto-treinamento
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-product-owner/product-owner-knowledge.md` *(novo)*
  - `ai-engineering/prompts/aesthera-product-owner/aesthera-product-owner-prompt.md` *(atualizado)*
- **O que foi feito:** Criado arquivo de base de conhecimento (`product-owner-knowledge.md`) com estado atual completo do sistema: tabela de módulos com status, perfis de usuário e permissões, regras de negócio centrais, convenções de UI e arquitetura resumida. Prompt atualizado com: (1) rotina de inicialização obrigatória — agente lê a base de conhecimento antes de qualquer tarefa; (2) rotina de auto-treinamento — agente atualiza a base de conhecimento após cada spec criada, decisão de produto ou regra de negócio definida.
- **Impacto:** Agente product-owner agora tem memória persistente do sistema e se auto-treina a cada sessão produtiva, prevenindo specs duplicadas e garantindo consistência com o estado atual do código.

### [2026-03-22] — Criação do agente aesthera-product-owner
- **Arquivo(s) afetado(s):**
  - `.github/agents/aesthera-product-owner.agent.md` *(novo)*
  - `ai-engineering/prompts/aesthera-product-owner/aesthera-product-owner-prompt.md` *(novo)*
- **O que foi feito:** Criado agente Product Owner especialista em clínicas estéticas. Transforma ideias simples em especificações completas com fluxo de usuário, regras de negócio, estados, exceções e estrutura para implementação. Inclui rotina de auto-atualização do PLAN.md.
- **Impacto:** Novo agente disponível para o projeto Aesthera. Complementa o fluxo issue-writer → implementador com uma etapa de refinamento de produto antes do desenvolvimento.

### [2026-03-22] — #93 #94 #95 #96 #97 — UX Review: ícones, KPI, busca, link, cabeçalhos de tabela
- **Arquivo(s) afetado(s):** `aesthera/apps/web/app/(dashboard)/layout.tsx`, `aesthera/apps/web/app/(dashboard)/dashboard/page.tsx`, `aesthera/apps/api/src/modules/billing/billing.dto.ts`, `aesthera/apps/api/src/modules/billing/billing.repository.ts`, `aesthera/apps/web/app/(dashboard)/billing/page.tsx`, `aesthera/apps/web/app/(dashboard)/sales/page.tsx`, `aesthera/apps/web/app/(dashboard)/notifications/page.tsx`, `aesthera/apps/web/app/(dashboard)/financial/page.tsx`, `aesthera/apps/web/app/(dashboard)/promotions/page.tsx`, `aesthera/apps/web/app/(dashboard)/reports/page.tsx`, `aesthera/apps/web/app/(dashboard)/compras-insumos/page.tsx`, `aesthera/docs/ui-standards.md`, `aesthera/apps/web/lib/hooks/use-appointments.ts`
- **O que foi feito:**
  - `#93`: Ícone `Layers` substituindo `Package` no item `/packages` da sidebar — elimina colisão visual com `/products`.
  - `#94`: KPI "A Receber" no dashboard agora exibe valor monetário real via `prisma.billing.aggregate({ _sum: { amount: true } })` retornado como `totalAmount` na resposta de `GET /billing` — elimina subestimação por paginação.
  - `#95`: Busca por cliente em Cobranças: campo com debounce 250ms no frontend; `customerName: z.string().trim().min(1).optional()` no DTO (com trim e min(1) para evitar busca vazia por espaços); filtro ILIKE por `customer.name` no repositório.
  - `#96`: Ação de link de pagamento renomeada para "Ver link" com ícone `ExternalLink` — clareza de que abre URL externa.
  - `#97`: `uppercase tracking-wide` removido de todos os `<tr>` de cabeçalho de tabela; `text-xs font-medium text-muted-foreground` padronizado em todos os `<th>`; padrão documentado na seção 2.5 de `ui-standards.md`.
- **Impacto:** Consistência visual da sidebar; KPI financeiro preciso independente do volume de cobranças; busca por cliente em Cobranças funcional; intenção do link de pagamento clara; tipografia de tabelas padronizada em todo o frontend.

### [2026-03-21] — #89 #90 #91 #92 — UX Review: busca em Vendas, notificações PT-BR, desconto, sidebar agrupada
- **Arquivo(s) afetado(s):** `aesthera/apps/api/src/modules/products/products.dto.ts`, `aesthera/apps/api/src/modules/products/products.repository.ts`, `aesthera/apps/web/app/(dashboard)/sales/page.tsx`, `aesthera/apps/web/app/(dashboard)/notifications/page.tsx`, `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`, `aesthera/apps/web/app/(dashboard)/layout.tsx`
- **O que foi feito:**
  - `#89`: Busca em Vendas conectada a query params: campo debounced `search` (OR `product.name` | `customer.name` ILIKE) no backend; preview de desconto e conversão para centavos corrigidos após Copilot review.
  - `#90`: `EVENT_LABEL` expandido para cobrir todos os 9 eventos de notificação em PT-BR; fallback seguro para eventos desconhecidos.
  - `#91`: Schema Zod do desconto corrigido: removido `.int()`, adicionado `.min(0).max(999999)`; desconto limitado com `Math.min(discountCents, unitPrice * quantity)` para evitar total negativo.
  - `#92`: Sidebar agrupada com `GROUP_ORDER` e rótulos de seção (Agenda, Financeiro, Estoque, Configurações).
- **Impacto:** Busca em Vendas funcional por produto e cliente; notificações exibem eventos em PT-BR; desconto nunca excede subtotal; sidebar organizada com grupos visuais.

### [2026-03-21] — #86 #87 #88 — LGPD anonimização, audit log estruturado e limpeza de env JWT
- **Arquivo(s) afetado(s):** `aesthera/apps/api/prisma/schema.prisma`, `aesthera/apps/api/prisma/migrations/20260321215233_add_audit_log/migration.sql`, `aesthera/apps/api/src/shared/audit.ts`, `aesthera/apps/api/src/config/env.ts`, `aesthera/apps/api/src/config/app.config.ts`, `aesthera/apps/api/.env.example`, `aesthera/apps/api/src/modules/clinical/clinical.routes.ts`, `aesthera/apps/api/src/modules/payments/payments.service.ts`, `aesthera/apps/api/src/modules/customers/customers.service.ts`, `aesthera/apps/api/src/modules/customers/customers.routes.ts`, `aesthera/apps/api/src/modules/users/users.routes.ts`
- **O que foi feito:**
  - `#88`: Removido `JWT_REFRESH_SECRET` do schema Zod (`env.ts`), do `app.config.ts` e do `.env.example`. Documentado que refresh tokens são opacos gerenciados via Redis (hash SHA-256), não JWT assinados.
  - `#87`: Criado modelo `AuditLog` no schema Prisma com migration SQL. Helper `createAuditLog()` disponível em `src/shared/audit.ts`. Instrumentadas as ações críticas: criação/atualização de prontuário clínico, confirmação de pagamento e mudança de role de usuário. Cada log contém `clinicId`, `userId`, `action`, `entityId`, `ip`, `createdAt`.
  - `#86`: `DELETE /customers/:id` requer role `admin` e executa anonimização LGPD atômica via `prisma.$transaction`: exclui `ClinicalRecord` fisicamente e substitui todos os campos PII por valores anônimos. Preserva `Appointment` e `Billing` para auditoria fiscal. Retorna `204 No Content`.
- **Impacto:** Conformidade LGPD Art. 18 para dados de saúde; trilha de auditoria para investigação forense; configuração de ambiente limpa sem variável órfã.

### [2026-03-21] — #82 #83 #84 #85 — Correções de segurança: anti-prompt-injection, PII, mock payment, rate limiting auth
- **Arquivo(s) afetado(s):** `aesthera/apps/api/src/modules/ai/ai.service.ts`, `aesthera/apps/api/src/modules/payments/payments.routes.ts`, `aesthera/apps/api/src/modules/auth/auth.routes.ts`, `aesthera/apps/api/src/modules/ai/ai.service.test.ts`, `aesthera/apps/api/src/modules/payments/payments.routes.test.ts`, `aesthera/apps/api/src/modules/auth/auth.routes.test.ts`
- **O que foi feito:**
  - `#82`: system prompt do chat de IA reforçado com bloco `REGRAS ABSOLUTAS` anti-prompt-injection — o modelo nunca segue instruções embutidas no input do usuário nem revela estrutura interna do sistema.
  - `#83`: campos `phone` e `email` removidos dos retornos de `getAppointmentsToday` e `getOverdueBilling` — menor privilégio aplicado / conformidade LGPD.
  - `#84`: `process.env.NODE_ENV === 'production'` substituído por `appConfig.isProduction` no endpoint mock de pagamento — consistência com o critério de produção definido por `AMBIENTE_DEV !== 'S'`.
  - `#85`: rate limiting por rota configurado nas rotas sensíveis de autenticação via `config.rateLimit` do `@fastify/rate-limit`: login (10/min), recover-access (5/15min), resend-verification (3/15min), register (5/hora).
- **Impacto:** Superfície de ataque reduzida no módulo de IA (prompt injection + dados PII); endpoint de pagamento mock protegido em staging; rotas de autenticação protegidas contra brute-force e spam de email.

### [2026-03-20] — #49 — Cadastro e configuração de formas de pagamento da clínica
- **Arquivo(s) afetado(s):** `aesthera/apps/api/prisma/schema.prisma`, `aesthera/apps/api/prisma/migrations/20260320_payment_method_config/migration.sql`, `aesthera/apps/api/src/modules/clinics/payment-method-config.ts`, `aesthera/apps/api/src/modules/clinics/clinics.dto.ts`, `aesthera/apps/api/src/modules/clinics/clinics.repository.ts`, `aesthera/apps/api/src/modules/clinics/clinics.routes.ts`, `aesthera/apps/api/src/modules/clinics/clinics.service.ts`, `aesthera/apps/api/src/modules/clinics/clinics.service.test.ts`, `aesthera/apps/api/src/modules/billing/billing.service.ts`, `aesthera/apps/api/src/modules/billing/billing.service.test.ts`, `aesthera/apps/api/src/modules/payments/payments.service.ts`, `aesthera/apps/api/src/modules/appointments/appointments.service.ts`, `aesthera/apps/web/lib/hooks/use-settings.ts`, `aesthera/apps/web/app/(dashboard)/settings/_components/payment-methods-tab.tsx`, `aesthera/apps/web/app/(dashboard)/settings/page.tsx`, `ai-engineering/projects/aesthera/features/clinics.md`, `ai-engineering/projects/aesthera/features/billing.md`
- **O que foi feito:** Criado o modelo `PaymentMethodConfig` com migration Prisma, endpoints `GET/PUT /clinics/me/payment-methods`, validações de negócio para ao menos uma forma ativa e parcelamento dependente de cartão, centralização da criação de billing usando a configuração da clínica, fallback seguro do método de pagamento para gateway, nova aba `Formas de pagamento` em `/settings` e testes unitários cobrindo defaults, validações e geração de cobrança.
- **Impacto:** Clínica agora consegue configurar meios de pagamento e regras de parcelamento/duplicata; novas cobranças passam a refletir a configuração persistida por tenant.

### [2026-03-20] — #47 — Ajustes pós-code-review do PR de CEP
- **Arquivo(s) afetado(s):** `aesthera/apps/web/lib/hooks/use-cep-lookup.ts`, `aesthera/apps/web/lib/hooks/use-resources.ts`, `ai-engineering/projects/aesthera/features/clinics.md`
- **O que foi feito:** Eliminada condição de corrida no hook do ViaCEP com cancelamento de requisição anterior e descarte de respostas obsoletas. Criados tipos de input específicos para create/update de profissionais, impedindo `address: null` no frontend. Corrigida indentação do bloco de modelo em `clinics.md`.
- **Impacto:** Robustez do auto-preenchimento por CEP no frontend e alinhamento de tipagem entre frontend e backend para profissionais.

### [2026-03-20] — #47 — Auto-preenchimento de endereço por CEP (ViaCEP)
- **Arquivo(s) afetado(s):** `aesthera/apps/web/lib/hooks/use-cep-lookup.ts`, `aesthera/apps/web/app/(dashboard)/customers/page.tsx`, `aesthera/apps/web/app/(dashboard)/settings/_components/clinic-tab.tsx`, `aesthera/apps/web/app/(dashboard)/professionals/page.tsx`, `aesthera/apps/web/lib/hooks/use-resources.ts`, `aesthera/apps/web/lib/hooks/use-settings.ts`, `aesthera/apps/api/prisma/schema.prisma`, `aesthera/apps/api/prisma/migrations/20260320_professionals_address_via_cep/migration.sql`, `aesthera/apps/api/src/modules/professionals/professionals.dto.ts`, `aesthera/apps/api/src/modules/professionals/professionals.service.test.ts`, `ai-engineering/projects/aesthera/features/customers.md`, `ai-engineering/projects/aesthera/features/professionals.md`, `ai-engineering/projects/aesthera/features/clinics.md`
- **O que foi feito:** Criado hook reutilizável `useCepLookup()` com integração ViaCEP e tratamento de CEP inválido, CEP inexistente e erro de rede. Integrado auto-preenchimento de endereço nos formulários de clientes, configurações da clínica e profissionais, com loader inline e campos ainda editáveis. Estendido o módulo de profissionais para persistir `address` em JSONB e adicionados testes unitários do service para criação/atualização com endereço.
- **Impacto:** UX de cadastro mais rápida e consistente em todos os formulários com endereço; módulo de profissionais agora suporta o escopo descrito pela issue sem depender de preenchimento manual completo.

### [2026-03-20] — #48 — Máscaras de entrada para CPF, CNPJ, telefone e CEP
- **Arquivo(s) afetado(s):** `aesthera/apps/web/package.json`, `components/ui/masked-input-cpf.tsx`, `components/ui/masked-input-cnpj.tsx`, `components/ui/masked-input-phone.tsx`, `components/ui/masked-input-cep.tsx`, `app/(dashboard)/customers/page.tsx`, `app/(dashboard)/settings/_components/clinic-tab.tsx`, `app/(dashboard)/professionals/page.tsx`
- **O que foi feito:** Adicionada dependência `react-imask ^7.6.1`. Criados 4 componentes reutilizáveis de campo mascarado para CPF (`000.000.000-00`), CNPJ (`00.000.000/0000-00`), telefone (dinâmico fixo/celular) e CEP (`00000-000`). Componentes integrados com React Hook Form via `Controller`. Valor armazenado e enviado ao backend sempre sem máscara (apenas dígitos). Funções de máscara manuais (`applyCpfMask`, `applyPhoneMask`, `applyCepMask`, `applyCnpjMask`) removidas dos arquivos de página. Normalização de dados legados adicionada em `fromCustomer` e no `reset()` da clínica.
- **Impacto:** UX — campos de CPF, CNPJ, telefone e CEP agora exibem máscara durante digitação em todos os formulários de clientes, clínica e profissionais.

---

### [2026-03-20] — Treinamento do agente aesthera-issue-writer: completude, impacto e testes
- **Arquivo(s) afetado(s):** `ai-engineering/prompts/aesthera-issue-writer/aesthera-issue-writer-prompt.md`
- **O que foi feito:** Adicionadas três novas regras ao agente: (1) **Regra de Completude** — nunca criar navegação/link sem a página de destino inclusa no escopo; (2) **Análise de Impacto** — identificar e documentar todos os módulos/arquivos afetados por uma mudança; (3) **Regras de Testes** — critérios claros de quando exigir, sugerir ou omitir testes unitários/automatizados. Template da issue atualizado com novas seções "Impacto em Outros Módulos" e "Testes". Checklist de consistência atualizado com os três novos pontos de validação.
- **Impacto:** Agente `aesthera-issue-writer` — issues geradas são mais completas, consistentes e seguras para o implementador executar sem surpresas.

---

### [2026-03-20] — Treinamento do agente aesthera-issue-writer: exportação de issues como arquivo local
- **Arquivo(s) afetado(s):** `ai-engineering/prompts/aesthera-issue-writer/aesthera-issue-writer-prompt.md`, `.gitignore`
- **O que foi feito:** Adicionada opção de salvar issues geradas como arquivo Markdown local em `outputs/tasks/{001-nome-da-issue}.md`. O agente agora pergunta ao usuário, após gerar a issue, se deseja criar no GitHub e/ou salvar localmente — as duas opções são independentes. Adicionado frontmatter YAML com metadados (título, módulo, tipo, data, status). A pasta `outputs/` foi adicionada ao `.gitignore` raiz para não versionar esses arquivos.
- **Impacto:** Agente `aesthera-issue-writer` — nova capacidade de exportação local de issues sem depender do GitHub

---

### [2026-03-20] — Refatoração de login por e-mail, CNPJ e transferência entre empresas
- **Arquivo(s) afetado(s):** aesthera/apps/api/src/modules/auth/auth.service.ts, aesthera/apps/api/src/modules/clinics/clinics.service.ts, aesthera/apps/api/src/modules/users/users.service.ts, aesthera/apps/web/app/(auth)/login/page.tsx, aesthera/apps/web/app/(dashboard)/settings/_components/clinic-tab.tsx
- **O que foi feito:** login sem slug manual com resolução automática por e-mail, CNPJ opcional no cadastro, validação forte e lookup de CNPJ nas Configurações, tokens de transferência por e-mail para cadastro e convite, página pública de confirmação/rejeição
- **Impacto:** autenticação e onboarding ficaram mais simples no frontend; backend passou a suportar transferência segura de acesso entre clínicas e validação centralizada de CNPJ

### [2026-03-20] — #55 — Fluxo de conflito de e-mail no cadastro — distinção admin vs membro com confirmação prévia

### [2026-03-20] — #56 — Lógica de colisão de slug — recuperação de conta e confirmação de troca
- **Arquivo(s) afetado(s):** aesthera/apps/api/src/modules/auth/auth.repository.ts, aesthera/apps/api/src/modules/auth/auth.service.ts, aesthera/apps/web/app/(auth)/register/page.tsx, ai-engineering/projects/aesthera/features/auth-refactor-cnpj-login.md
- **O que foi feito:** Adicionada verificação `SLUG_LINKED_SAME_CLINIC` em `registerClinic()` antes do `uniqueSlug()`, nos dois branches (produção com `confirmTransfer: true` e fresh registration). Quando o slug base já existe e o usuário tem vínculo ativo com aquela mesma clínica, o fluxo é bloqueado com `409 SLUG_LINKED_SAME_CLINIC`. Frontend trata esse código exibindo Dialog com opção "Recuperar acesso" (chama `POST /auth/recover-access`) e "Cancelar" — sem oferecer "continuar cadastrando". Adicionado `name` ao select de `findClinicBySlug()` no repository. Spec atualizada com seção 5 sobre colisão de slug.
- **Impacto:** Cenário A (usuário esqueceu senha e tenta re-cadastrar a mesma clínica) agora é tratado corretamente com oferta de recuperação de acesso, ao invés de criar uma segunda clínica duplicada.

---

### [2026-03-20] — #54 — Remoção do campo CNPJ da tela de cadastro de empresa
- **Arquivo(s) afetado(s):** aesthera/apps/web/app/(auth)/register/page.tsx, ai-engineering/projects/aesthera/features/auth-refactor-cnpj-login.md
- **O que foi feito:** Removido completamente o campo CNPJ (label, Input, máscara, validação Zod, handlers e payload) do formulário `/register`. Backend `auth.dto.ts` já estava plenamente compatível com `undefined` no campo `clinicDocument`. Spec da feature atualizada na seção 2a para refletir a nova decisão.
- **Impacto:** Onboarding simplificado — empresa pode ser criada sem CNPJ e preencher depois em Configurações.

---

### [2026-03-20] — #61 — Recuperação de Senha: telas "/forgot-password" e "/reset-password"
- **Arquivo(s) afetado(s):** aesthera/apps/web/app/(auth)/login/page.tsx, aesthera/apps/web/app/(auth)/forgot-password/page.tsx (novo), aesthera/apps/web/app/(auth)/reset-password/page.tsx (novo)
- **O que foi feito:** Adicionado link "Esqueci minha senha" na tela de login (abaixo do campo de senha, alinhado à direita). Criada página `/forgot-password` com formulário de e-mail que chama `POST /auth/forgot-password` sem header X-Clinic-Slug; exibe mensagem de sucesso genérica independente do email existir (preventing user enumeration). Criada página `/reset-password` com leitura do `?token=` via `useSearchParams`; formulário com campos "Nova senha" e "Confirmar nova senha" com validação Zod (mín. 8 caracteres, 1 maiúscula, 1 número, 1 especial, confirmação igual); chama `POST /auth/reset-password` com `{ token, password }`; estados de sucesso, erro de token inválido/expirado e token ausente, todos com links de navegação.
- **Impacto:** Elimina o erro 404 para usuários que já receberam emails de recuperação de senha. Fluxo completo de recuperação disponível no frontend.

---

### [2026-03-20] — #45 e #46 — Clínica/usuário no header e controle de acesso por perfil no frontend
- **Arquivo(s) afetado(s):** `aesthera/apps/web/lib/auth.ts`, `aesthera/apps/web/lib/api.ts`, `aesthera/apps/web/app/(dashboard)/layout.tsx`, `aesthera/apps/web/components/user-nav.tsx` (novo), `aesthera/apps/web/lib/hooks/use-role.ts` (novo)
- **O que foi feito:** Adicionado `decodeJwtPayload<T>()` e `getUserRole()` em `auth.ts`. Criado hook `useRole()` que extrai o perfil (`admin`/`staff`) do JWT sem chamada à API. Criado componente `UserNav` com avatar (iniciais), nome, perfil traduzido, e dropdown com "Meu perfil" e "Sair". Layout atualizado: exibe nome da clínica abaixo da marca na sidebar, `UserNav` no header direito, filtra itens de menu por role (staff não vê Cobranças, Financeiro, Relatórios, Configurações), guard de rota redireciona staff de rotas restritas para `/dashboard` com toast. Tratamento padronizado de erros 403 em `api.ts` com toast amigável em PT-BR.
- **Impacto:** Toda sessão autenticada agora exibe o contexto da clínica e do usuário. Usuários `staff` ficam limitados visualmente e por roteamento às funcionalidades operacionais.

---

### [2026-03-21] — Treinamento dos agentes issue-writer e implementador: prevenção de regressão de padrões UI
- **Arquivo(s) afetado(s):** `ai-engineering/prompts/aesthera-issue-writer/aesthera-issue-writer-prompt.md`, `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`, `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md`
- **O que foi feito:** Treinamento motivado por dois problemas identificados: (1) feature de ajuste de máscaras em grades acabou alterando filtros do cadastro de cliente que já estavam corretos; (2) tela de estoque criada com barra de filtros desalinhada e botão gravar sempre desabilitado. Mudanças aplicadas: **Issue Writer** — adicionada etapa obrigatória "Leitura Preventiva de Código Existente" antes de escrever issues que tocam telas existentes; adicionada "Regra de Preservação de Padrões UI" na seção Fora do Escopo; fortalecido checklist de consistência com dois novos pontos de verificação. **Implementador** — adicionada "Mapeamento de Zona Estável" obrigatório antes de qualquer edição em arquivo existente; adicionada "Regra de Escopo Rígido" para tasks de máscara/formatação; adicionado "Checklist de Conformidade UI" completo a ser executado antes de marcar task como concluída; reforçada regra de mudanças mínimas com referência à lista de arquivos da issue. **Code Review Learnings** — populado com 5 padrões concretos aprendidos dos problemas reportados.
- **Impacto:** Agentes `aesthera-issue-writer` e `aesthera-implementador` — prevenção proativa de: regressão de padrões UI em telas existentes, alteração de escopo indevido em tasks de formatação, botão salvar sempre desabilitado, barra de filtros desalinhada em telas novas.

---

### [2026-03-20] — Treinamento do agente aesthera-implementador: obrigatoriedade de testes unitários
- **Arquivo(s) afetado(s):** `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
- **O que foi feito:** Adicionada regra obrigatória de testes nas "Regras de Implementação". Fluxo de trabalho atualizado com passo 3 "Criar ou atualizar testes". Adicionada seção completa "Testes Unitários e Automatizados" com: framework (Vitest), localização dos arquivos (`{módulo}.service.test.ts` co-localizado), regras para código novo (sempre criar) e código existente (verificar + atualizar testes afetados), padrão de estrutura de arquivo de test com `vi.hoisted`/`vi.mock`, tabela de cenários obrigatórios e o que não testar por ora.
- **Impacto:** Agente `aesthera-implementador` — toda implementação nova ou alteração em código coberto agora exige criação/revisão de testes. Alinha com o `vitest.config.ts` existente e o teste de referência `wallet.service.test.ts`.

### [2026-03-20] — Treinamento de agentes: economia de requests e execução única

- **Arquivo(s) afetado(s):**
  - `.github/agents/aesthera-implementador.agent.md`
  - `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
  - `ai-engineering/prompts/aesthera-issue-writer/aesthera-issue-writer-prompt.md`
  - `ai-engineering/prompts/aesthera-system-architect/aesthera-system-architect-prompt.md`
  - `ai-engineering/prompts/treinador/treinador-agent-prompt.md`
- **O que foi feito:**
  - `aesthera-implementador.agent.md`: modelo padrão alterado de `Claude Sonnet 4.6` para `gpt-4.5`
  - `aesthera-implementador-prompt.md`: adicionada seção "Seleção de Modelo (pré-tarefa obrigatória)" — o agente avalia a complexidade antes de começar e recomenda GPT 4.5 (tarefas padrão) ou Claude Sonnet 4.6 (lógica complexa, bugs difíceis, arquitetura, agentes); adicionada seção "Execução Única — Sem Loops Automáticos"
  - `aesthera-issue-writer-prompt.md`: adicionada seção "Análise de Implementação" ao formato da issue — o agente pré-define endpoint, DTO/Zod, assinatura de service, query Prisma e campos de frontend para que o implementador comece sem decisões técnicas; adicionada seção "Execução Única — Sem Loops Automáticos"
  - `aesthera-system-architect-prompt.md`: adicionada seção "Execução Única — Sem Loops Automáticos"
  - `treinador-agent-prompt.md`: adicionada seção "Execução Única — Sem Loops Automáticos"
- **Impacto:** Todos os agentes agora operam no modo "executa uma vez, apresenta, para". Auto-apply e loops de refinamento automático estão desativados em todos os agentes. O implementador usa GPT 4.5 por padrão, com troca manual para Claude Sonnet 4.6 quando a tarefa for complexa.

### [2026-03-20] — Treinamento do implementador: ciclo de code review → auto-aprendizado

- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
  - `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md` (**criado**)
- **O que foi feito:**
  - Carregamento de contexto: adicionado item 7 — leitura obrigatória de `code-review-learnings.md` antes de qualquer implementação
  - Adicionada **Etapa 4 — Code Review do Copilot**: após PR aberto, o agente pergunta se o usuário quer que leia os comentários do Copilot no PR; faz triagem classificando cada item como ÚTIL ou RUÍDO (com tabela de critérios); apresenta a triagem para confirmação; aplica apenas o confirmado; commita as correções na mesma branch
  - Adicionada **Rotina de Auto-treinamento**: após processar a Etapa 4, o agente registra automaticamente os aprendizados ÚTEIS em `code-review-learnings.md` com formato padronizado (erro → correto → PR de origem)
  - Criado `code-review-learnings.md` com estrutura de categorias (Backend: segurança/multi-tenancy, validação, async, Prisma; Frontend: PT-BR, formulários, componentes; Geral: testes, arquitetura)
- **Impacto:** O implementador passa a acumular conhecimento a cada code review. Com o tempo, os erros que o Copilot apontaria já serão prevenidos antes do commit, eliminando falsos positivos e reduzindo ciclos de correção.

---

### [2026-03-20] — Treinamento do issue-writer: perguntas proativas de dependência de módulo

- **Arquivo(s) afetado(s):** `ai-engineering/prompts/aesthera-issue-writer/aesthera-issue-writer-prompt.md`
- **O que foi feito:** Adicionada seção "Análise de Dependências e Perguntas Proativas" — o agente agora, após entender o pedido, analisa onde a informação/funcionalidade criada será consumida no restante do sistema (usando `features/` e `PLAN.md`). Se identificar fluxos incompletos ou módulos relacionados que não foram mencionados, faz perguntas específicas e nomeadas antes de gerar a issue. O passo 1 e 2 do fluxo de trabalho foram atualizados para incluir essa análise. Exemplo documentado no prompt: cadastro de formas de pagamento → pergunta proativa sobre integração com tela de cobrança.
- **Impacto:** Issues geradas passam a cobrir o fluxo completo em vez de apenas a parte solicitada. Reduz o risco de criar funcionalidades orfãs (cadastros sem consumidores, links sem destino).

---

## Como usar este plano com o Copilot

Ao iniciar uma fase, abra a sessão assim:

```
#file:AGENT_RULES.md
#file:projects/aesthera/START.md
#file:projects/aesthera/context/stack.md
#file:projects/aesthera/context/architecture.md
#file:projects/aesthera/features/[modulo-da-fase].md
#file:projects/aesthera/PLAN.md

Fase X — iniciando [nome da fase]
```

> ⚠️ Após cada entrega, marque os itens concluídos neste arquivo com `[x]`.
