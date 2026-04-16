# Padrões — Frontend: Componentes do Design System

> Carregue este arquivo quando for implementar: botões, modais, toggles, caixas de aviso, estados vazios, ícones, feedback de ações, ou totalizadores financeiros.

---

## Tabela de Componentes Obrigatórios

| Necessidade | Componente correto | Local |
|---|---|---|
| Botão de ação (salvar, excluir, editar, cancelar) | `<Button variant="...">` | `@/components/ui/button.tsx` |
| Modal / overlay | `<Dialog>` do shadcn/ui | `@/components/ui/dialog.tsx` |
| Toggle booleano (ativo/inativo) | `<Switch>` do shadcn/ui | `@/components/ui/switch.tsx` |
| Caixa de aviso / alerta / info / erro contextual | `<InfoBanner variant="...">` | `@/components/ui/info-banner.tsx` |
| Busca de entidade da API | `<ComboboxSearch>` | `@/components/ui/combobox-search.tsx` |
| Paginação de listagem | `<DataPagination>` | `@/components/ui/data-pagination.tsx` |
| Ícones | Lucide React | `lucide-react` |

---

- [ ] **Botões de ação NUNCA usam `<button>` nativo — sempre `<Button>` do design system (BLOQUEANTE)**
  - 🔴 Anti-padrão: `<button onClick={handleSave} className="rounded bg-blue-600...">Salvar</button>`
  - ✅ Correto:
    ```tsx
    <Button onClick={handleSave}>Salvar</Button>                          // ação primária
    <Button variant="destructive" onClick={handleDelete}>Excluir</Button> // destrutiva
    <Button variant="ghost" size="sm" onClick={handleEdit}><Pencil className="h-4 w-4" /></Button> // icon-only de linha
    <Button variant="outline" onClick={onCancel}>Cancelar</Button>        // secundária
    ```
  - 📌 Exceção aceita: pills de filtro de status em barras de filtro usam `<button>` nativo com classes manuais — padrão oficial de `ui-standards.md §7.2`.
  - 📌 Detecção: buscar `<button ` (com espaço) em arquivos `.tsx`. Qualquer ocorrência fora de pills de filtro é candidata a violação.
  - 📅 08/04/2026

---

- [ ] **🔁 REINCIDÊNCIA — Modal nunca usa `fixed inset-0 z-50` manual — sempre `<Dialog>` do shadcn/ui (BLOQUEANTE)**
  - 🔴 Anti-padrão: `<div className="fixed inset-0 z-50 ...">` — não garante foco trap, não respeita `isDirty` guard, sem animações padronizadas.
  - ✅ Correto:
    ```tsx
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Título</DialogTitle></DialogHeader>
        {/* conteúdo */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    ```
  - 📅 25/03/2026 (reincidência PR #144: 31/03/2026)

---

- [ ] **Controles booleanos usam `<Switch>` do shadcn/ui — nunca `<button>` estilizado como toggle**
  - 🔴 Anti-padrão: `<button>` com classes condicionais `bg-green-500` / `bg-gray-300` para representar ativo/inativo.
  - ✅ Correto:
    ```tsx
    import { Switch } from '@/components/ui/switch';
    <Switch checked={isActive} onCheckedChange={handleToggle} aria-label="Ativar notificação" />
    ```
  - 📌 `<Switch>` fornece `role="switch"`, `aria-checked`, animações e suporte a dark mode.
  - 📅 30/03/2026

---

- [ ] **Caixas de aviso/alerta/info/erro usam `<InfoBanner>` — nunca classes Tailwind inline (BLOQUEANTE)**
  - 🔴 Anti-padrão: `<div className="border border-amber-400 bg-amber-100 ...">` — tons errados, baixo contraste, sem dark mode correto.
  - ✅ Correto:
    ```tsx
    import { InfoBanner } from '@/components/ui/info-banner';
    <InfoBanner variant="warning" title="Esta ação não pode ser desfeita"
      description="O registro será removido permanentemente." />
    // Com conteúdo rico:
    <InfoBanner variant="warning" title="Créditos serão devolvidos">
      <ul className="mt-1 space-y-0.5">{items.map(i => <li key={i.id}>• {i.label}</li>)}</ul>
    </InfoBanner>
    ```
  - 📌 Variantes: `warning` | `info` | `error` | `success`.
  - 📌 Banners verdes informativos simples: `bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300` per `ui-standards.md §6`.
  - 📅 04/04/2026

---

- [ ] **CTA em empty state usa `<Button variant="outline">` dentro de container padronizado**
  - 🔴 Anti-padrão: `<button className="text-primary underline">Adicionar primeiro item</button>`.
  - ✅ Correto:
    ```tsx
    <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
      <p className="text-sm">Nenhum registro encontrado.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
        Adicionar primeiro registro
      </Button>
    </div>
    ```
  - 📅 25/03/2026

---

- [ ] **Nunca usar caracteres unicode como ícones — usar equivalentes Lucide React**
  - 🔴 Anti-padrão: `🏷 ✓ ✕ × ● ★ ⚠ ℹ` como ícones — renderização inconsistente entre OS, não respeita tema.
  - ✅ Correto:
    ```tsx
    import { Tag, Check, X, Circle, Star, AlertTriangle, Info } from 'lucide-react';
    <Tag className="h-4 w-4" />   <X className="h-4 w-4" />   <Check className="h-4 w-4 text-green-600" />
    ```
  - 📅 31/03/2026

---

- [ ] **Feedback de sucesso (toast, badge) só ocorre após confirmação da API — nunca antes**
  - 🔴 Anti-padrão: `setIsActive(!isActive); toast.success('Salvo!')` sem chamada de API.
  - ✅ Correto: feedback apenas no `.onSuccess` da mutation:
    ```ts
    const mutation = useMutation({
      mutationFn: (value: boolean) => api.patch('/settings', { isActive: value }),
      onSuccess: () => toast.success('Configuração salva!'),
      onError: () => toast.error('Erro ao salvar. Tente novamente.'),
    });
    ```
  - 📌 Checklist antes de `toast.success`: existe `mutationFn`? Toast está em `onSuccess`? Existe `onError`?
  - 📅 30/03/2026

---

- [ ] **`idempotencyKey` em modal: `useMemo([open])`, não `useState` (que só inicializa na montagem)**
  - 🔴 Anti-padrão: `const [key] = useState(() => crypto.randomUUID())` em modal com `if (!open) return null` — chave persiste entre aberturas pois o componente não é desmontado.
  - ✅ Opção 1: `const key = useMemo(() => open ? crypto.randomUUID() : '', [open]);`
  - ✅ Opção 2 (preferida): no pai `{open && <Modal />}` — força desmontagem e nova `useState` a cada abertura.
  - 📌 Aplica-se a: qualquer valor único por abertura de modal (idempotency keys, seeds de formulário).
  - 📅 30/03/2026

---

- [ ] **Totalizadores financeiros posicionados ACIMA da tabela — nunca abaixo do `<DataPagination>`**
  - 🔴 Anti-padrão: `<DataTable />` → `<DataPagination />` → `<TotalsPanel />` — totais invisíveis sem scroll.
  - ✅ Correto: `<TotalsPanel />` (ou cards de KPI) → `<DataTable />` → `<DataPagination />`.
  - 📌 Totais financeiros são dados de alto valor — devem estar visíveis no viewport inicial.
  - 📅 04/04/2026

---

- [ ] **Componente criado mas não importado/registrado na página de destino (BLOQUEANTE)**
  - 🔴 Anti-padrão: implementar um novo componente (ex: `<MeasurementSheetsSettings />`) e não importá-lo nem usá-lo no `page.tsx` ou na aba de destino — componente existe mas nunca é renderizado.
  - ✅ Correto: ao criar qualquer componente vinculado a uma rota, aba ou seção, verificar obrigatoriamente:
    1. O `page.tsx` ou layout de destino importa o componente?
    2. O componente é usado/renderizado no JSX da página?
    3. Se for uma aba: a aba correspondente existe e aponta para o componente?
  - 📌 Checklist pós-implementação: buscar o nome do componente em todos os arquivos do módulo — se não houver nenhum `import` fora do próprio arquivo, é um sinal de alerta.
  - 📌 Aplica-se a: componentes de settings, abas de configuração, seções de página, modais registrados via rota.
  - 📅 15/04/2026
