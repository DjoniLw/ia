# AI Engineering — Guia do Workspace

Este diretório contém toda a documentação de contexto e prompts usados para desenvolver projetos com assistência de IA (GitHub Copilot, ChatGPT, Claude).

---

## Como Funciona

Cada projeto tem sua própria pasta em `projects/` com arquivos de contexto que você fornece à IA no início de cada sessão. Isso garante que a IA entenda o projeto, a stack, a arquitetura e as regras antes de escrever qualquer código.

```
ai-engineering/
├── projects/
│   ├── aesthera/        ← Contexto completo do projeto Aesthera
│   └── fluxa/           ← Contexto completo do projeto Fluxa
└── shared/
    ├── agents/          ← Personas reutilizáveis entre projetos
    └── prompts/         ← Templates de prompts genéricos
```

---

## Iniciando uma Sessão de Desenvolvimento

### No VS Code (GitHub Copilot Chat)

```
#file:projects/<projeto>/START.md
#file:projects/<projeto>/context/stack.md
#file:projects/<projeto>/context/architecture.md
#file:projects/<projeto>/features/<modulo>.md

Etapa X — [descrição do que fazer]
```

### Em chat externo (ChatGPT, Claude etc.)

Cole o conteúdo de:
1. `projects/<projeto>/START.md`
2. `projects/<projeto>/context/stack.md`
3. `projects/<projeto>/context/architecture.md`
4. `projects/<projeto>/features/<modulo>.md` (apenas o módulo relevante)

---

## Projetos Disponíveis

| Projeto | Descrição | START |
|---------|-----------|-------|
| **Aesthera** | SaaS ERP para clínicas estéticas | [`projects/aesthera/START.md`](projects/aesthera/START.md) |
| **Fluxa** | Plataforma de billing API-first | [`projects/fluxa/START.md`](projects/fluxa/START.md) |

---

## Adicionando um Novo Projeto

1. Crie a pasta: `projects/<nome-do-projeto>/`
2. Crie os arquivos de contexto seguindo a estrutura abaixo:

```
projects/<nome-do-projeto>/
├── START.md             ← Ponto de entrada — leia antes de qualquer sessão
├── PLAN.md              ← Plano de desenvolvimento em fases (opcional)
├── context/
│   ├── project.md       ← Goal, constraints, out of scope
│   ├── stack.md         ← Stack completo com versões
│   └── architecture.md  ← Estrutura de pastas, data flow, decisões
├── features/
│   └── <modulo>.md      ← Spec de cada módulo: endpoints, regras, modelos
├── agents/
│   └── system-architect.md  ← Persona do agente com regras do projeto
└── prompts/
    ├── create-module.md     ← Template para gerar módulo (versão projeto)
    └── generate-tests.md    ← Template para gerar testes (versão projeto)
```

3. Copie o código do projeto para `../<nome-do-projeto>/apps/api/` e/ou `../<nome-do-projeto>/apps/web/`

---

## Prompts e Agentes Compartilhados

Ficam em `shared/` e podem ser reutilizados por qualquer projeto:

| Arquivo | Uso |
|---------|-----|
| `shared/agents/base-architect.md` | Persona base do agente arquiteto |
| `shared/prompts/code-review.md` | Revisão de código com checklist |
| `shared/prompts/create-module.md` | Criação de módulo genérico |
| `shared/prompts/generate-tests.md` | Geração de testes genérica |

---

## Dicas de Uso

- **Sempre forneça o contexto completo** no início de cada sessão — a IA não tem memória entre conversas.
- **Use apenas os `features/*.md` relevantes** para a etapa atual — menos contexto = respostas mais precisas.
- **Mantenha os arquivos de contexto atualizados** conforme o projeto evolui.
- **Siga a Ordem de Desenvolvimento** definida no `START.md` de cada projeto para garantir dependências corretas.
