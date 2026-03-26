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

## Modais e Overlays

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Formulários

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Listagens e Tabelas

<!-- Itens serão adicionados automaticamente após revisões -->

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
