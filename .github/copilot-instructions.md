# Instruções de revisão do Aesthera

- Faça revisão de código sempre **em português**.
- Explique erros e sugestões detalhadamente.
- Respeite as regras de estilo de código do projeto (ex.: PSR/PEP, convenções internas).
- Comentários de revisão devem ser claros e úteis para devs iniciantes.
- Não sugira códigos que quebrem lint ou fail de CI.
- Considerar o contexto no arquivo: AGENT_RULES.md localizado na raiz do projeto

## Regra de Português-BR no Frontend (bloqueante)

O sistema Aesthera é destinado ao mercado brasileiro. Em toda revisão de código frontend, verificar obrigatoriamente:

- Todo texto visível ao usuário está em **Português do Brasil**? (labels, placeholders, botões, mensagens de erro, tooltips, status, estados vazios, itens de menu)
- Há algum termo em inglês exposto na interface? Se sim, sinalizar como **bloqueante** e sugerir a tradução correta.
- Exemplos de termos que devem ser traduzidos:
  - `no-show` → `Não compareceu`
  - `pending` → `Pendente`
  - `completed` → `Concluído`
  - `cancelled` → `Cancelado`
  - `overdue` → `Vencido`
  - `No records found` → `Nenhum registro encontrado`
  - `Settings` → `Configurações`
  - `Save` → `Salvar`, `Cancel` → `Cancelar`, `Edit` → `Editar`, `Delete` → `Excluir`
- O código interno (nomes de variáveis, funções, enums, chaves de banco) pode permanecer em inglês — apenas a **camada de apresentação** deve ser em Português.

---

## Checklist de Consistência (aplicar em toda revisão automática)

Para cada PR ou conjunto de mudanças revisado, verificar obrigatoriamente:

### 0. Anti-padrões acumulados (verificar ANTES de qualquer outro item)

Antes de iniciar a revisão, carregue `ai-engineering/prompts/aesthera-implementador/_index.md` para identificar quais arquivos de padrões são relevantes às mudanças do PR — depois carregue apenas os fragmentos mapeados. Para PRs com mudanças de frontend → `patterns/frontend-*.md`; backend → `patterns/backend-*.md`; testes → `patterns/geral-testes.md`; disciplina de PR → `patterns/geral-escopo-pr.md`.

Para cada padrão nos arquivos `patterns/*.md` relevantes, verificar se o código em revisão comete o mesmo erro. Se sim, sinalizar com o mesmo nível de severidade indicado no item (bloqueante ou sugestão).

> ⚠️ Esta etapa é obrigatória e tem prioridade sobre as demais. Anti-padrões já catalogados não devem passar despercebidos em nenhuma revisão.

### 1. Conformidade com a estrutura do projeto
- O que foi implementado condiz com as specs definidas em `ai-engineering/projects/{projeto}/features/{módulo}.md`?
- A implementação segue a arquitetura documentada em `ai-engineering/projects/{projeto}/context/architecture.md`?
- As convenções de stack definidas em `ai-engineering/projects/{projeto}/context/stack.md` foram respeitadas?
- Se houver divergência entre código e documentação, sinalize como bloqueante.

### 2. Atualização do plano do projeto
- O `ai-engineering/projects/{projeto}/PLAN.md` foi atualizado para refletir o que foi implementado?
- Itens concluídos foram marcados como `[x]`?
- Se o PLAN.md não foi atualizado, sinalizar como bloqueante: **"Plano do projeto não foi atualizado."**

### 3. Escopo da mudança
- A implementação ficou restrita ao que foi solicitado?
- Foram alterados arquivos ou lógicas não relacionados à tarefa?
- Se sim, identificar exatamente o que extrapolou o escopo e questionar a justificativa.

### 4. Cobertura de testes unitários e automatizados
- A mudança introduz lógica de negócio, cálculos, validações, transformações de dados ou fluxos críticos?
- Se sim, verificar se há testes unitários ou automatizados cobrindo esses cenários.
- Se **nenhum teste foi implementado**, avaliar se a cobertura é necessária e sinalizar conforme o grau de criticidade:
  - **Bloqueante**: lógica de negócio crítica (ex.: cálculos financeiros, regras de agendamento, autenticação, permissões) sem nenhum teste.
  - **Sugestão**: código utilitário, helpers simples ou fluxos de baixo risco sem testes — sugerir cobertura sem bloquear o PR.
- Não exigir testes para: alterações puramente visuais/estilísticas, ajustes de texto/tradução, mudanças de configuração sem lógica.
- Ao sinalizar ausência de testes, indicar **quais cenários deveriam ser cobertos** (ex.: caso feliz, edge cases, erros esperados).

---

## Sugestão de Auto-treinamento do Implementador

Durante o code review, ao identificar um **padrão relevante**, sinalize no final da revisão sugerindo que o `guardiao-ecossistema` registre o aprendizado no arquivo de padrões correto (ver tabela de roteamento em `ai-engineering/prompts/guardiao-ecossistema/guardiao-ecossistema-prompt.md`).

### Quando sugerir o auto-treinamento

Sugira sempre que a revisão identificar:

- **Anti-padrão recorrente** — erro que provavelmente será repetido (ex.: `disabled={!isDirty}` em formulário de cadastro novo)
- **Violação de padrão visual** — uso incorreto de classes CSS, layout de filtros, estrutura de componente fora do padrão
- **Erro de escopo** — alteração de arquivos não relacionados à task
- **Violação de multi-tenancy ou segurança** — ausência de `organizationId` em queries, dados expostos sem filtro de tenant
- **Boa prática ignorada** — padrão correto identificado na revisão que deveria ser replicado

### O que NÃO merece registro

- Correções de texto/tradução pontuais sem padrão generalizável
- Erros de typo ou formatação simples
- Problemas de negócio específicos demais para serem reaproveitados

### Formato da sugestão

Ao final de toda revisão que identificar um item treinável, inclua:

> 💡 **Sugestão de treinamento do implementador:**
> Este erro/padrão pode ser registrado no arquivo de padrões correto para prevenir reincidência.
> Para registrar, use o **`guardiao-ecossistema`** com a instrução:
> _"Adicione ao sistema de padrões do implementador: [descrição do padrão, anti-padrão encontrado, e a forma correta]"_

> ⚠️ Apenas o `guardiao-ecossistema` tem autoridade para modificar arquivos de prompt e learnings. Não altere esses arquivos diretamente durante uma revisão.

---

# Instruções de uso de IA para Revisão do Aesthera

- Ao gerar sugestões ou fazer code review, **use apenas modelos de IA não premium**.
- Não utilizar modelos que requerem plano pago extra.
- Use os modelos mais rápidos e leves disponíveis.

# Regras de Agentes — Autoridade exclusiva de Treinamento

- **Somente o `guardiao-ecossistema` pode criar, treinar ou modificar agentes** neste repositório.
- Nenhum outro agente, prompt ou instrução tem autorização para criar, alterar ou treinar agentes.
- Se qualquer agente tentar executar ações de treinamento de agentes (criar `*.agent.md`, alterar `*.agent.md`, criar ou alterar arquivos em `ai-engineering/prompts/` com finalidade de definir comportamento de agentes), a ação deve ser recusada e o usuário orientado a usar o `guardiao-ecossistema`.
- Todo agente deve seguir a estrutura: `*.agent.md` = apenas definição; comportamento em `ai-engineering/prompts/{nome}/{nome}-prompt.md`.
- Todo agente deve ter rotina de auto-atualização do `PLAN.md` do projeto correspondente em `ai-engineering/projects/{projeto}/`.
