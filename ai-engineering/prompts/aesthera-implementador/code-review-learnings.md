# Code Review Learnings — Aesthera Implementador

> Este arquivo é mantido automaticamente pelo agente `aesthera-implementador`.  
> Cada item representa um padrão aprendido a partir de correções úteis identificadas em code reviews do Copilot.  
> **Leia este arquivo antes de qualquer implementação** e aplique todos os itens como checklist preventivo.

---

## Como usar

Antes de commitar qualquer código, percorra cada item abaixo e confirme mentalmente:  
`"Verifiquei isso no código que acabei de escrever?"`

Se a resposta for não → revise antes de prosseguir.

---

## Backend

### Segurança e Multi-tenancy

- [ ] **Nunca proteger dados sensíveis apenas ocultando a UI — a proteção DEVE existir no backend**
  - 🔴 Anti-padrão: restringir o acesso de um perfil (ex: recepcionista) simplesmente ocultando o componente React que exibe dados financeiros ou `screenPermissions`. Isso não impede chamadas diretas à API.
  - ✅ Correto: toda restrição de acesso a dados sensíveis exige um `roleGuard` (ou decorator equivalente) no endpoint correspondente da API. A UI pode *também* ocultar o componente, mas isso é camada de apresentação — nunca a única barreira.
  - 📌 Regra geral: se um usuário com permissão restrita consegue chamar `GET /financial-summary` diretamente via curl e receber dados, a proteção de UI é inútil.
  - 📅 Aprendido em: 22/03/2026 — revisão de controle de acesso por perfil (dados financeiros e screenPermissions)

- [ ] **Guards de role devem ser aplicados na menor granularidade possível, não no componente/rota inteira**
  - 🔴 Anti-padrão: colocar o guard no componente pai ou em um `early return` no nível da página inteira — isso bloqueia acesso a partes da tela que poderiam ser visíveis ao perfil restrito
  - ✅ Correto: aplicar o guard diretamente na sub-seção protegida (ex.: painel financeiro dentro de uma tela de cliente) ou no endpoint específico, permitindo que o restante da página permaneça acessível
  - 📌 Regra geral: quanto menor o escopo do guard, mais precisa e menos disruptiva é a proteção — aplicar no nível mais interno possível em que a restrição faz sentido de negócio
  - 📅 Aprendido em: 24/03/2026 — revisão de componentes com controle de acesso por perfil

### Validação e Tipagem

- [ ] **Campos obrigatórios por regra de negócio devem ser validados explicitamente no `service.create()`, não apenas no schema Zod**
  - 🔴 Anti-padrão: campo `roomId` definido como opcional no Zod (`roomId?: string`) mas exigido pela regra de negócio R10 — o Zod aceita a requisição sem o campo, e o service executa sem validar, causando dados inválidos no banco
  - ✅ Correto: quando uma regra de negócio torna um campo obrigatório, adicionar guarda explícita no service antes de persistir:
    ```ts
    if (!dto.roomId) {
      throw new BadRequestException('roomId é obrigatório para agendamentos.');
    }
    ```
  - 📌 Regra geral: o Zod valida apenas a **forma dos dados** (tipo, formato, presença de string) — **regras de negócio** (ex.: "sala é obrigatória para este tipo de agendamento") devem ser verificadas no service, onde o contexto de negócio está disponível
  - 📅 Aprendido em: 23/03/2026 — revisão de `appointments.service.create()` (roomId requerido por R10 não validado no service)

- [ ] **Campos de data em DTOs Zod devem usar `.refine(v => Number.isFinite(Date.parse(v)))` além do regex de formato**
  - 🔴 Anti-padrão: validar apenas o formato visual com regex (`/^\d{4}-\d{2}-\d{2}$/`) sem garantir que a string representa uma data real — `"2026-02-30"` passa no regex mas não é uma data válida
  - ✅ Correto: combinar regex de formato com `.refine()` para validação semântica:
    ```ts
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
      .refine(v => Number.isFinite(Date.parse(v)), 'Data inválida')
    ```
  - 📌 Regra geral: regex verifica apenas o padrão visual; `.refine()` com `Date.parse()` + `Number.isFinite()` garante que a data é semanticamente válida (mês e dia existentes)
  - 📅 Aprendido em: 24/03/2026 — revisão de DTOs de agendamento com campos de data

### Async / Promises / Error Handling

<!-- Itens serão adicionados automaticamente após code reviews -->

### Prisma / Banco de Dados

<!-- Itens serão adicionados automaticamente após code reviews -->

---

## Frontend

### Textos e Internacionalização (PT-BR)

<!-- Itens serão adicionados automaticamente após code reviews -->

### Acessibilidade e Cores

- [ ] **Texto branco sobre `bg-amber-500` ou `bg-orange-400` reprova WCAG — não usar em EVENT_COLOR ou STATUS_COLOR**
  - 🔴 Anti-padrão: usar `text-white` sobre fundos de baixo contraste como `bg-amber-500` ou `bg-orange-400` em badges, tags ou eventos de calendário — contraste <3:1, reprovando WCAG AA
  - ✅ Correto: para tonalidades amber/orange intermediárias, usar `text-amber-900` ou `text-orange-900` como cor de texto; ou escolher um fundo suficientemente escuro (ex.: `bg-amber-700`, `bg-orange-700`) que suporte texto branco com contraste ≥4.5:1
  - 📌 Regra geral: antes de definir qualquer par fundo + texto, verificar o contraste — para texto normal o mínimo é 4.5:1 (WCAG AA). `bg-amber-500` (#F59E0B) com `text-white` = ~2.3:1 — reprovado
  - 📅 Aprendido em: 24/03/2026 — revisão de EVENT_COLOR no calendário (cores intermediárias com texto branco)

- [ ] **`STATUS_COLOR` e `EVENT_COLOR` devem ser definidos em um único arquivo central — nunca replicados por página**
  - 🔴 Anti-padrão: definir `const STATUS_COLOR = { pending: '...', completed: '...' }` diretamente em cada página/componente que usa — resulta em divergência de cores entre páginas e dark mode inconsistente
  - ✅ Correto: centralizar em um único arquivo (ex.: `lib/constants/colors.ts`) e importar em todos os componentes que precisam
  - 📌 Regra geral: qualquer constante visual compartilhada entre ≥2 componentes pertence a um arquivo central — alterar uma cor de status deve ser uma mudança em 1 único lugar
  - 📅 Aprendido em: 24/03/2026 — revisão de STATUS_COLOR duplicado em múltiplas páginas sem suporte a dark mode

### Formulários e Validação

- [ ] **Verificar lógica `disabled` do botão salvar/gravar em todo formulário implementado**
  - 🔴 Erro: botão salvar com `disabled={isPending || !isDirty}` em formulário de **cadastro novo** — o form começa sem dirty state, deixando o botão sempre desabilitado
  - ✅ Correto: formulário de cadastro novo usa `disabled={isPending || !isValid}`; formulário de edição pode usar `disabled={isPending || !isDirty}` se realmente não deve salvar sem mudança
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **Nunca alterar lógica de formulários ou botões de telas não relacionadas à task**
  - 🔴 Erro: ao implementar uma task de adicionar máscara em campos, reimplementou a barra de filtros e alterou o `disabled` do botão em tela adjacente
  - ✅ Correto: identificar as zonas estáveis antes de implementar (via "Mapeamento de Zona Estável") e alterar SOMENTE os campos pedidos na issue
  - 📅 Aprendido em: 21/03/2026 — cadastro de cliente após task de máscaras em grades

- [ ] **Converter data para string ISO no frontend deve usar hora local — nunca `toISOString().slice(0, 10)` que opera em UTC**
  - 🔴 Anti-padrão: `new Date(value).toISOString().slice(0, 10)` — `toISOString()` converte para UTC; um agendamento às **23h no Brasil (UTC-3)** vira o dia seguinte em UTC, enviando a data errada para a API
  - ✅ Correto: usar conversão baseada em hora local:
    ```ts
    const toISODate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    ```
    Ou, se o projeto usa `date-fns`: `format(date, 'yyyy-MM-dd')` (usa hora local por padrão)
  - 📌 Regra geral: nunca usar `toISOString()` para extrair a parte de data em contextos com fuso horário local — o resultado depende do UTC offset do cliente
  - 📅 Aprendido em: 24/03/2026 — revisão de envio de datas de agendamentos com fuso horário

### Componentes e Estado

- [ ] **Verificar alinhamento da barra de filtros em toda tela criada ou modificada**
  - 🔴 Erro: barra de filtros com `flex gap-4` ou `space-x-2` ao invés do padrão — campos desalinhados
  - ✅ Correto: sempre usar `className="flex flex-wrap items-center gap-2"` para a div que contém filtros. Campo de busca: `h-8 w-48 text-sm`
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **Verificar que campos de pesquisa novos seguem as classes do padrão `ui-standards.md`**
  - 🔴 Erro: `<Input className="w-full" placeholder="Search...">` — fora do padrão em tamanho e idioma
  - ✅ Correto: `<Input placeholder="Buscar por nome…" value={search} onChange={...} className="h-8 w-48 text-sm" />`
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

---

## Geral

### Testes

- [ ] **Ao injetar nova dependência de serviço em um módulo existente, adicionar `vi.mock()` correspondente no arquivo de teste**
  - 🔴 Anti-padrão: adicionar `private accountsPayable = new AccountsPayableService()` (ou qualquer outro serviço) no service, sem atualizar o teste correspondente — os testes quebram com erros de `prisma não mockado` ou `método undefined`
  - ✅ Correto: sempre que um novo serviço for injetado em um módulo que já possui testes, adicionar imediatamente o mock no arquivo `.test.ts` antes de rodar qualquer suite:
    ```ts
    vi.mock('../accounts-payable/accounts-payable.service');
    ```
    E, se necessário, configurar o comportamento esperado no `beforeEach` com `vi.mocked(AccountsPayableService.prototype.metodo).mockResolvedValue(...)`.
  - 📌 Regra geral: toda nova dependência de serviço introduzida em um módulo testado é um **breaking change nos testes** — o mock é obrigatório e deve ser adicionado no mesmo commit/PR que introduz a dependência.
  - 📅 Aprendido em: 23/03/2026 — revisão de `supply-purchases.service.test.ts` (AccountsPayableService não mockado após injeção)

- [ ] **Todo PR que adicione ou modifique arquivos `*.test.ts` / `*.spec.ts` exige a seção `## Test Change Justification` no corpo do PR — incluir no momento de abrir o PR, não como pós-fix**
  - 🔴 Anti-padrão 1: abrir um PR com alterações de testes sem a seção obrigatória — o workflow `test-guardian.yml` bloqueia o CI automaticamente
  - 🔴 Anti-padrão 2 (crítico): editar a descrição do PR depois e clicar "Re-run" **não resolve** — o GitHub Actions usa o `body` do **evento original** (`pull_request` ou `pull_request_target`), não o body atual do PR. Clicar em "Re-run" reexecuta o workflow com o payload original, sem a seção adicionada posteriormente
  - ✅ Correto: incluir a seção no corpo do PR **desde o momento da criação**:
    ```markdown
    ## Test Change Justification
    Motivo: {descrever por que os testes foram adicionados/alterados}
    Referência: {issue ou decisão técnica}
    Impacto: {o que muda no comportamento — ex: cobertura aumentada, regra de negócio atualizada}
    ```
  - 🔧 Única solução quando a seção foi esquecida: fazer um novo commit (pode ser vazio) para disparar um novo evento `pull_request` com o body atualizado:
    ```bash
    git commit --allow-empty -m "chore: trigger CI with Test Change Justification"
    git push
    ```
  - 📌 Boa prática: incluir esta seção no template de PR do repositório (`.github/pull_request_template.md`) para que apareça automaticamente em todo PR novo
  - 📅 Aprendido em: 24/03/2026 (atualizado 24/03/2026) — revisão de workflow `test-guardian.yml`; comportamento do GitHub Actions com evento original confirmado

### Arquitetura e Padrões do Projeto

- [ ] **Task de formatação/máscara = alterar somente o campo alvo, nada mais**
  - 🔴 Erro: ao adicionar máscara de CPF/telefone/CNPJ em um campo, foi alterado o layout do wrapper, a barra de filtros e outros inputs do mesmo formulário
  - ✅ Correto: identificar o `<FormField>` ou `<Input>` específico e aplicar a máscara nele. Se o arquivo precisar de qualquer outra mudança fora do campo, parar e perguntar ao usuário
  - 📅 Aprendido em: 21/03/2026 — task de máscaras nas grades

- [ ] **Leitura obrigatória do arquivo completo antes de qualquer edição em tela existente**
  - 🔴 Erro: editar apenas os trechos relevantes sem ler o arquivo completo, causando alteração acidental de padrões que estavam corretos
  - ✅ Correto: ler o arquivo inteiro, mapear as zonas estáveis e confirmar que o diff final afeta exclusivamente o que a issue pede
  - 📅 Aprendido em: 21/03/2026 — cadastro de cliente após task de grades

---

## Histórico de Atualizações

| Data | PR | Itens adicionados |
|------|----|-------------------|
| — | — | Arquivo criado (vazio) |
| 21/03/2026 | — | 5 padrões adicionados pelo treinador-agent: lógica disabled do botão salvar, barra de filtros desalinhada, campos de pesquisa fora do padrão, task de máscara alterando escopo indevido, leitura obrigatória de arquivo antes de edição |
| 22/03/2026 | — | 1 padrão adicionado pelo treinador-agent: anti-padrão "ocultar UI mas deixar API aberta" — proteção de dados sensíveis deve existir no backend via roleGuard |
| 23/03/2026 | — | 1 padrão adicionado pelo treinador-agent: campos obrigatórios por regra de negócio devem ter validação explícita no `service.create()`, além do schema Zod |
| 24/03/2026 | — | 6 padrões adicionados pelo treinador-agent: (1) contraste WCAG para texto branco sobre amber/orange em EVENT_COLOR; (2) STATUS_COLOR centralizado em arquivo único; (3) guards de role na menor granularidade possível; (4) safe parse de data em DTOs Zod com `.refine(Number.isFinite(Date.parse(v)))`; (5) toISODate em frontend usando hora local, não `toISOString()`; (6) seção `## Test Change Justification` obrigatória em PRs com arquivos de teste |
