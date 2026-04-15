# Spec Técnica — [FICHAS DE AVALIAÇÃO EXPANDIDAS] 2/3 — Frontend: Settings (#158)

**Issue:** #158  
**Data:** 2026-04-15  
**Módulo(s):** `settings`, `measurement-sheets`  
**Tipo:** Frontend  

---

## 1. Contexto e Objetivo

A aba de Configurações já exibe o label "Fichas de Avaliação" (`TabsTrigger value="body-measurements"` em `settings/page.tsx`), mas ainda renderiza o componente `<BodyMeasurementsTab />`, que lista fichas sem categorias, sem editor ao vivo e sem biblioteca de modelos.

Esta issue substitui o componente por `<MeasurementSheetsSettings />`, um layout de três painéis (sidebar de categorias → lista de fichas → editor/preview), e adiciona o drawer `<MeasurementTemplatesDrawer />` para ativar modelos pré-configurados.

O backend com os novos campos (`category`, `scope`, `customerId`) e os endpoints de templates é entregue pela issue #157 e deve estar deployado como pré-requisito.

---

## 2. Escopo da Implementação

### 2.1 Arquivos a CRIAR

```
aesthera/apps/web/lib/measurement-categories.ts
  — Constantes de apresentação: CATEGORY_LABELS, SHEET_TYPE_LABELS,
    CATEGORY_ICON, CATEGORY_BADGE_COLOR, MEASUREMENT_CATEGORIES_ORDER

aesthera/apps/web/app/(dashboard)/settings/_components/measurement-sheets-settings.tsx
  — Componente principal da aba: layout 3 painéis + orquestração de estado

aesthera/apps/web/app/(dashboard)/settings/_components/measurement-templates-drawer.tsx
  — Drawer lateral "Usar modelo": lista templates e dispara cópia
```

> ⚠️ Os novos componentes vão em `app/(dashboard)/settings/_components/` — mesma pasta onde ficam `body-measurements-tab.tsx`, `contract-templates-tab.tsx`, etc.

> ⚠️ Verificar se `components/ui/sheet.tsx` já existe. Se não, adicionar via `npx shadcn@latest add sheet` antes da implementação.

### 2.2 Arquivos a MODIFICAR

```
aesthera/apps/web/lib/hooks/use-measurement-sheets.ts
  — Adicionar: MeasurementCategory, MeasurementScope (tipos)
  — Estender: MeasurementSheet com category, scope, customerId
  — Estender: CreateSheetInput com category, scope
  — Estender: UpdateSheetInput com category
  — Adicionar: MeasurementTemplate (interface)
  — Adicionar hooks: useMeasurementTemplates, useCopyMeasurementTemplate

aesthera/apps/web/app/(dashboard)/settings/page.tsx
  — Substituir import de BodyMeasurementsTab por MeasurementSheetsSettings
  — TabsContent value="body-measurements" renderiza <MeasurementSheetsSettings />
```

### 2.3 Sem alteração necessária

```
aesthera/apps/web/app/(dashboard)/settings/_components/body-measurements-tab.tsx
  — Apenas remover import em settings/page.tsx; não deletar o arquivo
aesthera/apps/web/components/body-measurements/evolution-tab.tsx
  — Aba do perfil do cliente; escopo da issue #159 (3/3)
```

---

## 3. Tipos e Interfaces TypeScript

### 3.1 Adições a `lib/hooks/use-measurement-sheets.ts`

```typescript
// ── Novos enums ────────────────────────────────────────────────────────────────
export type MeasurementCategory =
  | 'CORPORAL'
  | 'FACIAL'
  | 'DERMATO_FUNCIONAL'
  | 'NUTRICIONAL'
  | 'POSTURAL'
  | 'PERSONALIZADA'

export type MeasurementScope = 'SYSTEM' | 'CUSTOMER'

// ── Extensão de MeasurementSheet ───────────────────────────────────────────────
// Adicionar aos campos já existentes da interface:
//   category: MeasurementCategory   (backend sempre retorna; default CORPORAL)
//   scope: MeasurementScope          (backend sempre retorna; default SYSTEM)
//   customerId: string | null

// ── Template retornado por GET /measurement-sheets/templates ───────────────────
export interface MeasurementTemplate {
  id: string
  name: string
  category: MeasurementCategory
  type: MeasurementSheetType
  fields?: string[]    // presente quando type === 'SIMPLE'
  rows?: string[]      // presente quando type === 'TABULAR'
  columns?: string[]   // presente quando type === 'TABULAR'
}

// ── Extensão de inputs existentes ──────────────────────────────────────────────
// CreateSheetInput — adicionar campos opcionais:
//   category?: MeasurementCategory
//   scope?: MeasurementScope
//   customerId?: string

// UpdateSheetInput — adicionar campo opcional:
//   category?: MeasurementCategory
```

---

## 4. Constantes de Apresentação

### `lib/measurement-categories.ts`

```typescript
import type { MeasurementCategory, MeasurementSheetType } from '@/lib/hooks/use-measurement-sheets'
import { Activity, Dna, Ruler, Star, Sun, User } from 'lucide-react'

export const CATEGORY_LABELS: Record<MeasurementCategory, string> = {
  CORPORAL:          'Corporal',
  FACIAL:            'Facial',
  DERMATO_FUNCIONAL: 'Dermato-funcional',
  NUTRICIONAL:       'Nutricional',
  POSTURAL:          'Postural',
  PERSONALIZADA:     'Personalizada',
}

export const SHEET_TYPE_LABELS: Record<MeasurementSheetType, string> = {
  SIMPLE:  'Lista',
  TABULAR: 'Tabela',
}

// Ordem canônica de exibição na sidebar (imutável)
export const MEASUREMENT_CATEGORIES_ORDER: MeasurementCategory[] = [
  'CORPORAL',
  'FACIAL',
  'DERMATO_FUNCIONAL',
  'NUTRICIONAL',
  'POSTURAL',
  'PERSONALIZADA',
]

// Ícones para sidebar e cards de template
export const CATEGORY_ICON: Record<MeasurementCategory, typeof Ruler> = {
  CORPORAL:          Ruler,
  FACIAL:            Sun,
  DERMATO_FUNCIONAL: Dna,
  NUTRICIONAL:       Activity,
  POSTURAL:          User,
  PERSONALIZADA:     Star,
}

// Cores de badge por categoria (solid — conforme padrão do projeto)
export const CATEGORY_BADGE_COLOR: Record<MeasurementCategory, string> = {
  CORPORAL:          'bg-sky-600 text-white dark:bg-sky-700',
  FACIAL:            'bg-rose-500 text-white dark:bg-rose-600',
  DERMATO_FUNCIONAL: 'bg-violet-600 text-white dark:bg-violet-700',
  NUTRICIONAL:       'bg-emerald-600 text-white dark:bg-emerald-700',
  POSTURAL:          'bg-amber-700 text-white dark:bg-amber-800',
  PERSONALIZADA:     'bg-slate-500 text-white dark:bg-slate-600',
}
```

> ⚠️ **Regra absoluta:** `SHEET_TYPE_LABELS` e `CATEGORY_LABELS` devem ser usados em **todo** ponto de renderização. Nunca exibir `'SIMPLE'`, `'TABULAR'`, `'DERMATO_FUNCIONAL'` etc. diretamente na interface.

---

## 5. Estrutura de Componentes Frontend

### 5.1 Hierarquia

```
MeasurementSheetsSettings                        (componente raiz da aba)
├── Header                                       (inline — título + botão "Usar modelo")
├── CategorySidebar                              (painel esquerdo — lista de categorias)
│   └── CategoryItem × 6                        (item clicável com contador)
├── SheetListPanel                               (painel central — fichas da categoria)
│   ├── SheetListHeader                          (inline — título + botão "Nova ficha")
│   ├── SheetListEmpty                           (estado vazio da categoria)
│   └── SortableSheetList (DndContext)           (lista reordenável)
│       └── SortableSheetItem × N               (item com drag handle + toggle ativo)
│           └── SheetEditorPanel                (painel direito — editor ao vivo)
│               ├── SimpleSheetEditor            (para fichas type=SIMPLE)
│               │   └── EditableFieldRow × N    (campo nome + unidade + toggle D/E)
│               └── TabularSheetEditor           (para fichas type=TABULAR)
│                   └── TabularGrid              (grid rows × columns com edição inline)
└── MeasurementTemplatesDrawer                   (Sheet lateral)
    └── TemplateCard × N                        (card por template com botão "Usar")
```

### 5.2 Props e responsabilidades

| Componente | Props | Responsabilidade |
|---|---|---|
| `MeasurementSheetsSettings` | — | Estado global: categoria selecionada, ficha selecionada, drawer open. Lê `useMeasurementSheets({ includeInactive: true })`. |
| `CategorySidebar` | `selectedCategory`, `onSelect`, `counts: Record<MeasurementCategory, number>` | Renderiza 6 categorias na ordem canônica com contagem de fichas **ativas**. |
| `SheetListPanel` | `category`, `sheets`, `selectedSheetId`, `onSelectSheet`, `isLoading` | Gerencia DnD via `DndContext` + `SortableContext`. Chama `useReorderMeasurementSheets`. |
| `SortableSheetItem` | `sheet`, `isSelected`, `onSelect` | Item arrastável via `useSortable`. Toggle `active` chama `useUpdateMeasurementSheet`. |
| `SheetEditorPanel` | `sheet: MeasurementSheet` | Renderiza `SimpleSheetEditor` ou `TabularSheetEditor` conforme `sheet.type`. |
| `SimpleSheetEditor` | `sheet` | Campos do tipo SIMPLE com edição inline. Usa hooks de field existentes. |
| `TabularSheetEditor` | `sheet` | Grade de linhas × colunas. Edição inline de nomes de linha e coluna. |
| `MeasurementTemplatesDrawer` | `open`, `onClose`, `onSheetCreated: (sheet) => void` | Sheet lateral. Lê `useMeasurementTemplates`. Chama `useCopyMeasurementTemplate`. |

### 5.3 Edição inline — comportamento padrão

- `Enter` confirma a edição (chama mutation de update)
- `Escape` descarta sem salvar (restaura valor local)
- `Tab` avança para o próximo campo editável
- Campo vazio ao confirmar: restaurar valor anterior + `toast.error('Nome obrigatório')`

### 5.4 Responsividade

| Viewport | Comportamento |
|---|---|
| ≥ 1280px (`xl:`) | Três painéis visíveis simultaneamente |
| < 1280px | `SheetEditorPanel` colapsa em seção `<Collapsible>` abaixo da lista; toggle via botão `Eye` |

---

## 6. Contratos de API (Frontend)

### 6.1 Listagem de fichas — busca única + filtro por useMemo

```typescript
// Busca única (já existe em useMeasurementSheets)
GET /measurement-sheets?includeInactive=true
Response: MeasurementSheet[]  (com campos category, scope, customerId)
```

**Decisão técnica:** buscar todas as fichas uma vez e filtrar por categoria via `useMemo` no componente raiz — evita múltiplas chamadas (uma por categoria) dado o volume pequeno (máx. 20 fichas por clínica).

### 6.2 Templates

```typescript
// Novo hook: useMeasurementTemplates
GET /measurement-sheets/templates
Response 200: MeasurementTemplate[]
// staleTime: Infinity — templates são estáticos
```

### 6.3 Copiar template

```typescript
// Novo hook: useCopyMeasurementTemplate
POST /measurement-sheets/templates/{templateId}/copy
Body: {} (vazio)
Response 201: MeasurementSheet  (nova ficha criada na clínica)
Response 403: → toast.error('Você não tem permissão para esta ação.')
Response 404: → toast.error('Modelo não encontrado.')
```

### 6.4 Criar ficha

```typescript
POST /measurement-sheets
Body: { name: string, type: 'SIMPLE' | 'TABULAR', category: MeasurementCategory, scope: 'SYSTEM', order: number }
Response 201: MeasurementSheet
Response 422: → toast.error('Limite de 20 fichas ativas atingido. Desative fichas não usadas para criar novas.')
```

### 6.5 Atualizar ficha

```typescript
PATCH /measurement-sheets/{id}
Body: { name?: string, active?: boolean, category?: MeasurementCategory, order?: number }
⚠️ NÃO incluir campo "type" no body — backend retorna 400
Response 200: MeasurementSheet
```

---

## 7. Estado e Fluxo de Dados

### 7.1 Estado local de `MeasurementSheetsSettings`

```typescript
const [selectedCategory, setSelectedCategory] = useState<MeasurementCategory>('CORPORAL')
const [selectedSheetId, setSelectedSheetId]   = useState<string | null>(null)
const [isDrawerOpen, setIsDrawerOpen]          = useState(false)
```

### 7.2 Dados derivados via useMemo

```typescript
const { data: allSheets = [], isLoading } = useMeasurementSheets({ includeInactive: true })

// Agrupadas por categoria
const sheetsByCategory = useMemo(
  () => Object.fromEntries(
    MEASUREMENT_CATEGORIES_ORDER.map(cat => [
      cat,
      allSheets
        .filter(s => s.scope === 'SYSTEM' && s.category === cat)
        .sort((a, b) => a.order - b.order),
    ])
  ) as Record<MeasurementCategory, MeasurementSheet[]>,
  [allSheets]
)

// Fichas da categoria selecionada
const categorySheets = sheetsByCategory[selectedCategory] ?? []

// Contagem de fichas ativas por categoria (para sidebar)
const categoryCounts = useMemo(
  () => Object.fromEntries(
    MEASUREMENT_CATEGORIES_ORDER.map(cat => [
      cat,
      (sheetsByCategory[cat] ?? []).filter(s => s.active).length,
    ])
  ) as Record<MeasurementCategory, number>,
  [sheetsByCategory]
)

// Ficha selecionada
const selectedSheet = categorySheets.find(s => s.id === selectedSheetId) ?? null
```

### 7.3 Fluxo "Usar modelo"

```
1. Usuário clica "Usar modelo" → setIsDrawerOpen(true)
2. MeasurementTemplatesDrawer monta → useMeasurementTemplates() busca templates
3. Usuário clica "Usar este modelo" em um TemplateCard
4. isCopying = true → botão desabilitado + <Loader2 className="animate-spin" />
5. useCopyMeasurementTemplate.mutateAsync({ templateId })
6. onSuccess:
   a. invalidateQueries(['measurement-sheets'])
   b. setIsDrawerOpen(false)
   c. onSheetCreated(novaFicha):
      setSelectedCategory(novaFicha.category)
      setSelectedSheetId(novaFicha.id)
7. onError: toast.error(mensagem da API) + re-habilitar botão
```

### 7.4 Fluxo "Nova ficha"

```
1. Usuário clica "+ Nova ficha"
2. Form inline: name (Input), type (radio SIMPLE/"Lista" | TABULAR/"Tabela")
3. Submit → useCreateMeasurementSheet.mutateAsync({
     name, type, category: selectedCategory, scope: 'SYSTEM',
     order: categorySheets.length
   })
4. onSuccess → setSelectedSheetId(novaFicha.id)
5. onError com status 422 → toast específico de limite
```

---

## 8. DoD Checklist

### Pré-requisito
- [ ] Componente `Sheet` do shadcn/ui verificado/adicionado em `components/ui/sheet.tsx`

### Settings page
- [ ] `settings/page.tsx` importa `MeasurementSheetsSettings` em vez de `BodyMeasurementsTab`
- [ ] `TabsContent value="body-measurements"` renderiza `<MeasurementSheetsSettings />`
- [ ] Import de `BodyMeasurementsTab` removido de `settings/page.tsx`

### Constantes
- [ ] `lib/measurement-categories.ts` criado com `CATEGORY_LABELS`, `SHEET_TYPE_LABELS`, `MEASUREMENT_CATEGORIES_ORDER`, `CATEGORY_ICON`, `CATEGORY_BADGE_COLOR`
- [ ] Nenhum ponto da UI exibe `'SIMPLE'`, `'TABULAR'`, `'DERMATO_FUNCIONAL'` diretamente

### Hooks
- [ ] `MeasurementCategory` e `MeasurementScope` exportados de `use-measurement-sheets.ts`
- [ ] `MeasurementSheet` inclui campos `category`, `scope`, `customerId`
- [ ] `useMeasurementTemplates()` implementado com `staleTime: Infinity`
- [ ] `useCopyMeasurementTemplate()` implementado; invalida `['measurement-sheets']` on success

### Componente principal
- [ ] Layout de três painéis renderiza em viewport ≥ 1280px
- [ ] Em viewport < 1280px, `SheetEditorPanel` colapsa via `<Collapsible>` com toggle `Eye`
- [ ] Sidebar exibe 6 categorias na ordem canônica com contagem de fichas ativas
- [ ] Categoria com 0 fichas mostra `(0)` com `text-muted-foreground` — **não ocultar**
- [ ] Selecionar categoria filtra lista central sem nova chamada de API (via useMemo)
- [ ] Empty state: `rounded-lg border bg-card py-16 text-center text-muted-foreground` com ícone `ClipboardList` + texto + `<Button variant="outline" size="sm">Nova ficha</Button>`
- [ ] Fichas reordenáveis por drag-and-drop dentro da categoria; PATCH de reorder chamado ao soltar
- [ ] Toggle `active` da ficha chama `PATCH /measurement-sheets/:id` com `{ active: bool }`

### Editor de fichas
- [ ] Fichas `SIMPLE`: campos como linhas editáveis com nome, unidade e toggle "Direito/Esquerdo"
- [ ] Fichas `TABULAR`: grade com linhas × colunas; adição inline de linha e coluna
- [ ] Edição inline: `Enter` confirma mutation; `Escape` descarta; `Tab` navega entre campos

### Drawer de templates
- [ ] `MeasurementTemplatesDrawer` abre como `Sheet` lateral
- [ ] Templates exibidos com nome, badge de categoria (`CATEGORY_LABELS`), type label PT-BR e contagem de campos/linhas
- [ ] Botão "Usar este modelo": desabilitado + spinner `<Loader2 animate-spin />` durante `isPending`
- [ ] Após cópia: drawer fecha + sidebar muda para categoria do template + nova ficha selecionada

### Qualidade
- [ ] Sem `console.log` ou código de debug
- [ ] Sem texto em inglês na interface (labels, placeholders, botões, mensagens, toasts)
- [ ] Loading state com skeleton ou `Loader2` enquanto `isLoading` da query principal
- [ ] Erros de API tratados com `toast.error` (sem crash silencioso)

---

## Decisões Técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Busca única de fichas + filtro por `useMemo` | Evita múltiplas queries (1 por categoria); volume máximo é 20 fichas por clínica |
| 2 | Componentes em `_components/` do settings | Consistência com os demais tabs (`body-measurements-tab.tsx`, etc.) |
| 3 | `BodyMeasurementsTab` não deletado | Evita risco; pode ser removido em issue de limpeza posterior |
| 4 | `TabsTrigger` label já está correto | Label "Fichas de Avaliação" já existe — sem alteração necessária |
| 5 | `staleTime: Infinity` nos templates | Templates são estáticos (definidos no backend); não re-buscar por sessão |
