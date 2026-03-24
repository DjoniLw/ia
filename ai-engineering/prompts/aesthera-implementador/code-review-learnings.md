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

### Async / Promises / Error Handling

<!-- Itens serão adicionados automaticamente após code reviews -->

### Prisma / Banco de Dados

<!-- Itens serão adicionados automaticamente após code reviews -->

---

## Frontend

### Textos e Internacionalização (PT-BR)

<!-- Itens serão adicionados automaticamente após code reviews -->

### Formulários e Validação

- [ ] **Verificar lógica `disabled` do botão salvar/gravar em todo formulário implementado**
  - 🔴 Erro: botão salvar com `disabled={isPending || !isDirty}` em formulário de **cadastro novo** — o form começa sem dirty state, deixando o botão sempre desabilitado
  - ✅ Correto: formulário de cadastro novo usa `disabled={isPending || !isValid}`; formulário de edição pode usar `disabled={isPending || !isDirty}` se realmente não deve salvar sem mudança
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **Nunca alterar lógica de formulários ou botões de telas não relacionadas à task**
  - 🔴 Erro: ao implementar uma task de adicionar máscara em campos, reimplementou a barra de filtros e alterou o `disabled` do botão em tela adjacente
  - ✅ Correto: identificar as zonas estáveis antes de implementar (via "Mapeamento de Zona Estável") e alterar SOMENTE os campos pedidos na issue
  - 📅 Aprendido em: 21/03/2026 — cadastro de cliente após task de máscaras em grades

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
