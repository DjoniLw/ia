# Preferências e Convenções — Projeto de IA

> Fonte da verdade para agentes e IA trabalhando neste repositório.
> Mantido atualizado pelo `guardiao-ecossistema`.
> **Nunca usar memória interna do Copilot (`/memories/`) — este repositório é compartilhado entre máquinas.**

---

## Convenções de Agentes

### Ícone no nome
- O campo `name` no frontmatter do `.agent.md` usa ícone emoji como prefixo
- Formato: `name: 🔍 aesthera-discovery`
- O ícone aparece na lista de agentes do VS Code — usar sempre para identificação visual rápida

### Estrutura obrigatória de arquivos
```
.github/agents/{nome}.agent.md                          ← apenas frontmatter + referência ao prompt
ai-engineering/prompts/{nome}/{nome}-prompt.md          ← todo o comportamento
```

- O `*.agent.md` nunca contém lógica ou instruções operacionais — apenas identidade e caminho para o prompt
- Todo agente deve ter rotina de auto-atualização do `PLAN.md` do projeto correspondente

### Regras de autoridade (valem para todos os projetos)
- **Somente `guardiao-ecossistema`** pode criar, treinar ou modificar agentes neste repositório
- Nenhum outro agente tem permissão de alterar arquivos em `.github/agents/` ou `ai-engineering/prompts/`

---

## Lista de Agentes Ativos

| Agente | Papel |
|---|---|
| `🔍 aesthera-discovery` | Ideia → Issue (pipeline de descoberta) |
| `🚀 aesthera-delivery` | Issue → Código entregue (pipeline de entrega / SDD) |
| `📋 spec-tecnica` | Gera spec técnica de implementação a partir de issue |
| `🏗️ aesthera-implementador` | Orquestra implementação de código no Aesthera |
| `⚙️ backend-implementador` | Subagente de backend (invocado pelo implementador) |
| `🎨 frontend-implementador` | Subagente de frontend (invocado pelo implementador) |
| `📝 aesthera-product-owner` | Expande ideias em specs funcionais |
| `🏛️ aesthera-system-architect` | Decisões de arquitetura e design técnico |
| `🔄 aesthera-consolidador` | Consolida revisões em spec_final.md |
| `📌 aesthera-issue-writer` | Cria issues no GitHub |
| `🔎 code-reviewer` | Revisa PRs e gera relatório de correções |
| `🔒 security-auditor` | Audita segurança, LGPD, multi-tenancy |
| `🧪 test-guardian` | Valida cobertura de testes e qualidade |
| `🖥️ ux-reviewer` | Revisa UX, usabilidade e PT-BR na interface |
| `🎓 guardiao-ecossistema` | Único autorizado a criar/treinar/modificar agentes |

---

## Metodologia SDD (Spec-Driven Development)

Todo ciclo de entrega de feature segue dois pipelines sequenciais conectados pelo número da issue:

```
Ideia → [aesthera-discovery] → Issue → [aesthera-delivery] → Código entregue
```

### Pipeline de Descoberta — `🔍 aesthera-discovery`
- **Entrada:** ideia ou feature descrita pelo usuário
- **Saída:** issue criada no GitHub
- Orquestra: PO → UX + Security + Arquiteto → Consolidador → Issue-Writer

### Pipeline de Entrega — `🚀 aesthera-delivery`
- **Entrada:** número da issue do GitHub
- **Saída:** código implementado, testado, documentado e revisado
- **7 fases:** Spec Técnica → Refinamento (checkpoint humano) → Implementação → Checklist DoD → Testes → Documentação → Code Review
- **Regra:** para obrigatoriamente na Fase 2 para aprovação do usuário antes de implementar

### Agente de Spec Técnica — `📋 spec-tecnica`
- Fase 1 do `aesthera-delivery`
- Produz: contratos de API, escopo de arquivos, estrutura de componentes, DoD checklist
- Salva em: `outputs/spec-tecnica/{nome}-spec-tecnica.md`
- Nunca implementa código — apenas especifica

---

## Onde registrar conhecimento

| Tipo de conhecimento | Onde registrar |
|---|---|
| Convenções gerais de agentes, metodologia | `ai-engineering/AGENT-PREFERENCES.md` (este arquivo) |
| Contexto específico de um projeto | `ai-engineering/projects/{projeto}/context/` |
| Infraestrutura técnica de um projeto | `ai-engineering/projects/{projeto}/AGENT-PREFERENCES.md` |
| Histórico de ações e entregas | `ai-engineering/projects/{projeto}/PLAN.md` |
