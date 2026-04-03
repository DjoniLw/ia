# UX Reviewer Learnings — Aesthera

> Este arquivo é mantido automaticamente pelo `treinador-agent`.
> Cada item representa um padrão confirmado por revisões reais de UX no Aesthera.
> **Leia este arquivo antes de qualquer revisão Aesthera** e use cada item como filtro ativo durante a inspeção.

---

## Como usar

Antes de concluir qualquer revisão de tela, componente ou PR do Aesthera, percorra cada item abaixo e verifique:
`"Esse padrão foi respeitado no que estou revisando?"`

Se não → sinalize como quebra de padrão no relatório de UX.

---

## Metodologia de Revisão

### Mapeamento de Telas — Inspecionar imports, não só o page.tsx

- [ ] **Ao mapear formulários e ações de uma tela, nunca analisar apenas o arquivo `page.tsx` — é obrigatório inspecionar também os componentes externos importados**
  - 🔴 Anti-padrão: buscar apenas por `<form>`, `handleSubmit`, `required` dentro do `page.tsx` e concluir que a tela não tem formulários ou ações se não encontrar nada — isso gera falso negativo
  - ✅ Correto: ao fazer o mapeamento de uma tela, verificar os imports do arquivo e inspecionar componentes do tipo `Modal`, `Dialog`, `Tab`, `Button de ação por linha`, `Drawer`, `Sheet` que possam conter formulários ou operações críticas
  - 📌 Casos reais onde isso causou erro:
    - `/billing` → ação de recebimento estava em `ReceiveManualModal` importado — tela classificada erroneamente como "somente visual"
    - `/sales` → arquivo `page.tsx` não foi lido — tela omitida completamente do mapeamento
    - `/carteira` → lida sob ótica de formulários, ignorando a `OverviewTable` que caracteriza a tela também como consulta
  - 📌 Regra prática: para cada tela mapeada, fazer `grep` nos imports do `page.tsx` e verificar se há componentes externos com `Modal`, `Form`, `Dialog`, `Tab` no nome
  - 📅 Registrado em: 31/03/2026 — mapeamento completo de telas do Aesthera identificou 3 telas classificadas incorretamente por este motivo

---

## Componentes e Padrões Visuais

### Estados Vazios (Empty States)

- [ ] **CTA em empty state nunca deve ser `<button>` nativo estilizado com underline — usar sempre `<Button variant="outline">` dentro do container padronizado**
  - 🔴 Anti-padrão: `<button className="text-primary underline">Adicionar primeiro item</button>` ou `<a>` estilizado como link — rompe consistência visual, não segue o design system e viola `ui-standards.md` seção 2.3
  - ✅ Correto: container e botão seguindo o padrão estabelecido em todas as telas do sistema (Serviços, Profissionais, Equipamentos, Salas, Promoções):
    ```tsx
    <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
      <p className="text-sm">Nenhum registro encontrado.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
        Adicionar primeiro registro
      </Button>
    </div>
    ```
  - 📌 Padrão confirmado em: `ui-standards.md` seção 2.3 + telas de Serviços, Profissionais, Equipamentos, Salas e Promoções
  - 📅 Registrado em: 25/03/2026 — revisão de uploads e medidas corporais (PR #121)

---

## Cores e Dark Mode

- [ ] **`dark:bg-{color}-900/30` é insuficiente para discriminação visual em dark mode — mínimo é `/40`**
  - 🔴 Anti-padrão: badges/status com `dark:bg-green-900/30` ou `dark:bg-red-900/30` — fundos quase idênticos ao fundo da célula, impossível distinguir estados visualmente em tela escura
  - ✅ Correto: `/40` como mínimo; `/50` para status críticos (vencido, bloqueado, cancelado)
  - 📌 Regra de ouro: em dark mode, se o badge quase desaparece no fundo da linha, a opacidade está baixa demais
  - 📅 Registrado em: 30/03/2026 — auditoria transversal de dark mode em `customers/page.tsx`

---

- [ ] **Badge de status deve ser exibido para TODOS os estados — nunca omitir o estado positivo**
  - 🔴 Anti-padrão: exibir badge apenas para "Inativo" e não exibir nada para "Ativo" — o usuário faz scanning e é obrigado a inferir o estado por ausência de elemento visual, aumentando carga cognitiva e risco de erro
  - ✅ Correto: badge sempre presente para todos os estados, com cores distintas (ex: verde para Ativo, cinza para Inativo)
  - 📌 Teste de scanning: ao percorrer a lista rapidamente, cada item deve comunicar seu estado sem depender de leitura ou inferência
  - 📅 Registrado em: 30/03/2026 — auditoria de listagens que omitiam badge para estado Ativo

---

- [ ] **Mesmo conceito = mesma cor em todas as telas — `zinc` vs `muted` para "Inativo" é quebra de padrão**
  - 🔴 Anti-padrão: "Inativo" com `bg-zinc-100 text-zinc-600` em uma tela e `bg-muted text-muted-foreground` em outra; ou "Ativo" com `green-700` em uma tela e `green-800` em outra — o usuário aprende a associar cor a estado e fica confuso quando varia
  - ✅ Correto: todos os status/tipos são importados de `lib/status-colors.ts` — fonte única de verdade para cores de status no Aesthera
  - 📌 Verificar: ao revisar qualquer tela com badges de status, conferir se as cores batem com as demais telas do sistema
  - 📅 Registrado em: 30/03/2026 — auditoria transversal identificou divergência zinc vs muted e green-700 vs green-800

---

- [ ] **Enum com múltiplos valores em listagem deve ter cor semanticamente distinta por valor — nunca todos iguais**
  - 🔴 Anti-padrão: todos os métodos de pagamento (PIX, débito, crédito, dinheiro) em azul — o badge existe mas não agrega valor informacional, o usuário ainda precisa ler o texto
  - ✅ Correto: cada valor tem cor com semântica própria (PIX → verde, dinheiro → esmeralda, crédito → roxo, débito → azul); nenhum par adjacente de valores usa a mesma paleta
  - 📌 Teste rápido: cobrir o texto dos badges e verificar se ainda é possível distinguir os tipos pela cor. Se não, as cores estão erradas.
  - 📅 Registrado em: 30/03/2026 — revisão de `PAYMENT_METHOD_COLOR` com todos os valores em azul

---

- [ ] **Texto branco sobre fundos amber/orange intermediários é WCAG fail — contraste insuficiente**
  - 🔴 Anti-padrão: `text-white` sobre `bg-amber-500`, `bg-orange-400` ou paletas similares — contraste ~2.3:1, reprovando WCAG AA (mínimo 4.5:1 para texto normal)
  - ✅ Correto: usar `text-amber-900` / `text-orange-900` para legibilidade; ou escurecer o fundo (`bg-amber-700`) para suportar texto branco com contraste ≥ 4.5:1
  - 📌 Arquivo canônico de constantes de cor: `aesthera/apps/web/lib/status-colors.ts`
  - 📌 Teste rápido: inserir as classes no Tailwind playground ou usar a extensão axe DevTools para verificar o ratio antes de aprovar
  - 📅 Registrado em: 24/03/2026 — revisão do EVENT_COLOR no calendário

---

- [ ] **Constantes de mapeamento de cor (`STATUS_COLOR`, `EVENT_COLOR`) NUNCA devem ser definidas dentro de arquivo de tela**
  - 🔴 Anti-padrão: `const STATUS_COLOR = { ativo: '...', inativo: '...' }` duplicado em cada página — divergência de cores entre telas, dark mode inconsistente e impossível corrigir em um só lugar
  - ✅ Correto: toda constante de cor/status compartilhada entre ≥ 2 componentes pertence a `lib/status-colors.ts`; importar de lá, nunca redefinir localmente
  - 📌 Sinal de alerta na revisão: `const STATUS_COLOR` ou `const EVENT_COLOR` dentro de qualquer arquivo que não seja `lib/status-colors.ts` é bloqueante
  - 📅 Registrado em: 24/03/2026 — STATUS_COLOR duplicado sem dark mode

---

## Modais e Overlays

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Formulários

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Listagens e Tabelas

- [ ] **Toda listagem deve ter paginação server-side desde a primeira entrega — nunca `limit` hardcoded**
  - 🔴 Anti-padrão: `?limit=100` ou `?limit=500` hardcoded, sem `<DataPagination>` — funciona no MVP mas degrada com volume real de dados
  - ✅ Correto: `<DataPagination>` com seletor de 20/50/100 por página + parâmetros `?page=1&pageSize=20` na URL
  - 📌 Verificar: ao revisar qualquer tela de listagem, conferir se há paginação visível no rodapé e se a URL reflete a página atual
  - 📅 Registrado em: 30/03/2026 — levantamento transversal: 15 telas sem paginação

---

- [ ] **Busca textual em tela paginada deve operar server-side — nunca `.filter()` sobre `data?.items`**
  - 🔴 Anti-padrão: campo de busca que filtra sobre o array da página atual — com 500 registros e pageSize=20, a busca só enxerga 20 resultados
  - ✅ Correto: `search` como parâmetro de query à API; qualquer mudança no campo de busca dispara nova requisição e reseta `page` para 1
  - 📌 Sinal de alerta na revisão: se ao digitar no campo de busca o número de "Total de registros" não muda, a busca é client-side
  - 📅 Registrado em: 30/03/2026 — revisão de PR #141 com busca client-side sobre lista paginada

---

## Filtros e Barras de Busca

- [ ] **Campos que carregam dados da API NUNCA devem usar `<select>` nativo ou `<datalist>`**
  - 🔴 Anti-padrão: `<select><option>` ou `<datalist>` para clientes, serviços, profissionais, insumos — degradação severa com volume de dados
  - ✅ Correto: `<ComboboxSearch>` (`/components/ui/combobox-search.tsx`) — input com dropdown que abre ao focar, filtra ao digitar, fecha ao selecionar
  - 📌 Padrão confirmado em: revisão transversal de filtros 25/03/2026
  - 📅 Registrado em: 25/03/2026

---

- [ ] **Status/tipo/categoria com ≤ 6 opções fixas NUNCA deve usar `<select>` nativo**
  - 🔴 Anti-padrão: `<select value={statusFilter}>` para filtros de status — inconsistente com telas que já usam pills
  - ✅ Correto: pills arredondados `rounded-full border px-3 py-1 text-xs font-medium`, ativo: `border-primary bg-primary text-primary-foreground`
  - 📌 Padrão confirmado em: revisão transversal de filtros 25/03/2026 — quebrando padrão em Contas a Pagar e Financeiro
  - 📅 Registrado em: 25/03/2026

---

- [ ] **Toda tela com filtros DEVE ter legenda descritiva dos filtros ativos**
  - 🔴 Anti-padrão: barra de filtros sem indicação visual do que está filtrado — 10 de 11 telas estavam assim
  - ✅ Correto: `<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 shrink-0" /><span>Exibindo {buildFilterLabel(...)}</span></div>`
  - 📌 Referência canônica: `/carteira/page.tsx`
  - 📅 Registrado em: 25/03/2026

---

- [ ] **Toda tela com filtros DEVE ter botão "Restaurar padrão"**
  - 🔴 Anti-padrão: ausência de atalho para limpar filtros — usuário precisa apagar campo a campo
  - ✅ Correto: botão aparece apenas quando filtros diferem do padrão; SEMPRE retorna ao estado padrão da tela (não a vazio/sem filtros)
  - 📌 Referência canônica: `/carteira/page.tsx`
  - 📅 Registrado em: 25/03/2026

---

- [ ] **Telas financeiras com filtro de período DEVEM ter presets de data + URL sync**
  - 🔴 Anti-padrão: apenas date inputs sem presets e sem persistência via URL — usuário perde contexto ao navegar
  - ✅ Correto: presets (Hoje / 7 dias / 30 dias / 6 meses / 1 ano) + `useSearchParams` + `router.replace()` para persistência
  - 📌 Referência canônica: `/carteira/page.tsx`
  - 📅 Registrado em: 25/03/2026

---

## Textos e Idioma (PT-BR)

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Histórico de Atualizações

| Data | Itens adicionados |
|------|-------------------|
| 25/03/2026 | Arquivo criado pelo treinador-agent. 1 padrão registrado: empty state CTA com `<Button variant="outline">` dentro de container padronizado |
| 25/03/2026 | 5 padrões adicionados pelo treinador-agent (issue #124 — revisão transversal de filtros): (1) `<ComboboxSearch>` obrigatório para entidades cadastradas; (2) pills arredondados para status/tipo ≤ 6 opções fixas; (3) legenda descritiva de filtros ativos (`bg-muted/50` + ícone `Info`); (4) botão "Restaurar padrão" em toda tela com filtros; (5) presets de período + URL sync via `useSearchParams` em telas financeiras |
| 30/03/2026 | 6 padrões adicionados pelo treinador-agent: nova seção "Cores e Dark Mode" (opacidade `/30` insuficiente; badge para todos os estados; consistência de cor entre telas; cor distinta por valor de enum) + seção "Listagens e Tabelas" (paginação server-side obrigatória; busca textual server-side em telas paginadas) |
| 30/03/2026 | 2 padrões adicionados pelo treinador-agent em "Cores e Dark Mode": (1) contraste WCAG insuficiente — `text-white` sobre amber/orange intermediário; (2) constantes `STATUS_COLOR`/`EVENT_COLOR` centralizadas em `lib/status-colors.ts`, nunca por página |
| 31/03/2026 | 1 padrão adicionado pelo treinador-agent: nova seção "Metodologia de Revisão" — inspecionar imports do `page.tsx` ao mapear formulários e ações de uma tela (anti-padrão: analisar apenas `page.tsx` e gerar falso negativo) |
