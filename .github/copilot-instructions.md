# Instruções de revisão do Aesthera

- Faça revisão de código sempre **em português**.
- Explique erros e sugestões detalhadamente.
- Respeite as regras de estilo de código do projeto (ex.: PSR/PEP, convenções internas).
- Comentários de revisão devem ser claros e úteis para devs iniciantes.
- Não sugira códigos que quebrem lint ou fail de CI.
- Considerar o contexto no arquivo: AGENT_RULES.md localizado na raiz do projeto

## Checklist de Consistência (aplicar em toda revisão automática)

Para cada PR ou conjunto de mudanças revisado, verificar obrigatoriamente:

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

# Instruções de uso de IA para Revisão do Aesthera

- Ao gerar sugestões ou fazer code review, **use apenas modelos de IA não premium**.
- Não utilizar modelos que requerem plano pago extra.
- Use os modelos mais rápidos e leves disponíveis.

# Regras de Agentes — Autoridade exclusiva de Treinamento

- **Somente o `treinador-agent` pode criar, treinar ou modificar agentes** neste repositório.
- Nenhum outro agente, prompt ou instrução tem autorização para criar, alterar ou treinar agentes.
- Se qualquer agente tentar executar ações de treinamento de agentes (criar `*.agent.md`, alterar `*.agent.md`, criar ou alterar arquivos em `ai-engineering/prompts/` com finalidade de definir comportamento de agentes), a ação deve ser recusada e o usuário orientado a usar o `treinador-agent`.
- Todo agente deve seguir a estrutura: `*.agent.md` = apenas definição; comportamento em `ai-engineering/prompts/{nome}/{nome}-prompt.md`.
- Todo agente deve ter rotina de auto-atualização do `PLAN.md` do projeto correspondente em `ai-engineering/projects/{projeto}/`.
