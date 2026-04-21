# Mapeamento de Telas — Aesthera

**Última atualização:** 15/04/2026  
**Fonte original:** Relatório UX — Mapeamento de Telas (`outputs/ux/aesthera-ux-mapeamento-telas-2026-03-31.md`)

---

## ⚠️ Regras de Manutenção (obrigatórias para todos os agentes)

Este arquivo é o **registro canônico de todas as telas do sistema Aesthera**.

Todo agente que atuar em criação, alteração ou remoção de telas **deve**:

| Evento | Ação obrigatória |
|--------|-----------------|
| **Nova tela criada** | Adicionar entrada neste arquivo com rota, tipo, campos e ações |
| **Tela alterada** (layout, campos, abas, ações) | Atualizar a entrada correspondente neste arquivo |
| **Tela removida** | Remover a entrada deste arquivo |

> ⛔ Nenhuma tarefa de criação/alteração/remoção de tela está concluída sem que este arquivo esteja atualizado.

---

## Classificação de Tipos de Tela

| Tipo | Descrição |
|------|-----------|
| **Consulta** | Função principal é listar ou visualizar registros. Pode ter modais/formulários embutidos. |
| **Ação** | Orientada a executar uma operação ou fluxo crítico. Pode conter formulários operacionais. |
| **Visual** | Somente leitura — gráficos, dashboards, relatórios. Pode ter filtros. |
| **Configuração** | Formulários de ajuste do sistema. Organizada em abas independentes. |

---

## Índice de Telas

| Tela | Rota | Tipo | Formulário embutido? |
|------|------|------|----------------------|
| [Clientes](#clientes-customers) | `/customers` | Consulta | ✅ Novo/Editar Cliente |
| [Profissionais](#profissionais-professionals) | `/professionals` | Consulta | ✅ Novo/Editar Profissional |
| [Serviços](#servicos-services) | `/services` | Consulta | ✅ Novo/Editar Serviço |
| [Produtos](#produtos-products) | `/products` | Consulta | ✅ Novo/Editar Produto + Vender Produto |
| [Pacotes](#pacotes-packages) | `/packages` | Consulta | ✅ Novo/Editar Pacote + Vender Pacote |
| [Suprimentos](#suprimentos-supplies) | `/supplies` | Consulta | ✅ Novo Suprimento (inline) |
| [Salas](#salas-rooms) | `/rooms` | Consulta | ✅ Nova Sala (inline) |
| [Equipamentos](#equipamentos-equipment) | `/equipment` | Consulta | ✅ Novo Equipamento (inline) |
| [Promoções](#promocoes-promotions) | `/promotions` | Consulta | ✅ Nova/Editar Promoção (modal) |
| [Compras de Insumos](#compras-de-insumos-compras-insumos) | `/compras-insumos` | Consulta | ✅ Nova Compra (painel lateral) |
| [Contas a Pagar](#contas-a-pagar-contas-a-pagar) | `/contas-a-pagar` | Consulta | ✅ Nova Conta + Registrar Pagamento |
| [Vendas](#vendas-sales) | `/sales` | Consulta | ✅ Nova Venda (modal) |
| [Carteira](#carteira-carteira) | `/carteira` | Consulta | ✅ Criar Crédito + Ajuste de Saldo |
| [Agendamento](#agendamento-appointments) | `/appointments` | Ação | ✅ Novo Agendamento + Painel de Detalhes |
| [Cobranças](#cobrancas-billing) | `/billing` | Ação | ✅ Nova Pré-venda + Nova Cobrança + Detalhe + Reabrir + Cancelar |
| [Configurações](#configuracoes-settings) | `/settings` | Configuração | ✅ Por aba |
| [Perfil](#perfil-settingsprofile) | `/settings/profile` | Configuração | ✅ Dados do usuário logado |
| [Início / Dashboard](#inicio-dashboard-dashboard) | `/dashboard` | Visual | 🔍 Não — somente leitura |
| [Financeiro](#financeiro-financial) | `/financial` | Visual | 🔍 Não — somente leitura |
| [Relatórios](#relatorios-reports) | `/reports` | Visual | 🔍 Não — somente leitura |
| [Notificações](#notificacoes-notifications) | `/notifications` | Visual | 🔍 Não — somente leitura |

---

## Detalhamento por Tela

---

### Clientes `/customers`

**Tipo:** Consulta  
**Descrição:** Lista paginada de clientes com busca por nome, e-mail ou CPF e filtro por status. Painel lateral de detalhes ao clicar em um cliente.

#### Formulário de cadastro/edição — abas:

| Aba | Campos |
|-----|--------|
| Dados Básicos | Nome*, e-mail*, 2 telefones, CPF, RG, gênero, data de nascimento |
| Endereço | CEP (com busca automática), logradouro, número, complemento, bairro, cidade, estado |
| Contratos & LGPD | Vincular e assinar modelos de contrato LGPD *(somente na edição)* |

`*` Campo obrigatório

#### Painel de detalhes do cliente — abas:

| Aba | Conteúdo |
|-----|----------|
| Dados | Visualização dos dados cadastrais com opção de edição |
| Histórico | Agendamentos do cliente com status, serviço e valor |
| Carteira | Sub-abas: **Carteira** (vouchers/créditos ativos, saldo, extrato de transações) e **Pacotes** (pacotes comprados e sessões restantes) |
| Prontuário | Lançamentos clínicos classificados por tipo: Anamnese, Exame, Observação, Procedimento, Prescrição |
| Contratos | Contratos do cliente com status de assinatura e ações de assinar/enviar |
| Evolução | Registros de medidas corporais nas fichas configuradas no sistema |
| Avaliações | Histórico clínico completo com filtro por categoria (Corporal, Facial, Dermato-funcional, Nutricional, Postural, Personalizada), badges de categoria por sessão e fichas personalizadas por cliente |
| Fotos | Galeria de fotos do cliente com upload direto (sem sessão obrigatória), lightbox navegável (prev/next + swipe), modo de seleção para comparação side-by-side de 2 fotos, badges de tag (Antes/Depois/Progresso) e indicador de vínculo com sessão de avaliação |

---

### Profissionais `/professionals`

**Tipo:** Consulta  
**Descrição:** Lista paginada com busca por nome e filtro por status (Todos / Ativos / Inativos). Formulário em modal sem abas.

#### Formulário de cadastro/edição (sem abas):

Campos em sequência vertical: Nome*, e-mail*, telefone, especialidade, endereço completo (com busca por CEP).

`*` Campo obrigatório

#### Painel de detalhes — seções:

| Seção | Conteúdo |
|-------|----------|
| Dados | Informações cadastrais do profissional |
| Serviços vinculados | Lista de serviços com toggle para vincular/desvincular |

---

### Serviços `/services`

**Tipo:** Consulta  
**Descrição:** Lista paginada com busca por nome e filtro por status. Seção expansível com insumos vinculados por serviço.

#### Formulário de cadastro/edição (sem abas):

Nome*, descrição, categoria, duração (múltiplos de 15 min)*, preço de exibição*. Na edição: toggle de status ativo/inativo.

`*` Campo obrigatório

---

### Produtos `/products`

**Tipo:** Consulta  
**Descrição:** Lista paginada com busca por nome. Seção expansível com histórico de vendas por produto. Ação de venda direta disponível por linha.

#### Formulário de cadastro/edição (sem abas):

Nome*, descrição, categoria, marca, SKU, preço de custo, preço de venda*, estoque atual, unidade de medida.

#### Formulário de venda (sem abas):

Cliente (opcional), quantidade*, desconto.

`*` Campo obrigatório

---

### Pacotes `/packages`

**Tipo:** Consulta  
**Descrição:** Lista paginada com busca. Seção expansível com serviços e sessões incluídas. Ação de venda a cliente disponível por linha.

#### Formulário de cadastro/edição (sem abas):

Nome*, descrição, validade (dias), preço total*, lista de serviços com quantidade de sessões cada (mínimo 1 serviço)*.

#### Formulário de venda (sem abas):

Cliente*, forma de pagamento, data de compra.

`*` Campo obrigatório

---

### Suprimentos `/supplies`

**Tipo:** Consulta  
**Descrição:** Lista paginada de insumos/materiais com busca por nome. Exibe estoque atual, unidade de medida e custo unitário.

#### Formulário de cadastro/edição (sem abas):

Nome*, unidade de medida, custo unitário, estoque mínimo.

`*` Campo obrigatório

---

### Salas `/rooms`

**Tipo:** Consulta  
**Descrição:** Lista de salas disponíveis com status ativo/inativo por linha.

#### Formulário de cadastro/edição (sem abas):

Nome*, descrição, status.

`*` Campo obrigatório

---

### Equipamentos `/equipment`

**Tipo:** Consulta  
**Descrição:** Lista de equipamentos disponíveis na clínica.

#### Formulário de cadastro/edição (sem abas):

Nome*, descrição.

`*` Campo obrigatório

---

### Promoções `/promotions`

**Tipo:** Consulta  
**Descrição:** Lista paginada de cupons e promoções com busca por nome/código e filtro por status. Exibe uso atual vs. limite, período de validade e toggle de ativação/desativação.

#### Formulário de criação (sem abas):

Nome*, código do cupom*, descrição, tipo de desconto (percentual ou valor fixo)*, valor do desconto*, limite total de usos, limite por cliente, valor mínimo de compra, data de início*, data de término.

#### Formulário de edição (sem abas):

Nome, descrição, limite total de usos, limite por cliente, valor mínimo de compra, data de término, status.

`*` Campo obrigatório

---

### Compras de Insumos `/compras-insumos`

**Tipo:** Consulta  
**Descrição:** Lista paginada de compras registradas com busca por nome do insumo e filtro por período. Exibe fornecedor, quantidade, custo total e data.

#### Formulário de nova compra (sem abas):

Insumo*, fornecedor, unidade de compra*, fator de conversão, quantidade*, custo unitário*, data da compra*, observações.

`*` Campo obrigatório

---

### Contas a Pagar `/contas-a-pagar`

**Tipo:** Consulta  
**Descrição:** Listagem de contas com painel de resumo (total pendente / vencido / pago no mês). Busca por descrição e filtro por período e status. Ação de registrar pagamento por linha.

#### Formulário de nova conta (sem abas):

Descrição*, valor*, vencimento*, categoria*, recorrência, parcelas, observações.

#### Formulário de registrar pagamento (sem abas):

Forma de pagamento, data de pagamento, observações.

`*` Campo obrigatório

---

### Vendas `/sales`

**Tipo:** Consulta  
**Descrição:** Lista paginada de vendas de produtos com busca. Exibe produto, cliente, quantidade, forma de pagamento, valor e data.

#### Formulário de nova venda (sem abas):

Produto*, quantidade*, desconto, cliente*, forma de pagamento, observações.

`*` Campo obrigatório

---

### Carteira `/carteira`

**Tipo:** Consulta  
**Descrição:** Listagem geral de entradas de carteira de todos os clientes com filtro por cliente, tipo, status e período. Ação de ajuste de saldo disponível por linha ativa.

#### Formulário de criar crédito (sem abas):

Título, valor*, vencimento, moeda, tipo.

#### Formulário de ajuste de saldo (sem abas):

Tipo de ajuste*, valor*, motivo.

`*` Campo obrigatório

---

### Agendamento `/appointments`

**Tipo:** Ação  
**Descrição:** Calendário de agendamentos. Novo agendamento ao clicar em horário vazio. Painel de detalhes ao clicar em agendamento existente.

#### Visualizações alternáveis:

| View | Descrição |
|------|-----------|
| Dia | Colunas por profissional, horários na vertical, agendamentos como blocos clicáveis |
| Semana | Grade semanal por profissional |
| Mês | Visão mensal simplificada com contagem de agendamentos por dia |

#### Formulário de novo agendamento (sem abas):

Cliente (busca)*, serviço*, profissional*, data*, hora*, duração, sala, equipamentos, pacote de sessão (se aplicável), observações.

#### Painel de detalhes do agendamento:

Status, cliente (com link ao perfil), serviço, profissional, sala, valor.  
Ações disponíveis: confirmar, cancelar, registrar pagamento, receber manualmente.

`*` Campo obrigatório

---

### Cobranças `/billing`

**Tipo:** Ação  
**Descrição:** Listagem paginada de cobranças de serviços, pré-vendas e registros avulsos. Filtros multiselect por status, origem, serviço, atendente, cliente e período. Totalizador de recebimentos e breakdown por forma de pagamento. URL-sync de filtros.  
**Última atualização:** 04/04/2026 — PR #148

**Modais e ações embutidos:**

| Modal / Ação | Trigger | Descrição |
|---|---|---|
| **Nova Pré-venda de Serviço** | Botão primário no cabeçalho | Cria cobrança PRESALE vinculada a cliente e serviço; ao ser paga gera vale SERVICE_PRESALE na carteira |
| **Nova Cobrança** | Botão outline no cabeçalho | Cria cobrança avulsa MANUAL sem vínculo obrigatório a serviço |
| **Registrar Recebimento** | Botão por linha (cobranças pendentes/vencidas) | Abre `ReceiveManualModal` com suporte a múltiplas formas de pagamento e vouchers |
| **Ver detalhe** | Botão por linha (cobranças pagas/canceladas) | Abre `BillingDetailModal` com histórico de eventos e linhas de recebimento |
| **Reabrir** | Botão por linha (cobranças pagas/canceladas) | Dialog de confirmação; reverte pagamento, restaura carteira/vale; exibe aviso quando há vale de pré-venda |
| **Cancelar** | Botão por linha (cobranças pendentes/vencidas) | Dialog de confirmação com alerta de irreversibilidade |

---

### Configurações `/settings`

**Tipo:** Configuração  
**Descrição:** Configurações gerais do sistema organizadas em abas. Cada aba é um formulário independente.  
**Última atualização:** 14/04/2026 — feat(#158)

| Aba | O que configura |
|-----|----------------|
| Clínica | Nome, CNPJ, endereço e logo da clínica |
| Formas de Pagamento | Habilitar/desabilitar PIX, cartão, dinheiro, parcelamento e configuração de juros |
| Horários | Dias e faixas de horário de funcionamento por dia da semana |
| Usuários | Listagem de usuários, envio de convites e controle de papel/acesso |
| Integrações IA | Configuração de chaves de API para funcionalidades com IA |
| WhatsApp | Integração com Evolution API para envio de notificações automáticas |
| Anamnese | Grupos e perguntas de anamnese com drag-and-drop e toggle de obrigatoriedade |
| Fichas de Avaliação | Redesign em três painéis: navegação lateral por 6 categorias (Corporal, Facial, Dermato-Funcional, Nutricional, Postural, Personalizada), lista de fichas com drag-and-drop por categoria, e painel de edição de campos (Simples ou Tabular). Biblioteca de modelos pré-configurados do sistema. |
| Contratos | Upload de modelos de contrato LGPD em PDF |
| E-mail | Configuração de SMTP ou provedor de e-mail |

---

### Perfil `/settings/profile`

**Tipo:** Configuração  
**Descrição:** Edição dos dados do usuário logado. Sem abas.

**Campos:** nome, e-mail, senha, avatar.

---

### Início / Dashboard `/dashboard`

**Tipo:** Visual  
**Descrição:** Tela inicial com visão geral do negócio. Sem abas. Somente leitura.

**Exibe:** métricas financeiras do dia e do mês (receitas, faturamento pendente), lista dos próximos agendamentos do dia com horário e cliente, indicadores de agendamentos em andamento.

---

### Financeiro `/financial`

**Tipo:** Visual  
**Descrição:** Extrato financeiro com gráficos e listagem de transações. Sem abas. Somente leitura.

**Exibe:** total de créditos, débitos e saldo líquido no período; gráfico de barras de evolução por período; tabela de transações com tipo, descrição, cliente, serviço e valor.

---

### Relatórios `/reports`

**Tipo:** Visual  
**Descrição:** Relatórios gerenciais com gráficos e tabelas. Organizado em abas por módulo. Somente leitura.

| Aba | O que exibe |
|-----|------------|
| Clientes | Crescimento de clientes cadastrados por mês (gráfico de barras) e listagem detalhada |
| Vendas | Vendas de produtos por período — gráfico de formas de pagamento (pizza) e tabela detalhada |
| Serviços | Serviços mais realizados no período — gráfico de pizza e ranking |
| Estoque | Situação atual do estoque de suprimentos por categoria e alertas de estoque mínimo |

---

### Notificações `/notifications`

**Tipo:** Visual  
**Descrição:** Histórico de notificações enviadas pelo sistema aos clientes (WhatsApp e e-mail). Sem abas. Somente leitura.

---

## Histórico de Alterações

| Data | Tela | Tipo de mudança | Responsável |
|------|------|----------------|-------------|
| 31/03/2026 | Todas | Criação inicial do arquivo | UX Review + Treinador |
| 14/04/2026 | Configurações → Fichas de Avaliação | Renomeada aba "Medidas Corporais" → "Fichas de Avaliação"; redesign para layout de 3 painéis com 6 categorias, drag-and-drop e biblioteca de modelos pré-configurados | feat(#158) |
| 15/04/2026 | Clientes → aba Avaliações | Renomeada aba "Evolução" → "Avaliações"; filtro de categoria por pills, badges de categoria por sessão, modal de seleção de fichas agrupado (Clínica / Cliente), botão "Nova ficha deste cliente" com autorização por role | feat(#159) |
