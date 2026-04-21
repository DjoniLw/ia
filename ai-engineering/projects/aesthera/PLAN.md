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

### [07/04/2026] — Consolidação: Melhorias no Modal de Agendamento
- **Módulo:** Appointments (modal de criação + tela de calendário)
- **O que foi feito:** Spec consolidada (artefato descartável — issue será criada pelo pipeline)

### [07/04/2026] — Consolidação: Agenda Inteligente
- **Módulo:** Appointments (novo modal SmartScheduleDialog + endpoint GET /appointments/smart-availability)
- **O que foi feito:** Spec consolidada (artefato descartável — issue será criada pelo pipeline)
- **⚠️ Questão aberta para PO:** ARCH-B6 — ServiceEquipment (filtro de equipamento por serviço). PO deve decidir antes da implementação.

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

## Fase 11 — Redesenho do Fluxo de Cobrança de Serviços

> Spec do PO: `outputs/po/redesenho-fluxo-cobranca-servicos-doc.md`
> **Spec final consolidada:** `outputs/consolidador/redesenho-fluxo-cobranca-servicos-spec-final.md`
> Status: ✅ Implementada — PR #148

### Objetivo
Desacoplar billing do agendamento e suportar 3 cenários de cobrança: pós-serviço (manual), pré-venda de serviço (com voucher) e cobrança manual avulsa.

### Backend
- [x] Migration: `serviceId` nullable em `Billing` + `@@index([clinicId, serviceId])`
- [x] Migration: `serviceId` nullable em `WalletEntry` + `@@index([clinicId, customerId, serviceId, status])`
- [x] Migration: `chargeVoucherDifference` em `Clinic`
- [x] Migration: enum `PRESALE` em `BillingSourceType`
- [x] Migration: enum `SERVICE_PRESALE` em `WalletOriginType`
- [x] `BillingService.createManual()` com roleGuard([admin, staff]) e validações SEC01-SEC06
- [x] Remover criação automática de billing em `appointment.completed`
- [x] Endpoint `POST /billing` manual (staff/admin) com DTO restrito
- [x] Endpoint `GET /wallet/service-vouchers/:customerId` (módulo wallet, não billing)
- [x] `AppointmentService.complete()` retorno normalizado `{ appointment, serviceVouchers[] }`
- [x] `WalletService.use()` valida `serviceId` + busca segura por `{ id, clinicId }`
- [x] `receivePayment` em `prisma.$transaction()` + billing complementar (appointmentId=null)
- [x] Domain event `billing.created` após commit da transação
- [x] `PATCH /clinics/me` aceitar `chargeVoucherDifference`
- [x] Atualizar `domain-event-handlers.ts` linha 18

### Frontend
- [x] `CompleteAppointmentModal` (loading/erro/sem voucher/com voucher + hierarquia de botões)
- [x] `SellServiceForm` com campos corretos, validações e toasts PT-BR
- [x] Botão "Vender Serviço" na ficha do cliente
- [x] Botão "Nova Cobrança" na tela `/billing`
- [x] `/billing`: filtro pills por `sourceType` + badges + legenda filtros + empty state
- [x] `lib/status-colors.ts`: `BILLING_SOURCE_TYPE_LABEL` + `BILLING_SOURCE_TYPE_COLOR`
- [x] `ReceiveManualModal`: prop `preSelectedVoucherId` + Alert RN13
- [x] `useAppointmentTransition.complete`: abrir modal apenas em sucesso
- [x] `wallet-labels.ts`: SERVICE_PRESALE
- [x] Ficha do cliente: botão "Vender Serviço" aba Carteira
- [x] `/settings`: toggle `chargeVoucherDifference`

### Documentação
- [x] `system-architect-knowledge.md`: revogar regra de billing automático em complete()
- [ ] `screen-mapping.md`: atualizar após implementação

---

## Fase 12 — Redesenho do Fluxo Pós-Atendimento e Correção Financeira da Pré-Venda

> Spec do PO: `outputs/po/aesthera-po-redesenho-fluxo-pos-atendimento-2026-04-03.md`
> Status: ✅ Implementada — commit `f26a47e` na branch `feat/billing-service-redesign-issue-147`

### Objetivo
Corrigir dois problemas estruturais do PR #148: (1) `CompleteAppointmentModal` expunha decisão de cobrança ao operador — vetor de erro humano; (2) Dupla contagem no Ledger ao usar voucher `SERVICE_PRESALE`.

### Backend
- [x] `appointments.service.ts::complete()` restaura criação automática de billing (RN-PA01)
- [x] `complete()` retorna `{ appointment, billing: Billing | null, serviceVouchers }` (RN-PA01–04)
- [x] `complete()` — path packageSession: sem billing, retorna `billing: null` (RN-PA02)
- [x] `complete()` — path billing `paid` existente: reutiliza, sem criar novo (RN-PA03)
- [x] `complete()` — path billing `pending/overdue` existente: reutiliza + busca vouchers (RN-PA03)
- [x] `complete()` — path geral: `billingSvc.createManual()` + busca vouchers (RN-PA01)
- [x] `manual-receipts.service.ts::receive()` — skip LedgerEntry para linha `SERVICE_PRESALE` (RN-FIN01)
- [x] `billing.service.ts::receivePayment()` — skip LedgerEntry para voucher `SERVICE_PRESALE` (RN-FIN01)

### Frontend
- [x] `use-appointments.ts` — tipo `CompleteResult` exportado + invalidação de `['wallet']` no onSuccess
- [x] `appointments/page.tsx::SlotActions` reescrito: sem `CompleteAppointmentModal`, abre `ReceiveManualModal` diretamente com voucher pré-selecionado (RN-PA04)
- [x] `CompleteAppointmentModal.tsx` removido

### Testes
- [x] `appointments.service.test.ts` — T-CP01–CP05: billing auto, packageSession, billing paid, billing pending, vouchers (5/5 ✅)
- [x] `manual-receipts.service.test.ts` — T-FIN01–FIN03: skip SERVICE_PRESALE, manter OVERPAYMENT, misto (3/3 ✅)
- [ ] T16/T17/T19 em `appointments.service.test.ts` — premissa invertida pela spec, delegado ao `test-guardian`

---

## Fase 13 — Correções de UX e Regras de Negócio da Pré-Venda

> Commit: `d2a3d53` na branch `feat/billing-service-redesign-issue-147`

### Backend
- [x] `wallet.service.ts::use()` — bypass da checagem de saldo para `SERVICE_PRESALE`: o serviço já foi pago, preço não importa
- [x] `billing.service.ts` — descrição da transação do vale inclui nome do serviço (ex.: `Vale de procedimento criado — Drenagem (pré-venda)`)
- [x] `manual-receipts.service.ts` — mesma correção de descrição

### Frontend
- [x] `components/ui/info-banner.tsx` — componente reutilizável `InfoBanner` (variantes: info/success/warning/error)
- [x] `receive-manual-modal.tsx` — substituído banner inline por `InfoBanner`; `walletOriginType` adicionado ao `PaymentLineState`; valor auto-preenchido e campo desabilitado para `SERVICE_PRESALE`; promoções ocultadas quando pré-venda selecionada
- [x] `billing/page.tsx` — `BillingActions` busca vouchers `SERVICE_PRESALE` disponíveis e passa como `preSelectedVoucherId` ao abrir `ReceiveManualModal`
- [x] `carteira/page.tsx` — view por-cliente exibe seção "Aguardando pagamento" com pré-vendas pendentes (sem contar no saldo)

---

## Fase 14 — Melhorias de UX na Tela de Cobranças e Ficha do Cliente

> Commit: em progresso — branch `feat/billing-service-redesign-issue-147`

### Backend
- [x] `billing.dto.ts` — adicionados `createdAtFrom` e `createdAtTo` ao `ListBillingQuery` (filtros de data por criação)
- [x] `billing.repository.ts::findAll()` — filtro de `createdAt` aplicado quando os parâmetros são fornecidos
- [x] `billing.repository.ts::billingInclude` — adicionado `manualReceipt { lines { paymentMethod, amount, walletEntryId, walletEntry } }` para retornar dados de pagamento nas listagens

### Frontend
- [x] `use-appointments.ts::Billing` — interface extendida com campo `manualReceipt` (linhas de pagamento com `paymentMethod`, `amount`, `walletEntry`)
- [x] `billing/page.tsx` — adicionados filtros de data (Criado em: presets Hoje/7 dias/30 dias/3 meses/6 meses + inputs manual) com padrão dos últimos 6 meses
- [x] `billing/page.tsx` — totalizador "Valor total (filtro)" usa `data.totalAmount` do backend (aggregate real, não soma da página)
- [x] `billing/page.tsx` — `PaymentMethodPills` exibe pills de forma de pagamento (Dinheiro/PIX/Cartão/Vale/Crédito) nas linhas da tabela para cobranças pagas
- [x] `billing/page.tsx` — `BillingDetailModal` com detalhe completo de cobranças pagas/canceladas (dados da cobrança, promoção aplicada, breakdown de pagamentos com formas e valores); acessível via botão "Ver detalhe" nas linhas pagas/canceladas
- [x] `receive-manual-modal.tsx` — redesenho da UX de promoções: melhor desconto é auto-aplicado (específica > universal); removidos múltiplos banners confusos; adicionado botão "Selecionar outro desconto" que expande picker com todos os descontos disponíveis (mostra código, tipo e valor); corrigido bug onde trocar promoção deixava a anterior aparecendo como sugestão em loop
- [x] `customers/page.tsx::CustomerWalletTab` — seção "Aguardando pagamento" com pré-vendas pendentes (`sourceType: PRESALE, status: pending`) visível na aba Carteira da Ficha do Cliente; mesmo padrão visual amber já presente em `carteira/page.tsx`

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

### [2026-04-14] — agente: criação do Pipeline de Entrega (SDD) — spec-tecnica + aesthera-delivery
- **Arquivo(s) afetado(s):** `.github/agents/spec-tecnica.agent.md`, `ai-engineering/prompts/spec-tecnica/spec-tecnica-prompt.md`, `.github/agents/aesthera-delivery.agent.md`, `ai-engineering/prompts/aesthera-delivery-pipeline/aesthera-delivery-pipeline-prompt.md`
- **O que foi feito:** Criado o Pipeline de Entrega (SDD — Spec-Driven Development) separando responsabilidades entre descoberta (`aesthera-discovery`) e entrega (`aesthera-delivery`). Dois novos agentes: `spec-tecnica` (gera spec técnica de implementação a partir de issue) e `aesthera-delivery` (orquestra as 7 fases: spec → refinamento → implementação → checklist → testes → documentação → code review).
- **Impacto:** Todo ciclo de entrega de features passa agora por um fluxo estruturado com checkpoint humano antes da implementação.

### [2026-04-13] — Pipeline: Fichas de Avaliação Expandidas
- **Módulo:** MeasurementSheets (expansão)
- **O que foi feito:** Pipeline complexo executado completo: revisão UX + Security + Arquitetura → consolidação → 3 issues geradas
- **Spec final:** `outputs/consolidador/fichas-avaliacao-expandidas-spec-final.md`
- **Issues geradas:**
  - `outputs/tasks/issue-fichas-avaliacao-expandidas-1-backend.md` — Migration, enums, endpoints e autorização
  - `outputs/tasks/issue-fichas-avaliacao-expandidas-2-settings-frontend.md` — Redesign aba Fichas de Avaliação em Configurações
  - `outputs/tasks/issue-fichas-avaliacao-expandidas-3-customer-frontend.md` — Aba Avaliações no perfil do cliente
- **Bloqueantes incorporados:** 10 (4 UX + 4 Security + 2 Arquitetura)
- **Status:** ✅ Pronto para implementação

### [2026-04-14] — feat(#157): Fichas de Avaliação Expandidas — Backend 1/3
- **Módulo:** MeasurementSheets (expansão)
- **Issue:** [#157](https://github.com/DjoniLw/ia/issues/157) — Migration, enums, novos endpoints e autorização
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(enums MeasurementCategory + MeasurementScope; 4 novos campos em MeasurementSheet: category, scope, customerId, createdByUserId; 2 relações; 2 índices)*
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.dto.ts` *(CreateSheetDto + UpdateSheetDto.strict() + ListSheetsQuery com novos filtros)*
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.service.ts` *(autorização granular por role/scope, copyTemplate com prisma injetável)*
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.routes.ts` *(GET /templates + POST /templates/:id/copy — rotas estáticas registradas antes de /:id)*
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.repository.ts` *(filtros scope/category em listSheets, existsSheetNameInClinic)*
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-templates.ts` *(NOVO — 6 templates: Perimetria, Bioimpedância, Condição Estética, Firmeza Tissular, Avaliação Facial, Avaliação Postural)*
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.test.ts` *(12 novos cenários de autorização)*
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.service.ts` *(campo categories computado na response de listSessions)*
  - `aesthera/apps/api/src/modules/appointments/appointments.repository.ts` *(existsConfirmed() adicionado)*
- **O que foi feito:**
  - Migration não-destrutiva: `category=CORPORAL` e `scope=SYSTEM` aplicados por default em fichas existentes
  - Autorização granular: scope=SYSTEM apenas admin; scope=CUSTOMER — staff/admin livre, professional requer agendamento confirmado
  - Biblioteca de templates: GET lista 6 templates pré-configurados; POST /copy cria ficha com sufixo numérico se nome duplicado
  - Injeção de PrismaClient no service (testabilidade): construtor aceita `db` opcional para mocking em testes
  - Campo `categories: MeasurementCategory[]` derivado das fichas da sessão na response de listSessions
  - 38/38 testes passando (26 existentes + 12 novos)
- **Spec técnica:** `outputs/spec-tecnica/fichas-avaliacao-expandidas-backend-spec-tecnica.md`
- **⚠️ Pendente:** Executar `npx prisma migrate dev --name add-measurement-category-scope` no ambiente com banco

### [2026-04-14] — feat(#158): Fichas de Avaliação Expandidas — Frontend Settings 2/3
- **Módulo:** MeasurementSheets — Frontend Configurações
- **Issue:** [#158](https://github.com/DjoniLw/ia/issues/158) — Redesign da aba Fichas de Avaliação em Configurações
- **Branch:** `feat/issue-158-fichas-avaliacao-settings-frontend`
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/lib/measurement-categories.ts` *(NOVO — constantes de apresentação: CATEGORY_LABELS, SHEET_TYPE_LABELS, MEASUREMENT_CATEGORIES_ORDER, CATEGORY_ICON)*
  - `aesthera/apps/web/app/(dashboard)/settings/_components/measurement-sheets-settings.tsx` *(REDESIGN COMPLETO — layout 3 painéis, sidebar de categorias, DnD, editor SIMPLE/TABULAR, toggles inline, viewport < 1280px collapsible)*
  - `aesthera/apps/web/app/(dashboard)/settings/_components/measurement-templates-drawer.tsx` *(NOVO — drawer "Usar modelo" com 6 cards de templates, loading state, feedback de erro)*
  - `aesthera/apps/web/app/(dashboard)/settings/page.tsx` *(aba renomeada "Medidas Corporais" → "Fichas de Avaliação")*
  - `aesthera/apps/web/lib/hooks/use-measurement-sheets.ts` *(EXPANDIDO — tipos MeasurementCategory, MeasurementScope, MeasurementTemplate; hooks useMeasurementTemplates, useCopyMeasurementTemplate; parâmetros scope/category em useMeasurementSheets)*
  - `aesthera/docs/screen-mapping.md` *(aba Configurações atualizada)*
- **O que foi feito:**
  - Layout 3 painéis: sidebar com 6 categorias + contagem, lista de fichas por categoria, editor ao vivo
  - Categoria "Personalizada" → readonly; exibe fichas `scope=CUSTOMER`; sem botão "Nova ficha"
  - Editor SIMPLE: campos editáveis inline, confirmação Enter/Escape, toggle "Direito/Esquerdo" em campos numéricos, DnD + fallback ▲▼ para touch
  - Editor TABULAR: colunas como chips editáveis, campos como linhas com DnD
  - Drawer "Usar modelo": grid de templates com loading state explícito por botão; ao concluir, seleciona ficha na categoria correspondente
  - Dialog "Nova ficha": seleção visual de formato (Lista/Tabela) + validação nome obrigatório
  - Viewport < 1280px: painel de preview colapsa via Collapsible (oculto por padrão)
  - Fix TypeScript React 19: `RefObject<HTMLInputElement | null>` nos props editRef/editInputRef
  - Todos os labels em PT-BR; nenhum enum exposto na UI
- **Closes:** #158

### [2026-04-15] — feat(#159): Fichas de Avaliação Expandidas — Frontend Cliente 3/3
- **Módulo:** MeasurementSheets — Frontend Perfil do Cliente
- **Issue:** [#159](https://github.com/DjoniLw/ia/issues/159) — Aba Avaliações no perfil do cliente
- **Branch:** `feat/issue-159-fichas-avaliacao-customer-frontend`
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(renomeada aba "Avaliação" → "Avaliações")*
  - `aesthera/apps/web/components/body-measurements/evolution-tab.tsx` *(refatoração completa: filtro por categoria server-side, SessionFormModal com busca interna de fichas, badges de categoria, canCreate guard restaurado, hasUnsaved baseado em selectionDirty)*
  - `aesthera/apps/web/components/measurement-sheets/NewCustomerSheetModal.tsx` *(NOVO — modal de criação de ficha scope=CUSTOMER, category=PERSONALIZADA, isValid guard)*
  - `aesthera/apps/web/lib/hooks/use-measurement-sheets.ts` *(EXPANDIDO — suporte a customerId em UseMeasurementSheetsOptions, CreateSheetInput e query)*
  - `aesthera/apps/web/lib/hooks/use-measurement-sessions.ts` *(EXPANDIDO — suporte a category no filtro)*
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.dto.ts` *(EXPANDIDO — category opcional em ListSessionsQuery)*
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.repository.ts` *(EXPANDIDO — filtro por category via sheetRecords.some)*
  - `aesthera/docs/screen-mapping.md` *(aba Avaliações atualizada, duplicata removida)*
- **Closes:** #159

### [2026-04-15] — Code Review PR #162
- **Arquivo gerado:** `outputs/code-review/pr/revisao_pr162_2026-04-15.md`
- **O que foi feito:** Revisão do PR #162 (feat(#159): aba Avaliações no perfil do cliente e fichas personalizadas) — 5 bloqueantes, 6 sugestões
- **Impacto:** Qualidade e integridade do código revisado; PR reprovado pendente correções

### [2026-04-09] — fix(#155): Code Review PR #155 — 6 bloqueantes e 3 sugestões corrigidos
- **Módulo:** Anamnesis (correções pós-code-review PR #155)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/components/anamnesis/SendAnamnesisDialog.tsx` *(encoding BOM removido + todas as strings PT-BR corrompidas corrigidas + `<button>` nativo → `<Button variant="ghost" size="icon">` + label "Enviar por" sem uppercase)*
  - `aesthera/apps/web/components/anamnesis/AnamnesisTab.tsx` *(isDirty + Checkbox do design system + reset dirty em onClose/Cancelar)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.repository.ts` *(IDOR corrigido: `update({where:{id}})` → `updateMany({where:{id,clinicId}})` + select restrito ao necessário)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.dto.ts` *(UpdateAnamnesisStaffAnswersDto com limites de tamanho — max 500 campos, max 10.000 chars por valor)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.service.ts` *(log de auditoria `logger.info` em updateStaffAnswers)*
- **O que foi feito:**
  - **[BLOQUEANTE-1]** Encoding UTF-8 com BOM removido; todas as 11 strings corrompidas corrigidas (acentos incorretos como `Ã§`, `Ã©`, `â€"` → caracteres corretos)
  - **[BLOQUEANTE-2]** IDOR corrigido em `updateStaffAnswers`: substituído `prisma.update({ where: { id } })` por `prisma.updateMany({ where: { id, clinicId, deletedAt: null } })` — eliminando TOCTOU
  - **[BLOQUEANTE-3]** `isDirty` adicionado ao dialog de edição de respostas — guard de perda de dados ao fechar acidentalmente
  - **[BLOQUEANTE-4]** `<input type="checkbox">` nativo → `<Checkbox>` do design system com `id`/`htmlFor` e `onCheckedChange`
  - **[BLOQUEANTE-5]** `<button>` nativo no "Voltar" → `<Button variant="ghost" size="icon">`
  - **[SUGESTÃO-1]** Select do `updateStaffAnswers` restrito (removidos `clientAnswers`, `signatureHash`, `questionsSnapshot`)
  - **[SUGESTÃO-2]** `UpdateAnamnesisStaffAnswersDto` com limites explícitos no `z.record`
  - **[SUGESTÃO-3]** Log de auditoria `logger.info` em `updateStaffAnswers`
- **Commits:** `edd9eb2` (pré-review) + commit desta correção

### [2026-04-08] — feat(#145): Ficha de Anamnese Digital — implementação completa (PR #149)
- **Módulo:** AnamnesisRequest (novo) + ClinicalRecord (extensão) + Notifications (reutilização)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(modelo AnamnesisRequest + AnamnesisGroup + AnamnesisQuestion + ClinicalRecord extensão)*
  - `aesthera/apps/api/prisma/migrations/20260408000001_anamnesis_requests/migration.sql` *(novo)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.dto.ts` *(novo)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.repository.ts` *(novo)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.routes.ts` *(novo)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.service.ts` *(novo)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.service.test.ts` *(novo — 18 testes)*
  - `aesthera/apps/web/app/anamnese/[token]/page.tsx` *(novo — página pública)*
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(aba Anamnese na ficha do cliente)*
- **O que foi feito:**
  - Backend completo: CRUD de `AnamnesisGroup`/`AnamnesisQuestion`, envio de `AnamnesisRequest` (modos `blank` e `prefilled`), módulo de assinatura pública com token HMAC-SHA256, geração de `ClinicalRecord` via domain event `anamnesis.signed`, re-envio com novo token, cancelamento, solicitação de correção.
  - Página pública `/anamnese/[token]`: formulário responsivo para mobile, `SignatureCanvas`, consentimento LGPD, modo `prefilled` em read-only, validação de tamanho de assinatura (3MB), mensagens de erro PT-BR por status (410/409/200).
  - Aba "Anamnese" na ficha do cliente: listagem de fichas enviadas com status, botões Reenviar/Cancelar (admin-only para cancelar), envio de nova ficha com seleção de grupo e modo.
- **Closes:** #145

### [2026-04-08] — fix(#145): Code Review PR #149 — 16 correções aplicadas
- **Módulo:** AnamnesisRequest
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.repository.ts`
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.service.ts`
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.routes.ts`
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.dto.ts`
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.service.test.ts`
  - `aesthera/apps/api/prisma/schema.prisma`
  - `aesthera/apps/api/prisma/migrations/20260408000002_anamnesis_request_updated_at/migration.sql` *(novo)*
  - `aesthera/apps/web/app/anamnese/[token]/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx`
- **O que foi feito:** Todas as 16 correções do Copilot Code Review aplicadas + 3 novos testes (18/18 passando):
  - **Bug:** `submitSignature` aceita `correction_requested` além de `pending` (status filter `in: [...]`)
  - **Bug:** `ClinicalRecord.content` em formato `{ groupName, entries: [{question,answer,type}] }` esperado pelo frontend — `buildClinicalRecordContent()` implementado
  - **Spec CA11:** DELETE restrito a `admin` (retirado `staff`)
  - **Perf:** `findAll` usa `select` explícito omitindo `signature`, `questionsSnapshot`, `clientAnswers`, `staffAnswers`
  - **Schema:** `updatedAt@updatedAt` adicionado a `AnamnesisRequest` + migration `20260408000002`
  - **Security:** Modo `prefilled` agora read-only (perguntas renderizadas como `<p>` com banner informativo)
  - **LGPD CA06/CA18:** `buildConsentText()` com nome/CNPJ da clínica; `consentText` exibido no frontend e persistido no submit
  - **CA16:** Validação de tamanho da assinatura (>3MB bloqueado no frontend antes do POST)
  - **Role CA11:** Botão Cancelar visível apenas para `admin` na ficha do cliente
  - **Spec:** Rota de correção pública alinhada: `PATCH /public/anamnese/:token/request-correction`
  - **UX:** Handlers Reenviar/Cancelar com `try/catch` e `toast.error()` em caso de falha
  - **Arch:** Singleton `anamnesisService` convertido para Proxy lazy (zero side-effects em import time)
  - **Comment:** DTO `questionsSnapshot` documenta campo correto `text` (não `label`)
  - **Tests:** 3 novos testes para `handleAnamnesisSignedEvent` (criar, idempotência, not-found)
  - **Rate limit:** Rota de reenvio limitada a 3 req/hora
  - **UX:** Mensagens 410/409 alinhadas com spec (expirado vs cancelado vs assinado)
- **Testes:** 18/18 passando (15 existentes + 3 novos)

### [2026-04-08] — Code Review Issue #152 — Redesign do Módulo de Anamnese

- **Arquivo gerado:** `outputs/code-review/pr/revisao_issue152_2026-04-08.md`
- **O que foi feito:** Revisão da implementação da issue #152 — 14 bloqueantes, 12 sugestões
- **Impacto:** Implementação reprovada por múltiplas vulnerabilidades de segurança (IDOR em `updateStatus`/`setSignToken`, SEC2 `signToken` exposto em 3 endpoints, SEC6 base64 em PostgreSQL) e violações de design system (`<button>` nativo)

### [2026-04-08] — feat(#152): Redesign do Módulo de Anamnese — Ciclo de Vida Completo + Segurança LGPD + UI Completa

- **Módulo:** Anamnesis (evolução do PR #149)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(novos enum values, campos diffResolution/signatureUrl/tokenExpiresAt, index)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.dto.ts` *(enum 9 valores, ResolveDiffSchema, SendAnamnesisDto)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.service.ts` *(TTL 7 dias, finalize/sendToClient/resolveDiff, Prisma import)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.repository.ts` *(SEC2 select explícito, findByIdWithClinic, updateStatus, setSignToken, submitSignature→signatureBase64)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.routes.ts` *(endpoints finalize/send/cancel/resolve-diff)*
  - `aesthera/apps/api/src/modules/anamnesis/anamnesis.service.test.ts` *(31 testes — SEC1-6, RN10, resolveDiff×5, finalize×3)*
  - `aesthera/apps/web/lib/status-colors.ts` *(9 status, /40 opacities, ANAMNESIS_STATUS_COLORS alias)*
  - `aesthera/apps/web/lib/anamnesis-labels.ts` *(novo — ANAMNESIS_STATUS_LABELS + ANAMNESIS_ACTION_LABELS)*
  - `aesthera/apps/web/lib/hooks/use-resources.ts` *(AnamnesisRequestStatus 9 valores, novos hooks)*
  - `aesthera/apps/web/components/anamnesis/AnamesisDiffViewer.tsx` *(novo — diff responsivo campo-a-campo)*
  - `aesthera/apps/web/components/anamnesis/AnamnesisTab.tsx` *(novo — aba completa com filtros/ações/diálogos)*
  - `aesthera/apps/web/components/anamnesis/ViewAnamnesisModal.tsx` *(signature→signatureHash)*
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(aba Anamnese integrada)*
  - `aesthera/apps/web/app/anamnese/[token]/page.tsx` *(SEC1 consentText, violet→primary, error messages)*
- **O que foi feito:**
  - **Ciclo de vida completo (9 estados):** `draft → clinic_filled → sent_to_client → client_submitted → signed | expired | cancelled | correction_requested`
  - **SEC1:** `consentText` gerado server-side — nunca lido do body da requisição pública
  - **SEC2:** `findById()` usa `select:` explícito — `signToken`, `signatureUrl`, `consentText`, `ipAddress`, `userAgent` nunca retornados em respostas de listagem/GET
  - **SEC3:** Expiração verificada universalmente em GET e POST (lazy check mesmo para status=pending)
  - **SEC5/SEC6:** Limites de campo no DTO + `signatureBase64` mínimo 1000 bytes
  - **RN10:** TTL de 7 dias (corrigido de 72h)
  - **resolve-diff:** Endpoint atômico em transação Prisma — valida tenant, status `client_submitted`, idempotência (`signed` retorna 200), registra AuditLog com userId
  - **finalize:** Transiciona `draft → clinic_filled`
  - **sendToClient:** Gera token HMAC-SHA256, persiste via `setSignToken()`, envia WhatsApp/email
  - **AnamesisDiffViewer:** Tabela desktop 3 colunas + cards mobile, atalhos "Aceitar tudo", rádio por campo
  - **AnamnesisTab:** Filtros por status pill, paginação 10/page, botões de ação por estado, dialogs para envio e resolução de diff
  - **Página pública:** Cores `violet-*` → `primary`, SEC1 fix, mensagens de erro alinhadas à spec
  - **Testes:** 31/31 passando (todos novos e existentes)
- **Closes:** #152

### [2026-04-08] — PO: Redesign do Módulo de Anamnese

- **Módulo:** Anamnesis (redesenho arquitetural)
- **O que foi feito:** Especificação gerada para separar a anamnese do prontuário genérico (`ClinicalRecord`) e tratá-la como entidade com ciclo de vida próprio. Problema identificado: anamnese como "tipo" do prontuário força usuário a criar duplicatas ao querer enviar ao cliente. Novo design: entidade `Anamnesis` com 7 estados (`draft → clinic_filled → sent_to_client → client_submitted → signed | expired | cancelled`), suporte a 3 fluxos (clínica preenche e envia / envia em branco / clínica preenche e arquiva), diff campo-a-campo quando clínica pré-preencheu e cliente alterou, resolução de divergências por campo antes de assinar, página pública `/anamnese/[token]` reutilizando padrão de contratos. Nova aba "Anamnese" na ficha do cliente substitui o tipo anamnese no prontuário.
- **Spec:** `outputs/po/anamnese-redesign-doc.md`
- **Status:** ✅ Spec final consolidada — pronta para issue-writer

### [2026-04-08] — Consolidador: Redesign do Módulo de Anamnese — spec final

- **Módulo:** Anamnesis (redesenho arquitetural)
- **O que foi feito:** Spec final consolidada a partir das revisões de UX (6 bloqueantes), Security (2 bloqueantes, 4 médios) e Arquiteto (3 bloqueantes, 4 importantes). 3 conflitos resolvidos: (1) diff com ações campo-a-campo + atalhos globais; (2) rota pública corrigida para `/public/anamnese/:token`; (3) módulo tratado como evolução do PR #149, não criação do zero. Incorporados: `signatureHash`, `consentGivenAt`, `ipAddress`, `userAgent` no modelo; `consentText` server-side; `select:` explícito em `findById`; `clientAnswers` com Zod; formulário público paginado; modal em 2 etapas; diff responsivo (tabela desktop / cards mobile); migration obrigatória para `correction_requested`.
- **Spec:** `outputs/consolidador/anamnese-redesign-spec-final.md`
- **Status:** ✅ Pronta para issue-writer

### [2026-04-07] — PO: Melhorias no Modal de Agendamento
- **Módulo:** Appointments
- **O que foi feito:** Especificação gerada cobrindo 4 melhorias: (A) proteção contra double-submit com estado `isSubmitting` local + mapeamento de mensagens de erro por `errorCode` da API; (B) aumento da largura do modal em desktop (`max-w-2xl`+) mantendo responsividade mobile; (C) diálogo de confirmação de saída sem salvar posicionado via portal/AlertDialog fixo ao viewport (invisibilidade quando scrollado para baixo); (D) persistência da view do calendário (dia/semana/mês) no localStorage com chave `aesthera:appointments:view`.

### [2026-04-07] — PO: Agenda Inteligente (ex-Agenda Avançada)
- **Módulo:** Appointments
- **O que foi feito:** Especificação gerada para redesenho da "Agenda Avançada" renomeada para "Agenda Inteligente". Novo painel de filtros com Serviço (obrigatório), Equipamento (obrigatório), Sala e Profissional (opcionais) + botão "Buscar disponibilidade". Calendário semanal mostra slots disponíveis (verdes) vs indisponíveis (cinza) considerando 4 combinações de filtros. Novo endpoint `GET /appointments/smart-availability` com params `serviceId, equipmentId, roomId?, professionalId?, dateFrom, dateTo`. Clicar em slot verde abre modal de novo agendamento pré-preenchido.

### [2026-04-04] — hotfix: migration idempotente para `wallet_transaction_type.REFUND`
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/migrations/20260404000003_ensure_wallet_refund_txn_type/migration.sql` *(novo)*
- **O que foi feito:** Identificado que a migration `20260404000002_wallet_refund_txn_type` usa `ALTER TYPE ... ADD VALUE 'REFUND'` **sem** `IF NOT EXISTS`. Na transição `db push → migrate deploy`, o mecanismo de auto-resolve em `main.ts` pode marcar essa migration como "applied" sem executar o SQL, deixando `REFUND` ausente do enum PostgreSQL `wallet_transaction_type`. Resultado: qualquer chamada a `walletTransaction.create({ type: 'REFUND' })` no fluxo de reabertura de cobranças falha com `PrismaClientKnownRequestError P2023` → HTTP 400. Criada nova migration idempotente `20260404000003` com `ADD VALUE IF NOT EXISTS 'REFUND'` que garante a presença do valor independente do histórico de migração anterior.
- **Impacto:** Corrige o erro 400 ao reabrir cobranças `PRESALE` com vale de serviço ainda ativo (`status=ACTIVE`). Migration é no-op quando `REFUND` já existe.

### [2026-04-03] — Code Review PR #148
- **Arquivo gerado:** `outputs/code-review/pr/revisao_pr148_2026-04-03.md`
- **O que foi feito:** Revisão do PR #148 (feat: redesenho fluxo cobrança de serviços — issue #147). Orquestração: security-auditor, ux-reviewer, test-guardian.
- **Resultado:** REPROVADO — 8 bloqueantes, 9 sugestões. Principais bloqueantes: fluxo Cash/PIX/Card sem `$transaction` (corrupção de dados financeiros), T05/T19 com assertivas condicionais que podem ser silenciosamente puladas, T06 ausente (billing complementar RN14/RN15 sem testes), badges PACKAGE_SALE/PRODUCT_SALE exibindo enum inglês na UI.

### [2026-04-08] — treinamento: aesthera-implementador — 4 novos anti-padrões (PR #149) + correção estrutural do scan pré-código
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md`
  - `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
- **O que foi feito:** Quatro anti-padrões registrados via treinador-agent com origem no PR de anamnese digital (#149): (1) REINCIDÊNCIA — STATUS_LABEL/STATUS_COLOR definidos localmente, inclusive dentro de callbacks `.map()` — BLOQUEANTE; (2) LACUNA — cores de brand usam `bg-violet-*` hardcoded em vez de tokens `bg-primary`/`text-primary` — BLOQUEANTE; (3) LACUNA — `<button>` nativo para ações que deveriam usar `<Button>` do design system — BLOQUEANTE; (4) REINCIDÊNCIA — `<DataPagination>` ausente em tabs internas da página (tab de fichas digitais) — BLOQUEANTE. Além dos anti-padrões, correção estrutural crítica no prompt do implementador: (a) eliminado "mentalmente" do gate do scan pré-código — o output do scan agora é OBRIGATORIAMENTE VISÍVEL com bloco formatado; (b) step 4 do Fluxo de Trabalho refatorado para exigir bloco de confirmação explícito antes de avançar; (c) gate de compliance frontend atualizado com os 4 novos itens; (d) tabela de "Componentes obrigatórios" expandida com `<Button>` e tokens de cor.
- **Impacto:** O "furo" raiz identificado (scan "mental" sem output visível) foi corrigido — o implementador agora produz evidência verificável do scan antes de codificar, prevenindo reincidências dos padrões catalogados.

### [2026-04-08] — treinamento: aesthera-implementador — 3 padrões (issue #152) via treinador-agent
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-implementador/patterns/backend-seguranca.md`
  - `ai-engineering/prompts/aesthera-implementador/patterns/geral-testes.md`
  - `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md` *(histórico)*
- **O que foi feito:** (1) 🔁 REINCIDÊNCIA — item `_clinicId` em repositório atualizado com flag de reincidência, detecção via `grep -n '_clinicId' *.repository.ts` e data 08/04/2026; (2) NOVO — `include` sem `select` na entidade principal expõe campos sensíveis em route handlers — adicionado a `backend-seguranca.md` com lista de campos proibidos e heurística de detecção; (3) NOVO — testes de `$transaction` sem cenário de falha do último step não testam atomicidade — adicionado a `geral-testes.md` com template de teste de rollback.

### [2026-04-08] — arquitetura: fragmentação do sistema de aprendizados + two-phase execution protocol
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-implementador/_index.md` *(novo — tabela de roteamento por tipo de elemento)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/backend-seguranca.md` *(novo — 8 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/backend-prisma.md` *(novo — 7 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/backend-validacao.md` *(novo — 3 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/frontend-filtros-listagens.md` *(novo — 7 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/frontend-cores-status.md` *(novo — 9 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/frontend-componentes.md` *(novo — 11 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/frontend-formularios.md` *(novo — 4 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/geral-testes.md` *(novo — 6 itens)*
  - `ai-engineering/prompts/aesthera-implementador/patterns/geral-escopo-pr.md` *(novo — 3 itens)*
  - `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md` *(convertido em redirecionador — conteúdo migrado para `patterns/`)*
  - `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md` *(atualizado — item 7 aponta para `_index.md`, gate de compliance e auto-treinamento adaptados)*
  - `ai-engineering/prompts/treinador/treinador-agent-prompt.md` *(atualizado — nova seção de roteamento de aprendizados)*
- **O que foi feito:** O monolítico `code-review-learnings.md` (~1400 linhas, 60+ itens) foi fragmentado em 9 arquivos de padrões por domínio. O `_index.md` serve como tabela de roteamento com 40+ tipos de elementos mapeados. O implementador executa em **Fase 1 (Planejamento)** — carrega `_index.md`, decompõe a tarefa, produz Bloco de Planejamento visível — e **Fase 2 (Execução)** — carrega apenas os fragmentos relevantes por elemento antes de implementar cada um, aguarda confirmação e avança. O treinador-agent foi atualizado com a tabela de roteamento para saber qual arquivo `patterns/*.md` recebe cada novo aprendizado.
- **Motivação:** O arquivo monolítico causava compressão de contexto — o modelo esquecia itens iniciais ao implementar os finais. Fragmentação resolve isso: cada elemento carrega apenas o contexto necessário, tornando a verificação rastreável e verificável.

### [2026-04-03] — treinamento: aesthera-implementador — 2 novos anti-padrões (PR #148)
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md`
- **O que foi feito:** Dois anti-padrões registrados via treinador-agent com origem no code review do PR #148: (1) Múltiplos branches de pagamento com atomicidade inconsistente — quando um método tem ≥2 caminhos (voucher/cash/card), todos devem estar dentro da mesma `$transaction`; misturar `this.prisma.X` fora da transação com branches dentro dela é silenciosamente perigoso; (2) Assertivas condicionais com `if (instance)` + `?.mock.results[0]?.value` criam testes que passam verde sem executar o `expect()` — padrão correto é `vi.hoisted()` para capturar referências de mock; nenhum `expect()` deve ser envolvido em `if`.
- **Impacto:** Prevenção de regressões financeiras por falha de atomicidade em pagamentos e de testes falso-positivos que mascaram bugs de lógica.

### [2026-04-03] — agente: criação do code-reviewer (orquestrador de PR reviews)
- **Arquivo(s) afetado(s):**
  - `.github/agents/code-reviewer.agent.md`
  - `ai-engineering/prompts/code-reviewer/code-reviewer-prompt.md`
- **O que foi feito:** Criado novo agente `code-reviewer` — revisor de PRs com papel duplo: (1) revisor especialista em integridade do sistema (anti-padrões, violações de padrão, PLAN.md, copilot-instructions) e (2) orquestrador que aciona `ux-reviewer`, `security-auditor`, `aesthera-system-architect` e `test-guardian` conforme o tipo de mudança no PR. Consolida os resultados filtrando apenas o que precisa ser corrigido. Gera relatório em `outputs/code-review/pr/revisao_pr{N}_{data}.md`.
- **Impacto:** Pipeline de qualidade de código com revisão automatizada e especializada para todos os PRs do projeto.

### [2026-03-31] — treinamento: aesthera-implementador — Scan pré-código obrigatório + reincidência modal PR #144
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
  - `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md`
- **O que foi feito:** Anti-padrão `fixed inset-0 z-50` documentado em 25/03 reincidiu no PR #144 — evidência de que os learnings eram consultados pós-implementação, não antes. Três mudanças aplicadas: (1) Item 7 do Carregamento de Contexto reescrito como "PRÉ-REQUISITO BLOQUEANTE" com gate explícito: após ler os learnings, listar quais padrões se aplicam antes de começar a codificar; (2) Fluxo de Trabalho reestruturado — novo passo 3 "Scan PRÉ-CÓDIGO de padrões treinados" inserido ANTES do passo Implementar, com instrução explícita de que só avança após confirmar o scan; (3) Entrada do modal no `code-review-learnings.md` marcada com "🔁 REINCIDÊNCIA (PR #144)" e nota explicando que ler como pós-checklist não previne reincidências.
- **Impacto:** O scan dos learnings deixa de ser pós-verificação e passa a ser gate pré-código, prevenindo que anti-padrões já catalogados reapareçam em PRs futuros.

### [2026-03-31] — treinamento: aesthera-implementador — Gate de conformidade com padrões treinados
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
- **O que foi feito:** Três mudanças para corrigir o problema de padrões treinados sendo ignorados: (1) `ux-reviewer-learnings.md` adicionado ao carregamento de contexto obrigatório para toda tarefa com arquivos `.tsx` — o implementador agora lê os padrões visuais/UX treinados antes de qualquer trabalho frontend; (2) Nova seção `⚠️ Padrões Treinados — Requisitos de Implementação (INEGOCIÁVEL)` com gate de compliance item a item (backend e frontend) antes de qualquer commit — cobre segurança, dark mode, filtros, paginação, formulários, PT-BR; (3) Step 4 adicionado ao Fluxo de Trabalho Obrigatório: "Verificar conformidade com padrões treinados" como etapa bloqueante entre implementar e o checklist de conformidade UI. O prompt declara explicitamente: "padrões treinados não são sugestões — são requisitos tão obrigatórios quanto a spec da feature".
- **Impacto:** O implementador passa a verificar sistematicamente todos os itens dos learnings (code-review-learnings.md + ux-reviewer-learnings.md) antes de concluir qualquer tarefa, evitando que padrões treinados sejam ignorados.

### [2026-03-31] — treinamento: ux-reviewer — Regra de Cobertura Total e exaustividade de revisão
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/ux-reviewer/ux-reviewer-prompt.md`
- **O que foi feito:** Adicionados ao prompt do UX Reviewer quatro grupos de mudanças para corrigir o problema de entregas parciais: (1) Nova seção `⚠️ Regra de Cobertura Total (INEGOCIÁVEL)` com prioridade sobre todas as outras regras — exige listar o escopo no início, cobrir cada item sem exceção e confirmar a cobertura no encerramento; (2) Auto-verificação obrigatória de 6 pontos antes de finalizar qualquer relatório; (3) Fluxo de trabalho reescrito — Passo 4 exige que todas as 10 seções do checklist apareçam no relatório (mesmo com "Sem ocorrências"), Passo 6 de auto-verificação adicionado antes do parecer final; (4) Seção "Ler código real" reescrita com regra de imports obrigatória e proibição de começar o relatório antes de ler todos os arquivos do escopo; (5) Fluxo de PR atualizado com exigência de listar e ler TODOS os arquivos filtrados; (6) Regras Importantes com 4 novas regras anti-omissão.
- **Impacto:** O agente UX Reviewer passa a entregar 100% do escopo solicitado em toda revisão, com cobertura explícita de todos os itens do checklist e todos os arquivos solicitados.

### [2026-03-31] — docs: criação do mapeamento canônico de telas (screen-mapping.md)
- **Arquivo(s) afetado(s):**
  - `aesthera/docs/screen-mapping.md` *(novo)*
  - `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
  - `ai-engineering/prompts/ux-reviewer/ux-reviewer-prompt.md`
  - `ai-engineering/prompts/aesthera-product-owner/aesthera-product-owner-prompt.md`
  - `ai-engineering/prompts/aesthera-system-architect/aesthera-system-architect-prompt.md`
- **O que foi feito:** Criado arquivo `aesthera/docs/screen-mapping.md` como registro canônico de todas as 21 telas do sistema Aesthera. O arquivo documenta rota, tipo, campos obrigatórios, abas, formulários e ações disponíveis em cada tela. Agentes (Implementador, UX Reviewer, Product Owner, System Architect) foram atualizados para carregar e manter este arquivo sempre que houver criação, alteração ou remoção de telas.
- **Impacto:** Todo agente que mexer em telas do sistema passa a ter contexto estruturado do que existe. Toda tela nova, alterada ou removida deve ser refletida neste arquivo — obrigatoriamente.


- **Branch:** `feature/issue-120-payment-packages-promotions`
- **Módulos:** Packages, Promotions, ManualReceipts, Appointments
- **O que foi feito:**
  - **BLOCO 1 — Status de sessões:** Enum `PackageSessionStatus` (ABERTO/AGENDADO/FINALIZADO/EXPIRADO) adicionado ao schema. `appointments.service.ts` atualizado com `validateAndLinkPackageSession()`.
  - **BLOCO 2 — Venda pré-paga de pacote:** `packages.service.ts` com `purchasePackage()` transacional + idempotency key; `packages.routes.ts` com `POST /packages/:id/sell`, `GET /packages/sold`, `POST /packages/sessions/:id/redeem`.
  - **BLOCO 3 — Gestão de promoções:** `promotions.service.ts` com `maxUsesPerCustomer`, `toggleStatus()`, `findActiveForService()`; `promotions.routes.ts` com rate limiting (10/IP/min em `/validate`) e `PATCH /promotions/:id/status`.
  - **BLOCO 4 — Cupom em recebimento manual:** `manual-receipts.dto.ts` + `manual-receipts.service.ts` integram `PromotionsService.apply()` com fast-fail e cálculo de `effectiveBillingAmount`.
  - **BLOCO 5 — Página /packages:** `CustomerSearchInput` reescrito com `createPortal` (corrige overflow:hidden); `CustomerPackageCard` com badges de status ABERTO/AGENDADO/FINALIZADO/EXPIRADO; `PurchaseModal` com múltiplas formas de pagamento + idempotency key.
  - **BLOCO 6 — Página /promotions:** Submissão de datas em formato ISO corrigida; campo `maxUsesPerCustomer`; `ToggleStatusButton`.
  - **BLOCO 7 — Modal de recebimento:** Seção de cupom com validação inline + banner âmbar + cálculo de desconto em tempo real.
- **Testes:** `packages.service.test.ts` (7 testes) e `promotions.service.test.ts` (10 testes) — todos passando.
- **Observação:** Requer `prisma generate` após aplicação da migration `20260330100000_` para regenerar o cliente Prisma. Erros de TypeScript relacionados a campos novos (status, billingId, sourceType, maxUsesPerCustomer) são esperados até a regeneração.
- **Closes:** #120

### [2026-03-30] — PO: Spec corrigida da issue #131 — NotificationsService + BullMQ (Evolution API)
- **Módulo:** Notifications
- **O que foi feito:** Spec corrigida para refletir o estado real do código. Issue original referenciava Z-API como provider atual; a spec foi reescrita para usar Evolution API (já implementada). Identificado que BullMQ está instalado mas não utilizado — notificações são enviadas de forma síncrona. Spec inclui: (1) fila BullMQ assíncrona para `sendWhatsApp` e `sendEmail`; (2) worker com retry automático (max 3x, backoff exponencial); (3) lembrete D-1 via delayed job (ausente em código apesar de marcado como [x] no PLAN); (4) refatoração do `retry()` para usar fila; (5) correção de comentários Z-API em `contracts.service.ts`.
- **Artefato:** `outputs/tasks/014-messaging-queue-bullmq-evolution.md`

### [2026-03-30] — PO: Ficha de Anamnese Digital com Assinatura Eletrônica
- **Módulo:** AnamnesisRequest (novo) + Clinical Records (extensão) + Notifications (reutilização)
- **O que foi feito:** Especificação completa gerada. Feature permite envio de ficha de anamnese configurada na clínica para o cliente preencher e/ou validar e assinar digitalmente. Dois modos: blank (cliente preenche) e prefilled (staff preenche, cliente valida). Página pública `/anamnese/[token]` segue padrão idêntico ao `/sign/[token]` dos contratos. Assinatura atômica com criação do ClinicalRecord de tipo `anamnesis`.

### [2026-03-30] — Consolidador: Ficha de Anamnese Digital com Assinatura Eletrônica — Spec Final
- **Arquivo(s) afetado(s):** `outputs/consolidador/anamnese-assinatura-digital-spec-final.md` *(novo)*
- **O que foi feito:** Spec final consolidada pelo `aesthera-consolidador` a partir do `outputs/po/anamnese-assinatura-digital-doc.md` + revisões de UX Reviewer (5 bloqueantes + 9 sugestões + 4 observações), Security Auditor (7 bloqueantes + 8 atenções + 4 observações) e System Architect (5 bloqueantes + 5 sugestões + 6 observações). **1 conflito resolvido:** RN03 sobre reenvio — Security exige novo token (prevalece sobre PO que especificava mesmo token). **Principais adições:** consentimento LGPD Art.11 com snapshot de texto (`consentText`, `consentGivenAt`), anonimização de PII na eliminação, `clinicId` exclusivamente via JWT, race condition guard atômico, verificação de identidade leve em modo prefilled, validação backend de assinatura, estado `correcao_solicitada` na página pública, status `cancelled`, remoção de FK circular em `AnamnesisRequest`, criação de `ClinicalRecord` via domain event `anamnesis.signed`, imutabilidade de registros assinados, `SignatureCanvas` como pré-requisito extraído. **5 pré-requisitos de implementação** documentados na seção inicial.
- **Impacto:** Spec final pronta para o Issue-Writer. Requer confirmação dos 5 pré-requisitos antes de abrir a issue de implementação.

### [2026-03-30] — fix: auditoria completa de padronização de badges e status (UX 30/03)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/app/(dashboard)/services/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/professionals/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/supplies/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/products/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/sales/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/billing/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/contas-a-pagar/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/financial/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/notifications/page.tsx`
  - `aesthera/apps/web/lib/wallet-labels.ts`
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/equipment/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/rooms/page.tsx`
- **O que foi feito:**
  - **Grupo 1 — Padronização de cores:** `services`, `professionals`, `supplies`, `products` corrigidos para padrão `/40 text-200` em dark e `text-800` em light. `supplies` também teve o `zinc` removido em favor de `bg-muted`.
  - **Vendas:** Substituída cor única azul para todos os métodos de pagamento por `PAYMENT_BADGE_COLORS` com cores distintas (verde=Dinheiro, azul=PIX, violeta=Cartão, âmbar=Transferência).
  - **Billing / Contas a Pagar:** `/30 → /40` e texto dark `/300 → /200` em todos os status.
  - **Financeiro:** badge Crédito/Débito: `/30 → /40`, texto `-400 → /200` dark, `-700 → -800` light.
  - **Notificações:** todos os 3 status corrigidos para `/40` e texto `-800/-200`.
  - **wallet-labels.ts — WALLET_ENTRY_STATUS_CONFIG:** `ACTIVE` e `EXPIRED` corrigidos para `/40`, texto `-800/-200`.
  - **Grupo 3 — Badge visível para ativos:** `customers/page.tsx`, `equipment/page.tsx` e `rooms/page.tsx` agora exibem badge verde "Ativo/Ativa" para itens ativos — antes só exibiam "Inativo" para inativos.
- **Impacto:** Apenas frontend — mudanças puramente cosméticas (classes Tailwind + lógica condicional de badge). Nenhuma lógica de negócio alterada. Cobre 13 dos 19 itens da auditoria UX de 30/03. Itens 18 (wallet button nativo) e 15/Grupo5 (Switch para Ativar/Inativar) não implementados — são refatorações arquiteturais que requerem spec separada.

### [2026-03-30] — fix: dark mode em badges de estoque, anamnese e aniversariantes (task #013-ux)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/app/(dashboard)/reports/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/settings/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/dashboard/page.tsx`
- **O que foi feito:**
  - **reports/page.tsx**: badges de estoque (`Sem estoque`, `Baixo`, `OK`) receberam variantes `dark:bg-{color}-900/40 dark:text-{color}-300`.
  - **settings/page.tsx**: 3 badges de anamnese — tipo de pergunta (azul), `Obrigatório` (vermelho) e tag `com descrição` (azul pequeno) — receberam variantes dark mode.
  - **dashboard/page.tsx**: badge "próximos 7 dias" e avatar não-aniversariante do widget de aniversariantes receberam `dark:bg-pink-900/40 dark:text-pink-300`.
- **Impacto:** Apenas frontend — mudanças puramente cosméticas (classes Tailwind). Completa a varredura de dark mode do relatório UX pós-issues #116/#117.

### [2026-03-30] — fix: correções de contraste e dark mode pós-review #116/#117
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/app/(dashboard)/settings/_components/body-measurements-tab.tsx`
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/settings/_components/whatsapp-tab.tsx`
  - `aesthera/apps/web/app/(dashboard)/settings/_components/email-tab.tsx`
  - `aesthera/apps/web/lib/wallet-labels.ts`
  - `aesthera/apps/web/components/wallet/WalletOriginBadge.tsx`
- **O que foi feito:**
  - **body-measurements-tab.tsx**: badge `Simples` corrigido de `text-slate-600` para `text-slate-700` — contraste subiu de ~3.9:1 para ~5.8:1 (WCAG AA aprovado).
  - **customers/page.tsx**: `CONTRACT_STATUS_CLASS` (`pending` e `signed`) recebeu variantes `dark:bg-amber-900/40 dark:text-amber-300` e `dark:bg-green-900/40 dark:text-green-300` respectivamente. `TYPE_COLOR` já possuía dark mode completo — nenhuma alteração necessária.
  - **whatsapp-tab.tsx**: banner "WhatsApp conectado" atualizado de `bg-green-50/text-green-700` para `bg-green-100/text-green-800 font-medium` — maior profundidade visual e contraste ~6.5:1.
  - **email-tab.tsx**: banners "E-mail configurado" e "Conexão bem-sucedida" atualizados com o mesmo padrão do whatsapp-tab.
  - **wallet-labels.ts** e **WalletOriginBadge.tsx**: opacidade dos backgrounds dark mode dos badges de tipo/origem aumentada de `/30` para `/50` e texto de `-300` para `-200` — melhor discriminação visual entre tipos em dark mode.
- **Impacto:** Apenas frontend — mudanças puramente cosméticas (classes Tailwind). Nenhuma lógica de negócio alterada. Identificado em revisão UX pós-implementação das issues #116 e #117.

### [2026-03-30] — feat(#117): padronizar STATUS_COLOR no_show e dark mode dos badges de status
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/app/(dashboard)/dashboard/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/supplies/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/products/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/notifications/page.tsx`
- **O que foi feito:**
  - `dashboard/page.tsx` e `customers/page.tsx`: status `no_show` corrigido de `bg-red-100 text-red-800` para `bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200`; todos os demais status receberam variantes `dark:`.
  - `supplies/page.tsx`: badge Ativo/Inativo recebeu classes `dark:bg-green-900/30 dark:text-green-400` e `dark:bg-zinc-800 dark:text-zinc-400` respectivamente.
  - `products/page.tsx`: badge Ativo recebeu `dark:bg-green-900/30 dark:text-green-400`.
  - `notifications/page.tsx`: `pending` e `sent` receberam variantes `dark:` — `failed` já as tinha.
- **Impacto:** Apenas frontend — mudanças puramente cosméticas (classes Tailwind). Nenhuma lógica de negócio alterada. Badges agora consistentes e legíveis em dark mode em todo o sistema.

### [2026-03-28] — Testes unitários — Módulo de Medidas Corporais (issue #129)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.test.ts`
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.test.ts`
- **O que foi feito:**
  - **measurement-sheets.test.ts:** Adicionados 14 novos casos de teste cobrindo: (1) criação de ficha tipo TABULAR; (2) reativação com MAX_SHEETS_REACHED e reativação com sucesso; (3) campo com unidade em ficha TABULAR → ValidationError; (4) `deleteField` com histórico → HAS_HISTORY; (5) `deleteField` sem histórico → hard-delete; (6) `deleteField` cross-tenant → 403; (7) `createSheetColumn` em ficha SIMPLE → ValidationError; (8) `createSheetColumn` MAX_COLUMNS_REACHED; (9) `createSheetColumn` cross-tenant → 403; (10) `deleteSheetColumn` com histórico → HAS_HISTORY; (11) `deleteSheetColumn` sem histórico → hard-delete; (12) `deleteSheetColumn` cross-tenant → 403. Adicionados `COL_ID` e factory `makeColumn()`.
  - **measurement-sessions.test.ts:** Adicionados 7 novos casos de teste cobrindo: (1) `createSession` com cliente de outra clínica → 403; (2) `createSession` com sheetId de outra clínica → 403; (3) `createSession` com fieldId de outra clínica → 403; (4) `createSession` com columnId de sheet diferente → 403; (5) `createSession` com data retroativa ≤ 7 dias → sem logger.warn; (6) `updateSession` resultando em sessão vazia → EMPTY_SESSION; (7) `listSessions` passa `clinicId` correto ao repositório.
- **Impacto:** Cobertura dos serviços de medidas corporais expandida. Regras críticas de multi-tenancy, limites e validação de sessão agora protegidas por testes. Seções 1.1–1.6 e 2.1–2.3 da issue #129 cobertas. Seções 3 (integração Prisma real) e 4 (frontend) requerem setup adicional — não implementadas nesta entrega.

### [2026-03-28] — Logging diagnóstico para HTTP 403 em updateSession (issue #126 / PR #128)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/src/shared/errors/error-handler.ts` *(logging de AppError 4xx/5xx)*
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.service.ts` *(logger.warn antes de cada ForbiddenError)*
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.routes.ts` *(req.log passado para updateSession)*
- **O que foi feito:**
  - **error-handler.ts:** AppError 4xx agora emite `logger.warn`, AppError 5xx emite `logger.error`, com `code`, `status` e `message` — antes, esses erros respondiam HTTP sem nenhum log de aplicação.
  - **updateSession:** 5 pontos de `ForbiddenError` agora precedidos de `logger.warn` com contexto diagnóstico: `sessionId`, `clinicId`, `userId`, `userRole`, `sheetIds`, `fieldIds`, `columnMap` — permite identificar exatamente qual validação falhou ao reproduzir o 403 em produção.
  - **routes:** `req.log` (logger por-request do Fastify/Pino) passado como 6º argumento a `updateSession`, mantendo rastreabilidade de request ID.
- **Impacto:** Apenas backend. Sem migração de schema. Após deploy, os logs do Railway revelarão a causa exata do 403.

### [2026-03-30] — security(#137): correção de 3 falhas de multi-tenancy (crítico/alto/médio)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/src/modules/contracts/contracts.service.ts`
  - `aesthera/apps/api/src/modules/contracts/contracts.repository.ts`
  - `aesthera/apps/api/src/modules/contracts/contracts.service.test.ts`
  - `aesthera/apps/api/src/modules/payments/payments.routes.ts`
- **O que foi feito:**
  - **[CRÍTICO] Webhook Assinafy fail-fast**: `CONTRACTS_WEBHOOK_SECRET` não configurado agora lança `AppError(503)` imediatamente — antes, a ausência do secret tornava o endpoint público, permitindo marcar qualquer contrato como assinado sem autenticação.
  - **[ALTO] IDOR em updateTemplate/deleteTemplate/updateContract**: `_clinicId` substituído por `clinicId` incluso no `WHERE` do Prisma (Prisma 6 extended where unique) — garante que UPDATE/DELETE não operem em registros de outro tenant mesmo se chamados diretamente.
  - **[MÉDIO] Mock de pagamento sem auth**: `POST /payments/mock/pay/:gatewayPaymentId` agora exige `jwtClinicGuard + roleGuard(['admin'])` — antes, qualquer pessoa com o gatewayPaymentId e slug podia confirmar pagamentos em staging.
  - Testes de `contracts.service.test.ts` adaptados (Tipo 1 — Estrutural) para refletir a nova assinatura de `updateContract(clinicId, id, data)`.
- **Impacto:** Segurança — módulo Contracts e Payments. Sem alterações de schema ou migration. RLS planejado separadamente.

### [2026-03-30] — feat(#138): atualização em tempo real do status do contrato + botão de refresh
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/lib/hooks/use-resources.ts` *(useCustomerContracts atualizado)*
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(botão Atualizar + ícone RefreshCw)*
- **O que foi feito:**
  - `useCustomerContracts` agora usa `staleTime: 30_000` (30s) e `refetchOnWindowFocus: true` — ao voltar para a aba, a query é recarregada automaticamente.
  - Botão **Atualizar** (ícone `RefreshCw`, variant `ghost`, size `sm`) adicionado no cabeçalho da seção de contratos da ficha do cliente — chama `refetch()` e exibe `animate-spin` enquanto `isFetching` for `true`.
- **Impacto:** Frontend apenas — módulo Contratos na ficha do cliente. Sem alteração de backend.

### [2026-03-29] — feat(#133): assinatura remota por link — cliente assina pelo celular via WhatsApp
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(2 novos campos em `CustomerContract`: `signToken`, `signTokenExpiresAt`)*
  - `aesthera/apps/api/prisma/migrations/20260329000009_feat_contract_remote_sign/migration.sql` *(criada)*
  - `aesthera/apps/api/src/modules/contracts/contracts.dto.ts` *(`SendRemoteSignDto` + `SignRemoteDto`)*
  - `aesthera/apps/api/src/modules/contracts/contracts.service.ts` *(3 novos métodos: `generateSignToken`, `getPublicContractInfo`, `signRemote`)*
  - `aesthera/apps/api/src/modules/contracts/contracts.routes.ts` *(3 novas rotas: `POST /send-remote-sign` (auth), `GET /public/sign/:token` (pública), `POST /public/sign/:token` (pública))*
  - `aesthera/apps/api/src/app.ts` *(bypass do tenant middleware para `/public/sign/`)*
  - `aesthera/apps/api/src/modules/contracts/contracts.service.test.ts` *(12 novos testes — total: 22)*
  - `aesthera/apps/web/middleware.ts` *(`/sign` adicionado a `PUBLIC_PREFIXES`)*
  - `aesthera/apps/web/lib/hooks/use-resources.ts` *(interface `CustomerContract` atualizada + hook `useSendRemoteSignLink`)*
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(botão "Enviar para assinar" + dialog + indicador de link pendente)*
  - `aesthera/apps/web/app/sign/[token]/page.tsx` *(nova página pública de assinatura remota)*
- **O que foi feito:**
  - Geração de token UUID v4 com TTL de 48h. Link enviado via WhatsApp (Z-API) no formato `${frontendUrl}/sign/${token}`. Token de uso único — invalidado após assinatura.
  - Página pública `/sign/[token]` — sem autenticação, mobile-friendly, exibe dados do contrato, link para visualizar o PDF e canvas de assinatura inline. Todo texto em PT-BR.
  - `signRemote()` reutiliza o mesmo audit trail da #132 (signerIp, signerUserAgent, signerCpf, documentHash).
  - Indicador visual na lista de contratos quando há link pendente (`signTokenExpiresAt`).
  - 12 novos testes unitários: `generateSignToken` (3), `getPublicContractInfo` (4), `signRemote` (5).
- **Impacto:** Backend + frontend. Módulo Contracts. Sem alteração de regras de negócio existentes.

### [2026-03-29] — feat(#132): audit trail na assinatura manual — IP, timestamp, user-agent, CPF e hash do documento
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(3 novos campos em `CustomerContract`)*
  - `aesthera/apps/api/prisma/migrations/20260329000008_feat_contract_audit_trail/migration.sql` *(criada)*
  - `aesthera/apps/api/src/integrations/r2/r2.service.ts` *(nova função `getObjectBuffer`)*
  - `aesthera/apps/api/src/modules/contracts/contracts.service.ts` *(`signManual` atualizado + método `getAuditTrail` criado)*
  - `aesthera/apps/api/src/modules/contracts/contracts.routes.ts` *(user-agent passado ao `signManual` + nova rota `GET /audit-trail`)*
  - `aesthera/apps/api/src/modules/contracts/contracts.service.test.ts` *(criado — 10 testes)*
- **O que foi feito:**
  - `CustomerContract` recebeu os campos `signerUserAgent`, `signerCpf` e `documentHash` (todos nullable).
  - `signManual()` agora: captura `User-Agent` do header da request; copia `customer.document` (CPF) como snapshot; calcula SHA-256 do PDF do template via `getObjectBuffer()` (falha de R2 não bloqueia a assinatura — apenas loga o erro e define hash como null).
  - `signerIp` confirmado corretamente persistido (já estava sendo passado e salvo).
  - Novo endpoint `GET /customers/:customerId/contracts/:id/audit-trail` — retorna `contractId, status, signatureMode, signedAt, signerIp, signerUserAgent, signerCpf, documentHash`. Requer autenticação (`admin` ou `staff`).
  - 10 testes unitários cobrindo: caso feliz, cliente sem CPF, template sem PDF, contrato avulso, falha de R2, conflito de contrato já assinado, contrato cruzado (NotFoundError) nos métodos `signManual` e `getAuditTrail`.
- **Impacto:** Módulo Contracts — apenas backend. Sem alterações de frontend. Conformidade com Lei 14.063/2020 (evidências de autoria e integridade em assinaturas manuais).

### [2026-03-29] — feat(#126): sub-colunas, campos textuais e valor padrão em fichas de medidas (PR #128)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(4 modelos atualizados)*
  - `aesthera/apps/api/prisma/migrations/20260329000001_feat_measurement_sub_columns_textual/migration.sql` *(criada)*
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.dto.ts`
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.repository.ts`
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.service.ts`
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.dto.ts`
  - `aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.repository.ts`
  - `aesthera/apps/web/lib/hooks/use-measurement-sessions.ts`
  - `aesthera/apps/web/lib/hooks/use-measurement-sheets.ts`
  - `aesthera/apps/web/components/body-measurements/evolution-tab.tsx`
- **O que foi feito:**
  - **Feature 1 — Sub-colunas por campo:** `MeasurementField.subColumns String[]` — ex: `["D","E"]` para campos Direita/Esquerda. No formulário, cada célula da grade tabular é dividida em N sub-inputs lado a lado com label (ex: `D=` / `E=`). A chave de estado usa `colId::subCol` (forma composta). O `@@unique` de `MeasurementTabularValue` foi atualizado para incluir `subColumn`.
  - **Feature 2 — Campos textuais com valor padrão:** `MeasurementSheetColumn.isTextual Boolean + defaultValue String?` e `MeasurementField.isTextual Boolean`. Campos textuais exibem `<Input type="text">` ao invés de `number`, com `placeholder={col.defaultValue}`. `textValue` adicionado a `MeasurementValue` e `MeasurementTabularValue`.
  - **Feature 3 — Posição nas medidas:** Implementada via ficha TABULAR com coluna `isTextual=true` + `defaultValue` (ex: "00 cm acima do umbigo") — usuário edita apenas o valor, sem novo tipo de ficha.
  - **Histórico:** `SessionCard` exibe `textValue` em campos textuais e agrupa sub-colunas na mesma célula da tabela.
  - **Comparação:** `CompareModal` exibe campos textuais sem indicadores ↑/↓ e sub-colunas na mesma célula.
- **Commit:** `f48174e`

### [2026-03-28] — fix(#123): Padronização visual de filtros — busca pill, legenda, alinhamento (PR #130)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/components/ui/combobox-search.tsx` *(componente novo)*
  - `aesthera/docs/ui-standards.md` *(seção 7 adicionada)*
  - `aesthera/apps/web/app/(dashboard)/financial/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/contas-a-pagar/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/compras-insumos/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/billing/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/packages/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/sales/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/promotions/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/services/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/professionals/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/equipment/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/rooms/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/supplies/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/products/page.tsx`
- **O que foi feito:**
  - `ComboboxSearch` — componente genérico com debounce, `useEffect` cleanup no unmount, foco no input após limpar seleção (handleClear), ref no `<input>`.
  - Todos os campos de busca padronizados com estilo pill (`rounded-full border`).
  - Legenda descritiva (`bg-muted/50`) + botão "Restaurar padrão" em todas as telas com filtros.
  - URL sync (`useSearchParams` + `router.replace`) nas telas: Financeiro, Contas a Pagar, Cobranças, Vendas.
  - `financial/page.tsx`: alinhamento `items-end` nos filtros de data.
  - `compras-insumos/page.tsx`: removido card branco wrapper dos filtros; `isLoading` passado ao `ComboboxSearch`.
  - `contas-a-pagar/page.tsx`: `isDefaultFilters` e `buildFilterLabel` incluem `supplierSearch`.
  - `sales/page.tsx`: `isDefaultFilters` usa `search` (imediato) ao invés de `debouncedSearch`.
  - Telas adicionadas do zero com filtro + legenda: `supplies`, `products`, `customers`, `services`, `professionals`, `equipment`, `rooms`.
- **Closes:** #123

### [2026-03-27] — Correções e melhorias na aba Evolução — fichas tabulares e simples (issue #126 / PR #128)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/components/body-measurements/evolution-tab.tsx` *(bug de gravação, SessionCard, CompareModal)*
  - `aesthera/apps/web/lib/hooks/use-measurement-sessions.ts` *(type `sheetColumn.order` adicionado)*
  - `aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.repository.ts` *(`order` incluído no select do `sheetColumn`)*
- **O que foi feito:**
  - **Bug de gravação:** A validação de "ao menos 1 valor" foi movida para depois da montagem do `sheetRecords` (verificação no array resultante real, alinhada à lógica do backend). O erro `EMPTY_SESSION` intermitente ocorria porque `hasAnyValue` aprovava o formulário mesmo quando todos os campos tinham estado inválido (`NaN` ou não numérico) que eram descartados no filtro de construção do payload.
  - **Histórico de fichas (`SessionCard`):** Substituída a exibição de fichas TABULAR (por campo separado) por uma grade linha × coluna unificada com cabeçalho de colunas. Badge de tipo (Simples/Tabular) exibido no cabeçalho de cada ficha tanto no card expandido quanto nos badges do resumo colapsado. Colunas ordenadas por `order`.
  - **Botão "Comparar com anterior" (`CompareModal`):** Incluída comparação de valores TABULAR (`fieldId::columnId`). O modal agora exibe seções separadas "Medidas simples" e "Medidas tabulares". IMC calculado mantido na seção de simples.
- **Impacto:** Apenas frontend + 1 linha de backend (select). Sem migração de schema.

### [2026-03-25] — Treinamento dos agentes: padrões de filtros nos learnings (issue #124)
- **Arquivo(s) afetado(s):**
  - `ai-engineering/prompts/ux-reviewer/ux-reviewer-learnings.md`
  - `ai-engineering/prompts/aesthera-implementador/code-review-learnings.md`
  - `ai-engineering/prompts/aesthera-product-owner/product-owner-knowledge.md`
- **O que foi feito:** Registrados os padrões de filtros definidos na revisão transversal de 25/03/2026 nos três arquivos de aprendizado: (1) `ux-reviewer-learnings.md` — nova seção "Filtros e Barras de Busca" com 5 padrões (ComboboxSearch, pills, legenda ativa, botão restaurar, presets + URL sync); (2) `code-review-learnings.md` — nova seção "Filtros e Pesquisa" com 4 padrões correspondentes; (3) `product-owner-knowledge.md` — nova seção "Padrões de Filtros (obrigatório em specs)" com checklist de 5 itens e validação obrigatória pré-desenvolvimento.
- **Impacto:** Os três agentes (UX Reviewer, Implementador e Product Owner) passam a verificar e exigir automaticamente os padrões de filtros em revisões, implementações e specs futuras.

### [2026-03-25] — Treinamento do agente aesthera-issue-writer: regra obrigatória de padrões de filtros
- **Arquivo(s) afetado(s):** `ai-engineering/prompts/aesthera-issue-writer/aesthera-issue-writer-prompt.md`
- **O que foi feito:** Adicionada seção `## Padrões de Filtros — Obrigatório` (bloqueante) ao prompt do issue-writer, cobrindo: (1) `ComboboxSearch` obrigatório para campos de entidades cadastradas; (2) pills arredondados para status/tipo/categoria com ≤ 6 opções fixas; (3) legenda de filtros ativos (`bg-muted/50` + ícone `Info`); (4) botão "Restaurar padrão"; (5) presets de período (Hoje / 7d / 30d / 6m) + URL sync via `useSearchParams` em telas financeiras. Referência canônica definida como `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`. Item correspondente adicionado ao checklist de consistência do agente.
- **Impacto:** O agente `aesthera-issue-writer` passa a verificar e especificar obrigatoriamente os padrões de filtros em toda issue que envolva telas com filtros ou campos de busca, prevenindo divergências de implementação.

### [2026-03-24] — Melhorias de UX na Carteira e Ficha do Cliente (sem issue)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/app/(dashboard)/carteira/page.tsx` *(legenda descritiva de filtros; busca de cliente por nome no modo "Por cliente"; `CustomerSearchInput` local com debounce)*
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(`CustomerPackageItem` exibe número de sessão por serviço: "Massagem · sessão 2/5")*
- **O que foi feito:**
  - Legenda de filtros agora **sempre visível** (não só no estado padrão), exibindo dinamicamente o período, status, tipo e cliente ativo.
  - Filtro "Por cliente" substituído por campo de busca com autocomplete (debounced) igual ao padrão da aba Visão geral.
  - Histórico de sessões no pacote do cliente exibe número da sessão por serviço ("Massagem · sessão 1/3") quando há múltiplas sessões do mesmo serviço.
- **Impacto:** Apenas frontend. Sem migração ou mudança de API.

### [2026-03-25] — PR #119 \u2014 Issues #111 e #112 \u2014 Sub-aba Pacotes + Filtro de data em /carteira (feat branch)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/src/modules/wallet/wallet.dto.ts` *(`createdAtFrom`/`createdAtTo` com regex + `.refine()` de data v\u00e1lida)*
  - `aesthera/apps/api/src/modules/wallet/wallet.repository.ts` *(filtros `gte`/`lte` UTC-3 em `findAll`)*
  - `aesthera/apps/api/src/modules/wallet/wallet.service.ts` *(safe parse + `from > to` → 400; `> 730d` → `DATE_RANGE_TOO_LARGE`; `> 180d` → `logger.warn`)*
  - `aesthera/apps/api/src/modules/wallet/wallet.service.test.ts` *(5 novos cen\u00e1rios cobrindo valida\u00e7\u00e3o de intervalo de datas)*
  - `aesthera/apps/api/prisma/schema.prisma` *(`@@index([clinicId, createdAt])` no modelo `WalletEntry` — migration obrigat\u00f3ria antes do deploy)*
  - `aesthera/apps/web/lib/hooks/use-wallet.ts` *(`useWallet`/`useWalletOverview` aceitam `createdAtFrom`/`createdAtTo`)*
  - `aesthera/apps/web/app/(dashboard)/carteira/page.tsx` *(presets de data; inputs PT-BR; persist\u00eancia via URL params; `toISODate` com hora local; `isValidISODate`; bot\u00e3o "Restaurar padr\u00e3o" no aviso contextual)*
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(`CustomerWalletTab` com sub-tabs Carteira/Pacotes; role guard movido para dentro da sub-tab Carteira; `expiresAt` exibido; `toast.error` em erro de pacotes)*
- **O que foi feito:**
  - `#111`: Sub-aba **Pacotes** na ficha do cliente com lista expansível (`CustomerPackageItem`), badge de status, data de uso em PT-BR e link "Ver agendamento".
  - `#112`: Filtro `createdAtFrom`/`createdAtTo` no `GET /wallet` (backend + frontend), com valida\u00e7\u00e3o de data em ambas as camadas, presets de per\u00edodo e persist\u00eencia por URL.
- **Impacto:** FASE 3 itens 1 e 2 conclu\u00eddos. `@@index([clinicId, createdAt])` no schema exige migration antes do deploy em produ\u00e7\u00e3o.

### [2026-03-25] — Issues #113 e #114 — Módulo Uploads (Cloudflare R2 + LGPD) + Medidas Corporais implementados
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/src/integrations/r2/r2.service.ts` *(novo — presign PUT/GET, HEAD com diferenciação 404 vs 5xx, magic bytes)*
  - `aesthera/apps/api/src/modules/uploads/` *(novo — dto, repository, service, routes)*
  - `aesthera/apps/api/src/modules/body-measurements/` *(novo — dto, repository, service, routes)*
  - `aesthera/apps/api/prisma/schema.prisma` *(`FileCategory` enum, `CustomerFile`, `BodyMeasurementField/Record/Value`, `bodyDataConsentAt` em `Customer`)*
  - `aesthera/apps/api/prisma/migrations/20260327000001_feat_uploads_and_body_measurements/migration.sql` *(novo)*
  - `aesthera/apps/api/src/app.ts` *(registra `uploadsRoutes` + `bodyMeasurementsRoutes`)*
  - `aesthera/apps/api/package.json` *(`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` adicionados)*
  - `aesthera/apps/api/.env.example` *(`R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_URL`)*
  - `aesthera/apps/web/lib/hooks/use-body-measurements.ts` *(novo — hooks TanStack Query + upload helpers)*
  - `aesthera/apps/web/lib/hooks/use-resources.ts` *(`bodyDataConsentAt` adicionado ao tipo `Customer`)*
  - `aesthera/apps/web/app/(dashboard)/settings/_components/body-measurements-tab.tsx` *(novo — CRUD de campos, limite 30)*
  - `aesthera/apps/web/app/(dashboard)/settings/page.tsx` *(nova aba "Medidas Corporais")*
  - `aesthera/apps/web/components/body-measurements/evolution-tab.tsx` *(novo — cards, galeria, modal upload)*
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx` *(nova aba "Evolução")*
- **O que foi feito:**
  - `#113`: Integração Cloudflare R2 com presign PUT/GET, validação de magic bytes (JPEG/PNG/WebP/PDF), proteção IDOR (`CROSS_TENANT_VIOLATION` + `INVALID_STORAGE_KEY_PREFIX` 403), path traversal bloqueado, diferenciação de erros 404 vs 5xx no `headObject`. Verificação de consentimento LGPD Art. 11I (`BODY_DATA_CONSENT_REQUIRED` 422), soft-delete via `deletedAt`. `storageKey` pattern `{clinicId}/{customerId}/{uuid}.{ext}`. `roleGuard` explícito em todos os endpoints.
  - `#114`: Campos de medição configuráveis por clínica (máx 30 ativos — `MAX_FIELDS_REACHED`), `updateField`/`deactivateField` com `clinicId` via `updateMany` (IDOR). Registros imutáveis com `recordedAt` retroativo, valores `Decimal(10,2)`, fotos vinculadas com validação de `customerId`. RN18: profissional só acessa clientes com histórico de atendimento **confirmado** (`status in confirmed/in_progress/completed`). IMC calculado localmente no frontend (nunca persistido). Frontend com aba "Evolução" na ficha do cliente e aba "Medidas Corporais" nas configurações.
- **Impacto:** PR #121 aberto (`Closes #113`, `Closes #114`). FASE 3 itens `BodyMeasurements` + `Uploads` concluídos. Requer `prisma migrate dev` + variáveis R2 no `.env` para deploy.

### [2026-03-24] — Fluxo de Pagamento, Pacotes e Promoções — Spec Final consolidada (aesthera-consolidador)
- **Arquivo(s) afetado(s):** `outputs/consolidador/fluxo-pagamento-pacotes-promocoes-spec-final.md` *(novo)*
- **O que foi feito:** Spec final consolidada pelo `aesthera-consolidador` a partir do `outputs/po/fluxo-pagamento-pacotes-promocoes-doc.md` (Product Owner) + revisões de UX Reviewer (P-01 a P-14), Security Auditor (6 bloqueantes + 3 atenções) e System Architect (4 bloqueantes B-01–B-04 + 6 sugestões S-01–S-06). **2 conflitos resolvidos:** (C-01) mensagens de cupom PT-BR apenas para autenticados + rate limiting (Security prevalece); (C-02) status de sessão explícito via migration (arquiteto prevalece). **Decisões de Produto Pendentes** documentadas em DP-01, DP-02, DP-04, DP-05, DP-06, DP-07 — devem ser respondidas antes do início da implementação. Principais mudanças incorporadas: `appointmentId` nullable em `Billing` e `CustomerPackageSession`; `dueDate = now()` em package sale; cupom integrado em `ManualReceiptsService.receive()`; `apply()` dentro de `prisma.$transaction()`; `RoleGuard` explícito em todos os endpoints novos; idempotência via `Idempotency-Key`; `SELECT FOR UPDATE` em `maxUses`/`maxUsesPerCustomer`; validação backend de `sum(paymentMethods) >= package.price`; `customerId` validado contra `clinicId`; rate limiting em `POST /promotions/validate`; badges de status com cores definidas; pill "Todos" nos filtros; estados de loading em botões assíncronos; `isDirty` guard no `PackageSaleModal`.
- **Impacto:** Spec pronta para o issue-writer. Implementação bloqueada por DP-01 e DP-02 (decisões de produto críticas). Schema Prisma requer 7 migrations encadeadas na ordem definida no BLOCO 6.

### [2026-03-24] — FASE 3 Cliente e Relacionamento — Spec Final consolidada (aesthera-consolidador)
- **Arquivo(s) afetado(s):** `ai-engineering/projects/aesthera/features/fase3-cliente-relacionamento-spec-final.md` *(novo)*
- **O que foi feito:** Spec final da FASE 3 gerada pelo `aesthera-consolidador` a partir do `fase3-cliente-relacionamento-doc.md` (Product Owner) + revisões de UX Reviewer, Security Auditor e System Architect. Todos os **18 bloqueantes** incorporados (6 Security + 6 Arquitetura + 6 UX). Principais correções consolidadas: (1) Nomes e posição da aba "Carteira" corrigidos conforme código real (`profile/history/wallet/prontuario/contracts`); (2) Saldo total calculado via endpoint dedicado ou pré-paginação (nunca soma de lista paginada); (3) `BodyMeasurementValue.clinicId` obrigatório (convenção global do schema); (4) `CustomerFile.deletedAt DateTime?` em vez de `Boolean` (soft-delete padrão do projeto); (5) Validação cross-tenant obrigatória em `POST /uploads/presign` (prevenção de IDOR); (6) Guard + validação `file.clinicId` em `GET /uploads/:id/url`; (7) RN18 definida com critério SQL concreto (Appointment.professionalId + customerId + clinicId); (8) Base legal LGPD documentada + campo `bodyDataConsentAt` em Customer; (9) Tabela de guards por endpoint; (10) Verificação de magic bytes em `POST /uploads/confirm`; (11) Migration `@@index([clinicId, createdAt])` em WalletEntry marcada como obrigatória antes de expor filtro; (12) Timezone UTC-3 em queries de data de carteira; (13) "Limpar filtros" → "Restaurar padrão"; (14) Grade 2–3 colunas para formulário de medidas; (15) Cards expandíveis por data no histórico de evolução; (16) Seletor de categoria inline por arquivo no upload; (17) Variáveis R2/S3 adicionadas ao `railway.toml`; (18) Ordem de migrations explicitada (CustomerFile precede BodyMeasurementRecord).
- **Impacto:** Spec final pronta para o issue-writer. Itens 3, 10 e 11 podem ser implementados diretamente (sem pré-requisitos adicionais). Item 20 aguarda issue separada de infraestrutura de uploads. Prioridade de implementação definida: Item 11 → Item 3 → Item 10 → Pré-requisito Uploads → Item 20.

### [2026-03-24] — FASE 3 Cliente e Relacionamento — Especificação Completa criada pelo PO
- **Arquivo(s) afetado(s):** `ai-engineering/projects/aesthera/features/fase3-cliente-relacionamento-doc.md` *(novo)*
- **O que foi feito:** Expandida a ideia da FASE 3 (issue #20) em especificação completa de produto cobrindo 4 sub-funcionalidades: (1) Aba "Carteira" na ficha do cliente com entradas de wallet e pacotes; (2) Filtro por data de criação na tela global de Carteira (padrão: últimos 6 meses + ativos); (3) Labels amigáveis em PT-BR para todos os enums de `WalletOriginType`, `WalletTransactionType`, `WalletEntryType` e `WalletEntryStatus`; (4) Módulo de Registro de Medidas Corporais configurável com histórico temporal, upload de fotos (before/after/measurement/exam) via pre-signed URL (Cloudflare R2), categorias de arquivo e integração opcional com N8N. Spec inclui: modelos Prisma completos (`BodyMeasurementField`, `BodyMeasurementRecord`, `BodyMeasurementValue`, `CustomerFile`), endpoints de API, infra de uploads como pré-requisito, cobertura de testes necessária, considerações LGPD e ordem de implementação sugerida.
- **Impacto:** Módulos `Wallet` (melhorias de UX), `Customers` (nova aba Carteira + nova aba Evolução), novos módulos `BodyMeasurements` e `Uploads` especificados e prontos para revisão por UX, Security e Arquiteto.

### [2026-03-24] — PR #108 Code Review — Correções de atomicidade, multi-tenancy, validações e testes
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/api/prisma/schema.prisma` *(`@db.Date` em `AccountsPayable.dueDate`; FK `ManualReceiptLine → WalletEntry` com `@@index` composto)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.dto.ts` *(regex `^\d{4}-\d{2}-\d{2}$` em `from`/`to`)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.repository.ts` *(`updateMany + findFirst` com `clinicId` em `update/markPaid/markCancelled`; `clinicId` obrigatório em `markOverdueBatch`)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.service.ts` *(`pay()` em `prisma.$transaction`; `runOverdueCron(clinicId)` exige clinicId)*
  - `aesthera/apps/api/src/modules/accounts-payable/accounts-payable.routes.ts` *(cron passa `req.clinicId`)*
  - `aesthera/apps/api/src/modules/manual-receipts/manual-receipts.dto.ts` *(`ManualReceiptLineDto` como `discriminatedUnion` — `walletEntryId` obrigatório apenas para `wallet_credit`/`wallet_voucher`)*
  - `aesthera/apps/api/src/modules/manual-receipts/manual-receipts.service.ts` *(`paidAt` usa `dto.receivedAt`; P2002 → 409; `wallet.use()` e `ledger.createCreditEntry()` recebem `tx`)*
  - `aesthera/apps/api/src/modules/ledger/ledger.repository.ts` *(`Tx` exportado; `tx?` em `create()`)*
  - `aesthera/apps/api/src/modules/ledger/ledger.service.ts` *(`tx?` em `createCreditEntry/createDebitEntry`)*
  - `aesthera/apps/api/src/modules/wallet/wallet.service.ts` *(`providedTx?` em `use()` — padrão `run` pattern)*
  - `aesthera/apps/api/src/modules/supply-purchases/supply-purchases.service.ts` *(AP criado inline em `prisma.$transaction` em vez de via serviço externo)*
  - `aesthera/apps/api/src/modules/supply-purchases/supply-purchases.service.test.ts` *(`mockTx.accountsPayable.create` adicionado)*
  - `aesthera/apps/api/src/modules/appointments/appointments.service.test.ts` *(`makeCreateDto({ roomId: undefined })` no teste `[GAP-R10]`)*
  - `aesthera/apps/web/lib/hooks/use-accounts-payable.ts` *(`AccountsPayablePaymentMethod` type exportado; `usePayAccountsPayable` tipado)*
  - `aesthera/apps/web/app/(dashboard)/contas-a-pagar/page.tsx` *(datas com `T12:00:00.000Z`; `paymentMethod` tipado como `AccountsPayablePaymentMethod`; `PAYMENT_METHOD_OPTIONS` com `as const satisfies`)*
  - `aesthera/apps/web/components/receive-manual-modal.tsx` *(`canConfirm` valida `walletEntryId` para métodos wallet)*
- **O que foi feito:** Aplicadas todas as 18 correções do Copilot Code Review no PR #108. Principais melhorias: (1) Atomicidade com `prisma.$transaction` propagada para `AccountsPayable.pay()`, `ManualReceipts.create()` e `SupplyPurchases.create()`; (2) Multi-tenancy reforçado com `updateMany({ where: { id, clinicId } })` no repositório de AP; (3) Cron de AP agora escopado por clínica (`clinicId` obrigatório); (4) DTO de recibo manual com `discriminatedUnion` garantindo que `walletEntryId` só seja exigido quando o método é wallet; (5) Datas de vencimento no PostgreSQL como `@db.Date` + FK FK referencial no schema; (6) Fuso horário corrigido no frontend (T12 evita off-by-one em BRT -03:00); (7) Race condition P2002 em `ManualReceipt` → 409 `BILLING_ALREADY_PAID`.
- **Impacto:** Operações financeiras críticas são agora atômicas. Multi-tenancy reforçado impede vazamento de dados entre clínicas. Validações mais rígidas nos DTOs evitam 500 do Prisma por datas inválidas. 117 testes unitários passando.

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

### [2026-03-30] — #134 — Paginação server-side em todas as telas de listagem (PR #141)
- **Arquivo(s) afetado(s):**
  - `aesthera/apps/web/components/ui/data-pagination.tsx` _(novo)_
  - `aesthera/apps/web/lib/hooks/use-paginated-query.ts` _(novo)_
  - `aesthera/apps/web/lib/hooks/use-resources.ts`
  - `aesthera/apps/web/app/(dashboard)/financial/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/billing/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/customers/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/contas-a-pagar/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/sales/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/professionals/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/compras-insumos/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/services/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/supplies/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/equipment/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/rooms/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/products/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/packages/page.tsx`
  - `aesthera/apps/web/app/(dashboard)/promotions/page.tsx`
  - `aesthera/docs/ui-standards.md`
- **O que foi feito:**
  - Criados `usePaginatedQuery` (lê/grava `page`/`pageSize` na URL, suporta `paramPrefix` para múltiplas listas) e `DataPagination` (componente com contador, numeração com ellipsis e seletor de tamanho)
  - Todas as 15 telas de listagem migradas de "carregar tudo" para paginação server-side
  - Busca textual migrada para server-side (`search`/`name` param) nas telas que suportam: professionals, services, supplies, equipment, rooms, products
  - `useEquipment` e `useRooms` atualizados para retornar `Paginated<T>` e aceitar params
  - Todas as páginas envolvidas em `<Suspense fallback={null}>` (obrigatório por `useSearchParams`)
  - Documentação: seção 2.6 Paginação adicionada ao `ui-standards.md`
- **Impacto:** Elimina carregamento de todos os registros em listagens, reduzindo latência e uso de memória. Melhora a experiência em clínicas com grande volume de dados.

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
