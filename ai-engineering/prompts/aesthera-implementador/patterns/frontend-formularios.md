# Padrões — Frontend: Formulários e Validação

> Carregue este arquivo quando for implementar: formulários de cadastro/edição, campos de data, campos de seleção, ou botão Salvar com lógica `disabled`.

---

- [ ] **Lógica `disabled` do botão Salvar: `!isValid` para novo, `!isDirty` para edição**
  - 🔴 Anti-padrão: `disabled={isPending || !isDirty}` em formulário de **cadastro novo** — form começa sem dirty state, botão fica sempre desabilitado.
  - ✅ Correto:
    - **Cadastro novo**: `disabled={isPending || !isValid}` — habilitado assim que o form passa na validação
    - **Edição**: `disabled={isPending || !isDirty}` — OK se não deve salvar sem mudanças
  - 📌 Regra prática: se o usuário pode abrir o formulário vazio e salvar sem digitar nada, usar `!isValid`. Se o formulário começa preenchido e deve bloquear salvar sem alteração, usar `!isDirty`.
  - 📅 21/03/2026

---

- [ ] **🔁 REINCIDÊNCIA — `<select>` nativo NUNCA é aceitável no design system Aesthera**
  - 🔴 Anti-padrão: `<select><option value="credit_card">Cartão de Crédito</option></select>` — rompe consistência visual independentemente do contexto.
  - ✅ Correto — escolha pelo número de opções:
    - **≤ 6 opções fixas** → **pills selecionáveis** `rounded-full border px-3 py-1 text-xs font-medium`
    - **> 6 opções fixas** → **`<Select>` do shadcn/ui** (`@/components/ui/select`)
    - **Opções dinâmicas da API** → **`<ComboboxSearch>`** (`@/components/ui/combobox-search.tsx`)
  - 📌 Ponto de verificação: ao escrever qualquer campo de seleção, perguntar "Este campo usa `<select>` nativo?" — se sim, parar e usar a alternativa correta.
  - 📅 02/04/2026 (base: 25/03/2026)

---

- [ ] **Conversão de data para string ISO deve usar hora local — nunca `toISOString()` (usa UTC)**
  - 🔴 Anti-padrão: `new Date(value).toISOString().slice(0, 10)` — agendamento às 23h no Brasil (UTC-3) vira o dia seguinte em UTC.
  - ✅ Correto:
    ```ts
    // Manual (sem dependências):
    const toISODate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    // Com date-fns (usa hora local por padrão):
    import { format } from 'date-fns';
    format(date, 'yyyy-MM-dd');
    ```
  - 📌 Regra: nunca usar `toISOString()` para extrair a parte de data em contextos com fuso horário local.
  - 📅 24/03/2026

---

- [ ] **Arquivos `.tsx` com texto PT-BR devem ser salvos em UTF-8 sem BOM (Windows)**
  - 🔴 Anti-padrão: salvar com BOM (`﻿`, U+FEFF) ou double-encoding (`ÃO`, `Ã§`, `Ã£`) — todo texto da interface fica ilegível no browser.
  - ✅ Correto: VS Code → clicar no encoding no canto inferior direito → `Save with Encoding` → `UTF-8`.
  - 📌 BOM aparece como `﻿'use client'` no topo do arquivo — remover o U+FEFF antes de salvar.
  - 📌 Mapeamento de double-encoding: `Ã³` → `ó` | `Ã§` → `ç` | `Ã£` → `ã` | `Ã¡` → `á` | `Ã£o` → `ão`.
  - 📅 26/03/2026
