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

<!-- Itens serão adicionados automaticamente após code reviews -->

### Validação e Tipagem

<!-- Itens serão adicionados automaticamente após code reviews -->

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

<!-- Itens serão adicionados automaticamente após code reviews -->

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
