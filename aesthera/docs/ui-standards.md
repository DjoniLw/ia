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

## 7. Implementation Checklist

Before marking any task as done, verify:

- [ ] Screen follows this document
- [ ] Components from `/components/ui/` are reused
- [ ] Filters (search + status) are present when applicable
- [ ] All form dialogs use `isDirty` unsaved-changes guard
- [ ] Deletion checks referential integrity at the API level
- [ ] Row actions use Pencil/Trash2 icon buttons (no text buttons, no `window.confirm`)
- [ ] No unrelated code was changed
