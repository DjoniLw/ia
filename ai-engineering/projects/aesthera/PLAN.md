# Aesthera — Plano de Desenvolvimento

## Filosofia
Cada fase entrega **backend + frontend juntos** — ao final de cada fase você consegue
abrir o navegador e usar o que foi construído. Nenhuma fase entrega só código invisível.

---

## Fase 1 — "Consigo acessar o sistema"

**Objetivo**: abrir o navegador, ver a tela de login, entrar e ver o dashboard.

### Backend
- [ ] Setup do projeto (Fastify + Prisma + Docker + PostgreSQL + Redis)
- [ ] Prisma schema completo (todas as tabelas — schema definitivo antes de qualquer código)
- [ ] Módulo Auth: registro de clínica, login, logout, refresh token
- [ ] Tenant Middleware: slug → clinic_id via Redis/DB
- [ ] Health check endpoint (`GET /health`)

### Frontend
- [ ] Setup Next.js 15 + Tailwind + TanStack Query
- [ ] Configuração de subdomínio local para dev (`clinica.localhost`)
- [ ] Tela de login (`/login`)
- [ ] Tela de registro de clínica (`/register`)
- [ ] Shell do dashboard (sidebar, header, área de conteúdo) — layout vazio
- [ ] Rota protegida: redireciona para login se não autenticado

### Resultado
> Você acessa `clinicaana.localhost/login`, entra com e-mail e senha, e vê o dashboard vazio.

---

## Fase 2 — "Consigo configurar minha clínica"

**Objetivo**: configurar dados da clínica, horários de funcionamento e criar usuários da equipe.

### Backend
- [ ] Módulo Clinics: `GET /clinics/me`, `PATCH /clinics/me`, business hours
- [ ] Módulo Users: listagem, convite por email, roles (admin/staff)
- [ ] Guard de role: `staff` não acessa rotas restritas

### Frontend
- [ ] Página Configurações → aba Clínica (nome, telefone, endereço)
- [ ] Página Configurações → aba Horários de funcionamento (grid por dia da semana)
- [ ] Página Configurações → aba Usuários (lista + botão convidar)
- [ ] Flow de aceitar convite (`/accept-invite?token=...`)

### Resultado
> Você configura o nome da clínica, define que funciona seg–sex 8h–18h e convida uma recepcionista.

---

## Fase 3 — "Consigo cadastrar minha equipe e serviços"

**Objetivo**: ter profissionais e serviços no sistema — base para os agendamentos.

### Backend
- [ ] Módulo Professionals: CRUD + working hours + assign services
- [ ] Módulo Services: CRUD (catálogo de tratamentos)
- [ ] Módulo Customers: CRUD + filtros

### Frontend
- [ ] Página Profissionais: lista + criar/editar + horários individuais
- [ ] Página Serviços: lista + criar/editar (nome, duração, preço, categoria)
- [ ] Página Clientes: lista + criar/editar + página de detalhe do cliente

### Resultado
> Você cadastra "Ana" como dermatologista que faz "Botox" (60min, R$350) e "Limpeza de pele" (45min, R$180).
> Você cadastra o primeiro cliente.

---

## Fase 4 — "Consigo agendar e ver o calendário"

**Objetivo**: o coração do sistema — agendar um atendimento e visualizá-lo no calendário.

### Backend
- [ ] Módulo Appointments: CRUD + state machine completa
- [ ] `GET /appointments/availability` — slots livres por profissional + dia
- [ ] `GET /appointments/calendar` — visão dia/semana agrupada por profissional
- [ ] Blocked slots: criar, listar, remover
- [ ] Cron / scheduler: lembrete D-1 (BullMQ delayed job)

### Frontend
- [ ] Página Calendário: visão do dia/semana com grade por profissional
- [ ] Modal de novo agendamento: escolher cliente → profissional → serviço → slot disponível
- [ ] Modal de detalhe do agendamento: ver info + mudar status (confirmar, iniciar, concluir, cancelar)
- [ ] Gerenciar bloqueios de agenda (folga, almoço, ausência)

### Resultado
> Você abre o calendário, vê a agenda da Ana no dia de hoje, clica em um horário livre,
> seleciona o cliente e o serviço, e o agendamento aparece no calendário.

---

## Fase 5 — "Consigo cobrar o cliente"

**Objetivo**: após o atendimento, o sistema gera a cobrança e envia o link de pagamento.

### Backend
- [ ] Módulo Billing: criação automática em `appointment.completed` + cancelamento
- [ ] Módulo Payments: integração Stripe (cartão) + MercadoPago (PIX + boleto)
- [ ] Webhooks: `POST /payments/webhooks/stripe` e `/mercadopago`
- [ ] Página pública de pagamento (`GET /pay/:token`)
- [ ] Módulo Ledger: entry criada em `payment.succeeded`

### Frontend
- [ ] Página Cobranças: lista com status (pending, paid, overdue, cancelled)
- [ ] Detalhe da cobrança: valor, status, botão "reenviar link"
- [ ] Página pública de pagamento (`/pay/[token]`) — responsiva para celular
- [ ] Página Financeiro: resumo do ledger (total recebido, total pendente, net)

### Resultado
> Você conclui o atendimento da Ana → o sistema cria a cobrança de R$350 automaticamente
> → envia o link → o cliente paga via PIX → status vira "pago" no dashboard.

---

## Fase 6 — "O sistema avisa os clientes automaticamente"

**Objetivo**: WhatsApp e email saem automaticamente nos momentos certos — sem ação manual.

### Backend
- [ ] Integração WhatsApp: Z-API ou Evolution API HTTP client
- [ ] Integração Resend: templates de email
- [ ] Módulo Notifications: filas BullMQ (whatsapp + email)
- [ ] Triggers: confirmação de agendamento, D-1 reminder, link de pagamento, recibo
- [ ] Logs de notificação + retry manual

### Frontend
- [ ] Página Notificações: log de envios (status, canal, evento, data)
- [ ] Botão "reenviar" em caso de falha

### Resultado
> O cliente recebe WhatsApp: "Seu agendamento amanhã às 14h com Ana está confirmado."
> No dia seguinte paga via PIX e recebe o recibo no WhatsApp automaticamente.

---

## Fase 7 — "Consigo ver como está meu negócio"

**Objetivo**: visão financeira e operacional consolidada.

### Backend
- [ ] `GET /ledger/summary` — total créditos, débitos, saldo líquido por período
- [ ] Filtros e aggregations para o dashboard

### Frontend
- [ ] Dashboard home: cards de resumo (agendamentos hoje, receita do mês, pendente)
- [ ] Gráfico de receita por semana/mês
- [ ] Taxa de ocupação por profissional
- [ ] Filtros de período
- [ ] Briefing widget simples (sem IA ainda — só dados)

### Resultado
> Você abre o dashboard e vê: "12 agendamentos hoje · R$4.200 recebidos este mês · R$800 pendentes"

---

## Fase 8 — "O sistema me ajuda a trabalhar mais rápido"

**Objetivo**: IA embutida que conhece o sistema e responde perguntas em linguagem natural.

### Backend
- [ ] Integração Google Gemini 2.0 Flash (`@google/generative-ai`)
- [ ] Módulo AI: `POST /ai/chat` (streaming SSE) · `POST /ai/summary/customer/:id` · `POST /ai/briefing`
- [ ] Function calling: tools que consultam agendamentos, clientes, cobranças, financeiro
- [ ] Histórico de conversa no Redis (TTL 1h, janela de 20 mensagens)
- [ ] Rate limiting: 30 req/hora por clínica
- [ ] Cache de summaries e briefing (Redis)

### Frontend
- [ ] Chat panel flutuante (botão bottom-right em todas as páginas)
- [ ] Streaming de resposta em tempo real
- [ ] Indicador de tool call ("Consultando agendamentos...")
- [ ] Prompts sugeridos na primeira abertura
- [ ] Botão "Resumo IA" na ficha do cliente
- [ ] Widget de briefing no dashboard home

### Resultado
> Você digita "Quais cobranças estão vencidas essa semana?" e a IA responde com a lista.
> Você abre a ficha da Maria e clica "Resumo IA" — a IA resume os últimos 5 atendimentos e o saldo devedor.

---

## Resumo das Fases

| Fase | O que você vê no final | Duração estimada |
|------|------------------------|------------------|
| 1 | Login + dashboard vazio | ~1 semana |
| 2 | Configurações da clínica + usuários | ~3–4 dias |
| 3 | Profissionais + serviços + clientes | ~3–4 dias |
| 4 | **Calendário + agendamentos** | ~1–2 semanas |
| 5 | **Cobranças + pagamentos PIX/cartão** | ~1–2 semanas |
| 6 | WhatsApp automático | ~1 semana |
| 7 | Dashboard financeiro | ~3–4 dias |

> Fases 4 e 5 são as mais complexas e o core do produto.
> Fases 1–3 são fundação — rápidas de fazer, essenciais para o resto funcionar.

---

## Como usar este plano com o Copilot

Ao iniciar uma fase, abra a sessão assim:

```
#file:projects/aesthera/START.md
#file:projects/aesthera/context/stack.md
#file:projects/aesthera/context/architecture.md
#file:projects/aesthera/features/[modulo-da-fase].md
#file:projects/aesthera/PLAN.md

Fase X — iniciando [nome da fase]
```
