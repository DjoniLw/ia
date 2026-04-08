# Padrões — Frontend: Filtros e Listagens

> Carregue este arquivo quando for implementar: campos de busca, filtros, tabelas, paginação, tabs com listas, seleção de entidades da API.

---

- [ ] **Filtragem client-side em listagens é anti-padrão — sempre disparar requisição à API**
  - 🔴 Anti-padrão: `const visible = data.filter(x => x.status === selected)` — com centenas de registros, filtra apenas o subconjunto já carregado.
  - ✅ Correto: qualquer mudança de filtro gera nova chamada à API:
    ```ts
    const { data } = useQuery({
      queryKey: ['equipments', { status: activeStatus }],
      queryFn: () => api.get(`/equipment?status=${activeStatus}`),
    });
    ```
  - 📌 Exceção: filtros de UI puramente visual que não alteram os dados buscados (ex.: alternar view lista/grid sobre dados já paginados).
  - 📅 29/03/2026

---

- [ ] **🔁 REINCIDÊNCIA — `<DataPagination>` obrigatório em TODAS as seções/tabs que listam dados, não apenas na página principal (BLOQUEANTE)**
  - 🔴 Anti-padrão: `<DataPagination>` na aba principal, mas tab interna entregue com `limit` hardcoded e sem paginação.
  - ✅ Correto: cada `<TabsContent>` (ou seção) com lista tem seu próprio `<DataPagination>` com estado independente:
    ```tsx
    <TabsContent value="digital-records">
      <DataTable data={digitalRecords?.items} />
      <DataPagination
        total={digitalRecords?.total}
        page={recordsPage}
        pageSize={recordsPageSize}
        onPageChange={setRecordsPage}
        onPageSizeChange={(size) => { setRecordsPageSize(size); setRecordsPage(1); }}
      />
    </TabsContent>
    ```
  - 📌 Checklist para telas com tabs: para cada `<TabsContent>` com lista → tem `<DataPagination>`. Nenhuma aba é exceção.
  - 📌 Referência visual: `aesthera/apps/web/app/(dashboard)/financial/page.tsx` linhas 396–418.
  - 📅 08/04/2026 (base: 29/03/2026)

---

- [ ] **Ao migrar para paginação server-side, busca textual também deve ir para o servidor**
  - 🔴 Anti-padrão: migrar paginação mas manter `data?.items.filter(item => item.name.includes(search))` — filtra apenas os 20 da página atual.
  - ✅ Correto: `search` como parâmetro da query; mudar o campo de busca dispara nova requisição e reseta `page` para 1:
    ```tsx
    const { data } = useQuery({
      queryKey: ['resource', { search, page, pageSize }],
      queryFn: () => api.get('/resource', { params: { search, page, limit: pageSize } }),
    });
    function handleSearchChange(value: string) { setSearch(value); setPage(1); }
    ```
  - 📌 Checklist de migração: paginação server-side ✅ + busca server-side ✅ + filtros de status server-side ✅. Todos ou nenhum.
  - 📅 30/03/2026

---

- [ ] **Telas financeiras com filtro de período devem ter presets de data + URL sync**
  - 🔴 Anti-padrão: apenas date inputs sem presets e sem `useSearchParams` — usuário perde contexto ao navegar.
  - ✅ Correto: presets (Hoje / 7 dias / 30 dias / 6 meses / 1 ano) + `useSearchParams` + `router.replace()`.
  - 📌 Referência canônica: `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`.
  - 📅 25/03/2026

---

- [ ] **`<ComboboxSearch>` para entidades da API — nunca `<select>` nativo ou `<datalist>` (BLOQUEANTE)**
  - 🔴 Anti-padrão: `<select><option>` para campos que carregam dados dinâmicos (clientes, serviços, profissionais, salas, equipamentos).
  - ✅ Correto: `<ComboboxSearch>` de `@/components/ui/combobox-search.tsx`.
  - 📌 Estilo por contexto — **não intercambiável**:
    - Em barra de filtros → `triggerClassName="h-8 rounded-full border px-3 py-1 text-xs font-medium"`
    - Em formulário → `triggerClassName="h-9 w-full rounded-md border px-3 py-2 text-sm"`
  - 📌 Mensagem de dropdown vazio por estado:
    - Campo sem query (`''`) → `"Digite para buscar"`
    - Busca com resultado vazio → `"Nenhum resultado encontrado"`
  - 📌 Chips removíveis para seleção múltipla — nunca pills estáticas.
  - 📅 25/03/2026, 04/04/2026

---

- [ ] **Status/tipo com ≤ 6 opções fixas usa pills arredondados — nunca `<select>` nativo**
  - 🔴 Anti-padrão: `<select value={statusFilter}>` para filtros de status.
  - ✅ Correto: pills com classes `rounded-full border px-3 py-1 text-xs font-medium`:
    - Ativo: `border-primary bg-primary text-primary-foreground`
    - Inativo: `border-input bg-background hover:bg-accent`
  - 📅 25/03/2026

---

- [ ] **Toda tela com filtros deve ter legenda descritiva dos filtros ativos + botão "Restaurar padrão"**
  - 🔴 Anti-padrão: barra de filtros sem indicação do que está filtrado e sem atalho de reset.
  - ✅ Correto:
    ```tsx
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>Exibindo {buildFilterLabel(...)}</span>
    </div>
    ```
  - 📌 Botão "Restaurar padrão": aparece apenas quando filtros diferem do padrão; SEMPRE retorna ao estado padrão (não a vazio).
  - 📌 Referência canônica: `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`.
  - 📅 25/03/2026
