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

- [ ] **Catch genérico em chamadas de storage/API externo mascara falhas reais de infra — nunca usar `catch { return false }`**
  - 🔴 Anti-padrão: silenciar toda exceção em chamadas a serviços externos (S3, R2, APIs de terceiros) com `catch { return false }` ou `catch { return null }` — uma falha de credenciais inválidas, timeout de rede ou bucket inexistente fica indistinguível de um arquivo genuinamente não encontrado
  - ✅ Correto: inspecionar o erro antes de decidir o comportamento. Para SDKs AWS/Cloudflare, verificar o código de erro:
    ```ts
    try {
      await s3.send(new GetObjectCommand({ ... }));
    } catch (err: unknown) {
      if (err instanceof Error && (err as { Code?: string }).Code === 'NoSuchKey') {
        return null; // não encontrado — esperado
      }
      // erro de infra (credenciais, rede, permissão) — propagar para diagnóstico
      throw err;
    }
    ```
  - 📌 Regra geral: `catch { return false }` é aceitável **somente** quando qualquer falha é tratada como ausência de dado. Para storage e APIs externas, erros de credenciais ou rede devem ser relançados para aparecer nos logs e alertas
  - 📅 Aprendido em: 25/03/2026 — revisão de chamadas de storage R2 mascarando erros de credencial

- [ ] **Fluxo presign/confirm de upload: o `presign` deve persistir um registro de upload pendente — o `confirm` valida pelo `id`, nunca aceita `storageKey` bruto do cliente**
  - 🔴 Anti-padrão: endpoint `POST /uploads/confirm` recebe `storageKey` diretamente do cliente e o persiste sem validação — permite que um usuário malicioso aponte para qualquer chave do bucket (inclusive de outros tenants) e force o sistema a registrá-la como válida
  - ✅ Correto: o fluxo deve ter duas etapas com estado server-side:
    1. `POST /uploads/presign` → gera a URL assinada **e** persiste um registro `PendingUpload { id, storageKey, clinicId, expiresAt }` no banco
    2. `POST /uploads/confirm` → recebe apenas o `uploadId` (UUID do `PendingUpload`), busca o registro com `clinicId` do token, verifica `expiresAt`, e só então persiste o recurso final
    ```ts
    // presign
    const pending = await prisma.pendingUpload.create({
      data: { storageKey, clinicId, expiresAt: addMinutes(new Date(), 15) },
    });
    return { uploadId: pending.id, presignedUrl };

    // confirm
    const pending = await prisma.pendingUpload.findFirst({
      where: { id: uploadId, clinicId }, // multi-tenancy garantido
    });
    if (!pending || pending.expiresAt < new Date()) throw new BadRequestException('Upload inválido ou expirado');
    // persistir recurso final usando pending.storageKey (nunca do client)
    ```
  - 📌 Regra geral: o cliente **nunca** deve poder nomear ou referenciar uma chave de storage diretamente no `confirm` — o `storageKey` é determinado pelo servidor no `presign` e recuperado pelo `id` no `confirm`. Isso previne path traversal de bucket e violação de multi-tenancy
  - 📅 Aprendido em: 25/03/2026 — revisão de `POST /uploads/confirm` recebendo `storageKey` bruto sem validação de intent de presign

### Prisma / Banco de Dados

- [ ] **IDOR em updates Prisma: sempre incluir `clinicId` no `where` para evitar que um tenant altere dados de outro**
  - 🔴 Anti-padrão: `prisma.entity.update({ where: { id }, data: { ... } })` — qualquer `clinicId` que conheça o `id` do registro pode sobrescrevê-lo, mesmo que pertença a outra clínica
  - ✅ Correto: usar `updateMany` com `clinicId` no where (garante multi-tenancy) e depois `findFirst` para retornar o objeto atualizado:
    ```ts
    await this.prisma.entity.updateMany({
      where: { id, clinicId },
      data: { ... },
    });
    return this.prisma.entity.findFirst({ where: { id, clinicId } });
    ```
  - 📌 Regra geral: **toda** operação de escrita em tabelas multi-tenant (`update`, `delete`, `updateMany`) deve incluir `clinicId` no `where`. O `id` isolado não é suficiente — é uma superfície de IDOR. Se `updateMany` retornar `count === 0`, o registro não pertence ao tenant → lançar `NotFoundException`
  - 📅 Aprendido em: 25/03/2026 — revisão de repositórios Prisma sem filtro de tenant em operações de update

---

## Frontend

### Filtros e Pesquisa

- [ ] **`<select>` nativo para entidades cadastradas é BLOQUEANTE**
  - 🔴 Anti-padrão: qualquer `<select>/<option>` ou `<datalist>` para campos que carregam dados dinâmicos da API (clientes, serviços, profissionais, insumos, salas, equipamentos)
  - ✅ Correto: sempre usar `<ComboboxSearch>` do design system (`/components/ui/combobox-search.tsx`). O componente deve ser criado antes de qualquer tela nova que precise desse padrão.
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

- [ ] **`<select>` para status/tipo fixo deve ser corrigido**
  - 🔴 Anti-padrão: `<select>` para filtros com opções fixas (≤ 6 opções) — quebra consistência com pills já usados em outras telas
  - ✅ Correto: pills `rounded-full border px-3 py-1 text-xs font-medium` com `border-primary bg-primary text-primary-foreground` quando ativo
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

- [ ] **Toda tela com filtros deve ter legenda descritiva + botão restaurar**
  - 🔴 Anti-padrão: entregar tela com filtros sem legenda de "o que está filtrado" e sem atalho de reset
  - ✅ Correto: implementar `buildFilterLabel()` + legenda `bg-muted/50 rounded-lg` + botão "Restaurar padrão" que retorna ao estado padrão (não vazio). Referência: `/carteira/page.tsx`
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

- [ ] **Filtros de telas financeiras DEVEM ter URL sync**
  - 🔴 Anti-padrão: filtros de data/período em telas financeiras sem `useSearchParams` — usuário perde contexto ao navegar
  - ✅ Correto: `useSearchParams` + `router.replace()` para sincronizar todos os filtros ativos na URL. Referência: `/carteira/page.tsx`
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

### Textos e Internacionalização (PT-BR)

- [ ] **Arquivos `.tsx` com acentuação PT-BR devem ser salvos em UTF-8 sem BOM — verificar antes de commitar no Windows**
  - 🔴 Anti-padrão: salvar arquivos `.tsx` com BOM (`﻿`, U+FEFF) ou com double-encoding (`ÃO`, `Ã§`, `Ã£`, etc.) — ocorre ao copiar texto de terminais Windows, usar editores como Notepad, ou ao configurar incorretamente o VS Code. Resultado: todos os textos da interface são renderizados como lixo no browser (`'DigitaÃ§Ã£o'`, `'Nome obrigatÃ³rio'`)
  - ✅ Correto: garantir que o arquivo está em UTF-8 sem BOM antes de commitar:
    1. No VS Code: clicar no seletor de encoding (canto inferior direito) → `Save with Encoding` → `UTF-8`
    2. Ou via `Ctrl+Shift+P` → `Change File Encoding` → `Save with Encoding` → `UTF-8`
    3. Se houver BOM, ele aparece como `﻿'use client'` no topo do arquivo — remover o caractere U+FEFF antes de salvar
  - 📌 Mapeamento dos padrões de double-encoding mais comuns (Latin-1 interpretado como UTF-8):
    - `Ã³` → `ó` | `Ã§` → `ç` | `Ã£` → `ã` | `Ã¡` → `á`
    - `Ãª` → `ê` | `Ã©` → `é` | `â€"` → `—` | `Ã£o` → `ão`
  - 📌 Regra geral: o VS Code exibe o encoding no canto inferior direito da barra de status. Em qualquer arquivo `.tsx` com texto PT-BR, confirmar que mostra `UTF-8` (sem "BOM" na label). Se mostrar `UTF-8 with BOM`, salvar novamente como `UTF-8`
  - 📅 Aprendido em: 26/03/2026 — revisão de PR #128 (`body-measurements-tab.tsx` com BOM + double-encoding, tornando toda a tela de medidas corporais inutilizável em produção)

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

- [ ] **Nunca criar modais manualmente com `fixed inset-0 z-50` — sempre usar o componente `<Dialog>` do shadcn/ui**
  - 🔴 Anti-padrão: implementar modal com `<div className="fixed inset-0 z-50 ...">` ou overlay customizado — não garante foco trap (acessibilidade), não respeita o `isDirty` guard, não possui animações padronizadas e viola o `ui-standards.md`
  - ✅ Correto: importar e usar o componente `<Dialog>` disponível em `@/components/ui/dialog`:
    ```tsx
    import {
      Dialog,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogFooter,
    } from '@/components/ui/dialog';

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Título do Modal</DialogTitle>
        </DialogHeader>
        {/* conteúdo */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    ```
  - 📌 Regra geral: `<Dialog>` do shadcn/ui fornece foco trap, fechamento por `Esc`, overlay acessível e animações consistentes — qualquer substituição manual perde esses comportamentos e gera inconsistência visual entre telas
  - 📅 Aprendido em: 25/03/2026 — revisão de dois componentes de modal implementados com `fixed inset-0 z-50` customizado

- [ ] **Verificar alinhamento da barra de filtros em toda tela criada ou modificada**
  - 🔴 Erro: barra de filtros com `flex gap-4` ou `space-x-2` ao invés do padrão — campos desalinhados
  - ✅ Correto: sempre usar `className="flex flex-wrap items-center gap-2"` para a div que contém filtros. Campo de busca: `h-8 w-48 text-sm`
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **Verificar que campos de pesquisa novos seguem as classes do padrão `ui-standards.md`**
  - 🔴 Erro: `<Input className="w-full" placeholder="Search...">` — fora do padrão em tamanho e idioma
  - ✅ Correto: `<Input placeholder="Buscar por nome…" value={search} onChange={...} className="h-8 w-48 text-sm" />`
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **CTA em empty state nunca deve ser `<button>` nativo estilizado com underline — usar `<Button variant="outline">` dentro do container padronizado**
  - 🔴 Anti-padrão: renderizar o call-to-action do estado vazio como `<button className="text-primary underline">` ou `<a>` estilizado — quebra consistência visual, não segue o design system e viola `ui-standards.md` seção 2.3
  - ✅ Correto: usar sempre o container e botão padronizados:
    ```tsx
    <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
      <p className="text-sm">Nenhum registro encontrado.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
        Adicionar primeiro registro
      </Button>
    </div>
    ```
  - 📌 Regra geral: todo empty state com ação primária usa `<Button variant="outline" size="sm" className="mt-3">` — nunca elemento nativo. O container segue exatamente `rounded-lg border bg-card py-16 text-center text-muted-foreground` conforme `ui-standards.md` seção 2.3
  - 📅 Aprendido em: 25/03/2026 — revisão de empty state com `<button>` nativo e underline em tela de uploads/medidas corporais

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

- [ ] **Teste existente quebrando após sua implementação = NUNCA alterar o teste — classificar o tipo e acionar o `test-guardian`**
  - 🔴 Anti-padrão (crítico): implementador modifica assertions, mocks ou remove `it()` blocks de testes existentes para o CI passar — pode estar silenciando proteção de regras de negócio críticas que a implementação violou sem perceber
  - 📌 Dois tipos de quebra — tratamentos distintos:
    - **Tipo 1 — Estrutural** (pode ser adaptado): o teste quebrou porque a estrutura mudou (novo campo obrigatório, assinatura alterada), mas a regra de negócio continua válida. Ex: adicionou `roomId` como obrigatório e o teste antigo não passa o campo. → test-guardian adapta o teste sem relaxar assertions.
    - **Tipo 2 — Regra de Negócio** (NUNCA adaptar — corrigir o código): o comportamento do sistema mudou de forma que viola uma regra estabelecida. Ex: teste `não permitir dois agendamentos para o mesmo profissional no mesmo horário` quebra porque a implementação removeu a verificação de conflito. → o código está errado. O teste só pode ser alterado se o PO documentar e aprovar explicitamente a mudança de regra.
  - ✅ Correto: ao detectar quebra, classificar e reportar ao usuário:
    ```
    ⚠️ Testes existentes quebraram após esta implementação:
    - {arquivo}.test.ts: "{nome do teste}" — {erro resumido}
      Tipo: [Estrutural | Regra de Negócio] — {justificativa}

    Não alterei os testes. Acione o test-guardian.
    ```
  - 📅 Aprendido em: 25/03/2026 (atualizado 25/03/2026) — CI bloqueado após implementador alterar teste para contornar falha; distinção Tipo 1/Tipo 2 adicionada após análise de impacto de regra de negócio

- [ ] **Após abrir qualquer PR, adicionar o roteiro de testes manuais como comentário — nunca no corpo do PR**
  - 🔴 Anti-padrão: abrir o PR sem o comentário de roteiro; colocar os cenários no corpo do PR (onde ficam misturados com a descrição técnica e não são atualizáveis sem risco de disparar CI)
  - ✅ Correto: imediatamente após criar o PR, executar `mcp_github_add_issue_comment` com o formato padrão já definido no prompt:
    ```markdown
    ## 🧪 Roteiro de Testes Manuais

    **Pré-requisitos:**
    - {ex.: clínica com pelo menos 1 profissional cadastrado}

    **Cenários:**
    - [ ] **{cenário principal}** — {o que fazer e o que esperar}
    - [ ] **{validação / erro esperado}** — {o que fazer e o que deve acontecer}

    **Fluxo base:**
    1. {passo mínimo para chegar à feature}
    2. {passo 2}
    ```
  - 📌 Máximo de 5 cenários: caso feliz, validação principal, erro esperado e edge case relevante — sem descrever cada clique
  - 📌 Se a feature for exclusivamente backend/API, substituir o fluxo de UI pelo endpoint + payload de teste
  - 📅 Aprendido em: 25/03/2026 — padrão definido após ausência recorrente de roteiro de teste manual em PRs

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
| 25/03/2026 | — | 2 padrões adicionados pelo treinador-agent: (1) IDOR em updates Prisma — `update({ where: { id } })` sem `clinicId` permite alteração cross-tenant; padrão correto é `updateMany` + `findFirst` com `clinicId`; (2) catch genérico mascarando erros de infra em storage/API externo — inspecionar código de erro antes de silenciar |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: modal manual com `fixed inset-0 z-50` é anti-padrão — sempre usar `<Dialog>` do shadcn/ui (`@/components/ui/dialog`) para foco trap, animações e consistência visual |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: fluxo presign/confirm de upload — `presign` deve persistir `PendingUpload` no banco; `confirm` valida pelo `id` server-side com `clinicId`, nunca aceita `storageKey` bruto do cliente |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: CTA em empty state nunca usa `<button>` nativo com underline — padrão correto é `<Button variant="outline" size="sm" className="mt-3">` dentro de container `rounded-lg border bg-card py-16 text-center text-muted-foreground` (ui-standards.md §2.3) |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: teste existente quebrando = nunca alterar o teste, acionar test-guardian; assumir que o código está errado por padrão |
| 26/03/2026 | PR #128 | 1 padrão adicionado pelo treinador-agent: arquivos `.tsx` com acentuação PT-BR devem ser salvos em UTF-8 sem BOM no Windows — BOM (U+FEFF) e double-encoding causam corrupção total de texto na interface; correção via VS Code → `Save with Encoding` → UTF-8 |
| 25/03/2026 | — | 4 padrões adicionados pelo treinador-agent (issue #124 — revisão transversal de filtros): (1) `<select>` para entidades cadastradas é BLOQUEANTE — usar `<ComboboxSearch>`; (2) `<select>` para status fixo → corrigir para pills; (3) legenda descritiva + botão "Restaurar padrão" obrigatórios em toda tela com filtros; (4) URL sync via `useSearchParams` em filtros de telas financeiras |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: após abrir qualquer PR, adicionar cenários de teste manual como comentário (não no corpo) via `mcp_github_add_issue_comment` — tabela Markdown por área (Settings, Ficha do Cliente, API/Multi-tenancy, Scripts) com colunas #, Cenário, Resultado esperado; cobrir fluxo feliz, casos de borda, permissões por papel e estados vazios/negativos |
