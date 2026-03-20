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
- [x] Módulo Supplies: CRUD de insumos + estoque + `minStock` + vínculo com serviços (`ServiceSupply`)
- [x] Módulo Wallet: vouchers, créditos, cashback, saldo de pacote — com log de transações append-only
- [x] Módulo Promotions: códigos de desconto (PERCENTAGE / FIXED) com janela de validade, `maxUses`, `minAmount` e filtro por serviço
- [x] Módulo Packages: pacotes de serviços com pré-geração de sessões + resgate + integração com Wallet

### Frontend
- [x] Página Equipamentos: lista + criar/editar + toggle ativo
- [x] Página Salas: lista + criar/editar + toggle ativo
- [x] Página Insumos: lista com badge de estoque + criar/editar + alerta de estoque baixo
- [x] Página Carteira (por cliente): lista de entradas + criar voucher/crédito + ajuste de saldo
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
- [ ] #45 — Exibir clínica e usuário logado no header/sidebar
- [ ] #46 — Controle de acesso por perfil de usuário no frontend
- [ ] #47 — Auto-preenchimento de endereço por CEP (ViaCEP)
- [ ] #48 — Máscaras de entrada para CPF, CNPJ, telefone e CEP
- [ ] #49 — Cadastro e configuração de formas de pagamento da clínica

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

### [2026-03-20] — Treinamento do agente aesthera-implementador: obrigatoriedade de testes unitários
- **Arquivo(s) afetado(s):** `ai-engineering/prompts/aesthera-implementador/aesthera-implementador-prompt.md`
- **O que foi feito:** Adicionada regra obrigatória de testes nas "Regras de Implementação". Fluxo de trabalho atualizado com passo 3 "Criar ou atualizar testes". Adicionada seção completa "Testes Unitários e Automatizados" com: framework (Vitest), localização dos arquivos (`{módulo}.service.test.ts` co-localizado), regras para código novo (sempre criar) e código existente (verificar + atualizar testes afetados), padrão de estrutura de arquivo de test com `vi.hoisted`/`vi.mock`, tabela de cenários obrigatórios e o que não testar por ora.
- **Impacto:** Agente `aesthera-implementador` — toda implementação nova ou alteração em código coberto agora exige criação/revisão de testes. Alinha com o `vitest.config.ts` existente e o teste de referência `wallet.service.test.ts`.

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
