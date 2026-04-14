# Índice de Padrões — Roteamento por Tipo de Elemento

> Este arquivo é o ponto de entrada da **Fase 1 (Planejamento)**.
> Carregue APENAS este arquivo primeiro. A partir da decomposição da tarefa, identifique quais fragmentos carregar na Fase 2.

---

## Como usar

1. Leia a issue e decomponha em elementos individuais (campo de busca, botão, endpoint, etc.)
2. Para cada elemento, localize o tipo na tabela abaixo
3. Monte a lista de arquivos de padrões a carregar por elemento
4. Produza o **bloco de planejamento visível** antes de implementar qualquer coisa
5. Na Fase 2, para cada elemento: carregue apenas os arquivos mapeados → implemente → exiba output → aguarde confirmação → próximo

---

## Bloco de Planejamento (formato obrigatório)

```
📋 PLANO DE EXECUÇÃO — {nome da issue}

Elementos identificados:
1. {elemento} → carregar: {arquivo(s)}
2. {elemento} → carregar: {arquivo(s)}
...

Iniciar pelo elemento 1? Aguardando confirmação.
```

---

## Tabela de Roteamento

| Elemento a criar/modificar | Arquivo(s) de padrões |
|---|---|
| **Frontend — Filtros e Listagens** | |
| Campo de busca textual | `patterns/frontend-filtros-listagens.md` |
| Filtro de status (pills) | `patterns/frontend-filtros-listagens.md` + `patterns/frontend-cores-status.md` |
| `<ComboboxSearch>` (seleção de entidade da API) | `patterns/frontend-filtros-listagens.md` + `patterns/frontend-componentes.md` |
| Tabela / listagem de dados | `patterns/frontend-filtros-listagens.md` |
| Paginação (`<DataPagination>`) | `patterns/frontend-filtros-listagens.md` |
| Tab / seção com lista interna | `patterns/frontend-filtros-listagens.md` |
| Legenda de filtros ativos / botão "Restaurar padrão" | `patterns/frontend-filtros-listagens.md` |
| Filtro em tela financeira (data/período com presets) | `patterns/frontend-filtros-listagens.md` |
| **Frontend — Cores e Status** | |
| Badge / chip de status | `patterns/frontend-cores-status.md` |
| Constante `STATUS_COLOR` / `STATUS_LABEL` | `patterns/frontend-cores-status.md` |
| Label PT-BR de enum | `patterns/frontend-cores-status.md` |
| Dark mode em badges / componentes | `patterns/frontend-cores-status.md` |
| Cor de brand / cor primária da tela | `patterns/frontend-cores-status.md` |
| **Frontend — Componentes** | |
| Botão de ação (salvar, excluir, editar, cancelar) | `patterns/frontend-componentes.md` |
| Modal / overlay / Dialog | `patterns/frontend-componentes.md` |
| Toggle / switch booleano | `patterns/frontend-componentes.md` |
| Caixa de aviso / alerta / informação contextual | `patterns/frontend-componentes.md` |
| Estado vazio (empty state com CTA) | `patterns/frontend-componentes.md` |
| Ícones | `patterns/frontend-componentes.md` |
| Toast / feedback de ação | `patterns/frontend-componentes.md` |
| Totalizadores / KPIs financeiros | `patterns/frontend-componentes.md` |
| **Frontend — Formulários** | |
| Formulário (campos de input) | `patterns/frontend-formularios.md` |
| Botão Salvar (lógica `disabled`) | `patterns/frontend-formularios.md` |
| Campo de seleção (select, radio, dropdown) | `patterns/frontend-formularios.md` |
| Campo de data / date picker | `patterns/frontend-formularios.md` |
| **Backend — Segurança** | |
| Endpoint / rota Fastify | `patterns/backend-seguranca.md` |
| Guard de acesso / `roleGuard` | `patterns/backend-seguranca.md` |
| Handler de webhook | `patterns/backend-seguranca.md` |
| Upload / storage / presign + confirm | `patterns/backend-seguranca.md` |
| **Backend — Prisma** | |
| Query Prisma (findMany, findFirst, findUnique) | `patterns/backend-prisma.md` |
| Update / delete Prisma | `patterns/backend-prisma.md` |
| Transação (`$transaction`) | `patterns/backend-prisma.md` |
| Migration Prisma (schema change) | `patterns/backend-prisma.md` |
| Domain events / `EventEmitter` | `patterns/backend-prisma.md` |
| Verificação de conflito / disponibilidade | `patterns/backend-prisma.md` |
| **Backend — Validação** | |
| Schema Zod / DTO | `patterns/backend-validacao.md` |
| Validação de regra de negócio no service | `patterns/backend-validacao.md` |
| **Geral** | |
| Arquivo de teste (`*.test.ts` / `*.spec.ts`) | `patterns/geral-testes.md` |
| Novo método em `*.service.ts` (qualquer método) | `patterns/geral-testes.md` + `patterns/backend-validacao.md` |
| PR (escopo, disciplina de mudança) | `patterns/geral-escopo-pr.md` |
| Task de máscara / formatação pontual | `patterns/geral-escopo-pr.md` |

---

## Quando múltiplos domínios se combinam

Alguns elementos naturalmente cruzam domínios. Em caso de dúvida, carregue todos os arquivos indicados:

- **Nova tela completa (backend + frontend)**: `backend-seguranca.md` + `backend-prisma.md` + `backend-validacao.md` + `frontend-filtros-listagens.md` + `frontend-cores-status.md` + `frontend-componentes.md` + `frontend-formularios.md`
- **Listagem com filtros de status**: `frontend-filtros-listagens.md` + `frontend-cores-status.md`
- **Formulário de cadastro/edição**: `frontend-formularios.md` + `frontend-componentes.md`
- **Endpoint com query e validação**: `backend-seguranca.md` + `backend-prisma.md` + `backend-validacao.md`
