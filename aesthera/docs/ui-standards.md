# UI/UX Standards — Aesthera Clinic Management System

This document is the **source of truth** for all UI/UX decisions.
Always read this before implementing any screen or component.

---

## 1. Project Structure

| Path | Purpose |
|---|---|
| `/docs/ui-standards.md` | This file — UI/UX source of truth |
| `/docs/templates/` | Starter templates for new screens |
| `/components/ui/` | Shared, reusable UI primitives |
| `/app/(dashboard)/` | Feature screens |
| `/lib/hooks/use-resources.ts` | Shared data-fetching hooks |

> Never create new patterns if a similar one already exists.
> Consistency > Creativity.

---

## 2. List Screens

### 2.1 Header

```tsx
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-xl font-semibold">{Title}</h2>
    <p className="text-sm text-muted-foreground">{Subtitle}</p>
  </div>
  <Button onClick={openCreate}>
    <Plus className="mr-1.5 h-4 w-4" />
    New {Entity}
  </Button>
</div>
```

### 2.2 Filters

Always include a filter bar when the list supports active/inactive status:

```tsx
<div className="flex flex-wrap items-center gap-2">
  {/* Search */}
  <Input
    placeholder="Buscar por nome…"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="h-8 w-48 text-sm"
  />
  {/* Status pills */}
  {(['all', 'active', 'inactive'] as const).map((s) => (
    <button
      key={s}
      onClick={() => setStatusFilter(s)}
      className={statusFilter === s ? 'bg-primary text-primary-foreground ...' : 'border ...'}
    >
      {label}
    </button>
  ))}
</div>
```

Status filter labels (pt-BR): `Todos` / `Ativos` / `Inativos`

### 2.3 Empty State (mandatory)

Show a CTA when the list is empty:

```tsx
<div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
  <Icon className="mx-auto mb-2 h-8 w-8 opacity-30" />
  <p className="text-sm">Nenhum(a) {entity} cadastrado(a).</p>
  <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
    Criar primeiro(a) {entity}
  </Button>
</div>
```

### 2.4 Row Actions

Always use icon-only buttons (follow the Equipment screen pattern):

```tsx
<Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
  <Pencil className="h-3.5 w-3.5" />
</Button>
<Button
  variant="ghost"
  size="sm"
  onClick={() => setDeleting(item)}
  className="text-destructive hover:text-destructive"
>
  <Trash2 className="h-3.5 w-3.5" />
</Button>
```

> Never use `window.confirm()`. Always use the `<Dialog>` component.

### 2.5 Cabeçalho de Tabela

Padrão para `<th>` em todas as telas:

```tsx
<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
  Nome da Coluna
</th>
```

No `<tr>` de cabeçalho, usar:

```tsx
<tr className="border-b bg-muted/30 text-muted-foreground">
```

> **Não usar** `uppercase` ou `tracking-wide` em cabeçalhos de tabela. O peso visual adequado já vem de `text-xs font-medium`.

---

## 3. Forms

### 3.1 Unsaved Changes Guard (mandatory)

Every form dialog must prevent accidental data loss:

```tsx
const [formDirty, setFormDirty] = useState(false)

<Dialog open onClose={onClose} isDirty={formDirty}>
  <YourForm onDirtyChange={setFormDirty} />
</Dialog>
```

The `<Dialog>` component already handles the confirmation overlay when
`isDirty={true}` and the user tries to close.

### 3.2 Layout

- Group related fields with `className="space-y-4"`
- Use `className="grid grid-cols-2 gap-4"` for side-by-side fields
- Place Save/Cancel buttons at bottom-right: `className="flex justify-end gap-2 pt-2"`

---

## 4. Search Fields

Reuse the debounced search pattern from the Appointments screen:

```tsx
const [search, setSearch] = useState('')
const [debouncedSearch, setDebouncedSearch] = useState('')

useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(search), 250)
  return () => clearTimeout(t)
}, [search])

const { data } = useHook(debouncedSearch)
```

For client-side filtering (small lists already loaded):

```tsx
const filtered = items.filter((item) =>
  item.name.toLowerCase().includes(search.toLowerCase())
)
```

---

## 5. Data Safety

### 5.1 Deletion Rules

- **Never delete records that are being used** (referential integrity).
- Enforce at both the API level (service layer) and the database layer (FK constraints).
- Return a user-friendly error message, e.g.:
  `"Este insumo está vinculado a um ou mais serviços e não pode ser removido."`

### 5.2 Soft vs Hard Delete

| Entity | Strategy |
|---|---|
| Supply | Soft delete (`deletedAt` + `active: false`) — blocked if linked to service |
| Service | Soft delete |
| Product | Soft delete |
| Professional | Soft delete |
| Equipment | Hard delete (DB constraint prevents if used in appointment) |
| Room | Hard delete (DB constraint prevents if used in appointment) |

---

## 6. Status Badges

```tsx
// Active
<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
  Ativo
</span>

// Inactive
<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
  Inativo
</span>
```

---

## 7. Padrão de Filtros (obrigatório em todas as telas com filtros)

> **Referência canônica:** `app/(dashboard)/carteira/page.tsx` — implementação completa e correta.

### 7.1 Tipos de filtro e componentes

| Tipo de filtro | Componente | Quando usar |
|---|---|---|
| Status / tipo fixo com ≤ 6 opções | **Pills** (botões `rounded-full`) | Status, tipo, categoria fixa |
| Entidade cadastrada (cliente, serviço, profissional, insumo) | **ComboboxSearch** (`/components/ui/combobox-search.tsx`) | Qualquer campo que carrega dados da API |
| Busca textual livre | **Input simples** `h-8 w-48 text-sm` + debounce 250ms | Nome, descrição, número livre |
| Período | **Presets** (Hoje/7 dias/30 dias/6 meses/1 ano) + **Date range** (De/Até) | Telas financeiras e de histórico |

### 7.2 Pills — classes obrigatórias

```tsx
// Ativo
className="rounded-full border px-3 py-1 text-xs font-medium border-primary bg-primary text-primary-foreground"

// Inativo
className="rounded-full border px-3 py-1 text-xs font-medium border-input bg-card text-muted-foreground hover:bg-accent"
```

### 7.3 Legenda descritiva — obrigatória em toda tela com filtros

```tsx
<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
  <Info className="h-3.5 w-3.5 shrink-0" />
  <span>Exibindo {buildFilterLabel(...)}</span>
  {!isDefaultFilters && (
    <button
      type="button"
      onClick={resetFilters}
      className="ml-auto shrink-0 font-medium text-primary hover:underline"
    >
      Restaurar padrão
    </button>
  )}
</div>
```

### 7.4 Campos de Busca com ComboboxSearch

Componente localizado em `/components/ui/combobox-search.tsx`.

```tsx
import { ComboboxSearch, type ComboboxItem } from '@/components/ui/combobox-search'

const [selectedItem, setSelectedItem] = useState<ComboboxItem | null>(null)
const [searchQuery, setSearchQuery] = useState('')

const items = useMemo(() => {
  const q = searchQuery.trim().toLowerCase()
  return (data?.items ?? [])
    .filter((i) => !q || i.name.toLowerCase().includes(q))
    .map((i) => ({ value: i.id, label: i.name }))
}, [data, searchQuery])

<ComboboxSearch
  value={selectedItem}
  onChange={setSelectedItem}
  onSearch={setSearchQuery}
  items={items}
  placeholder="Buscar..."
/>
```

Props disponíveis: `value`, `onChange`, `onSearch`, `items`, `placeholder`, `debounceMs` (padrão: 250), `isLoading`, `className`.

### 7.5 URL sync — telas financeiras e de histórico

Telas com histórico temporal (Financeiro, Contas a Pagar, Vendas, Cobranças) devem persistir filtros na URL com `useSearchParams` + `router.replace()`. Usar `Suspense` ao redor do componente de página.

```tsx
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filter, setFilter] = useState(searchParams.get('filter') ?? '')

  useEffect(() => {
    const p = new URLSearchParams()
    if (filter) p.set('filter', filter)
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, filter])
  // ...
}

export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  )
}
```

---

## 2.6 Paginação

> **Padrão obrigatório** em todas as telas de listagem com dados paginados pelo servidor.

### Hook: `usePaginatedQuery`

```tsx
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'

const pagination = usePaginatedQuery({ defaultPageSize: 20 })
// Com prefixo (múltiplas listas na mesma página):
const catalogPagination = usePaginatedQuery({ defaultPageSize: 20, paramPrefix: 'catalog' })
```

Retorna: `{ page, pageSize, setPage, setPageSize, resetPage, paginationParams }`

- `paginationParams` — `{ page: string, limit: string }` para spread em chamadas de API.
- `resetPage()` — chame ao mudar qualquer filtro para voltar à página 1.
- Com `paramPrefix`, usa params de URL `${prefix}_page` / `${prefix}_pageSize`.

### Componente: `<DataPagination>`

```tsx
import { DataPagination } from '@/components/ui/data-pagination'

<DataPagination
  page={pagination.page}
  pageSize={pagination.pageSize}
  total={data?.total ?? 0}
  onPageChange={pagination.setPage}
  onPageSizeChange={pagination.setPageSize}
/>
```

- Renderiza `null` quando `total === 0` ou `total <= pageSize` (sem paginação necessária).
- Layout: contador à esquerda · números de página ao centro · seletor de tamanho + prev/next à direita.

### Padrão completo de uma tela de listagem

```tsx
'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataPagination } from '@/components/ui/data-pagination'
import { usePaginatedQuery } from '@/lib/hooks/use-paginated-query'

function ItemsPageContent() {
  useSearchParams() // obrigatório para Suspense funcionar
  const pagination = usePaginatedQuery({ defaultPageSize: 20 })
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const { data, isLoading } = useItems({
    ...pagination.paginationParams,
    ...(statusFilter !== 'all' ? { active: statusFilter === 'active' ? 'true' : 'false' } : {}),
  })

  // Ao mudar filtro, resetar para página 1:
  function handleFilterChange(value: typeof statusFilter) {
    setStatusFilter(value)
    pagination.resetPage()
  }

  return (
    <div className="space-y-4">
      {/* filtros */}
      {/* tabela */}
      <DataPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={data?.total ?? 0}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
      {/* dialogs */}
    </div>
  )
}

export default function ItemsPage() {
  return (
    <Suspense fallback={null}>
      <ItemsPageContent />
    </Suspense>
  )
}
```

### Hooks com parâmetros tipados (não `Record<string,string>`)

Para hooks como `usePackages` e `usePromotions` que aceitam `{ page?: number; limit?: number }`:

```tsx
const { data } = usePackages({
  page: parseInt(pagination.paginationParams.page),
  limit: parseInt(pagination.paginationParams.limit),
  ...(activeFilter !== undefined ? { active: activeFilter } : {}),
})
```

### Checklist de paginação

- [ ] `usePaginatedQuery` instanciado na função de página
- [ ] `paginationParams` passado para o hook de dados
- [ ] `resetPage()` chamado em todos os handlers de filtro
- [ ] `<DataPagination>` posicionado após a tabela/lista
- [ ] Componente de página envolto em `<Suspense fallback={null}>`

---

## 8. Implementation Checklist

Before marking any task as done, verify:

- [ ] Screen follows this document
- [ ] Components from `/components/ui/` are reused
- [ ] Filters (search + status) are present when applicable
- [ ] All form dialogs use `isDirty` unsaved-changes guard
- [ ] Deletion checks referential integrity at the API level
- [ ] Row actions use Pencil/Trash2 icon buttons (no text buttons, no `window.confirm`)
- [ ] No unrelated code was changed
- [ ] Telas com listagem usam `usePaginatedQuery` + `<DataPagination>` (ver seção 2.6)
- [ ] Página envolta em `<Suspense fallback={null}>` quando usa `useSearchParams`
