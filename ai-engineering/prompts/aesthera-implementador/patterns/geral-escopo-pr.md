# Padrões — Geral: Escopo de PR e Disciplina de Mudança

> Carregue este arquivo quando for abrir um PR, trabalhar em task de máscara/formatação pontual, ou ao identificar que a implementação está tocando arquivos além do escopo.

---

- [ ] **PR de padronização de UI não deve incluir novos módulos de backend**
  - 🔴 Anti-padrão: PR com título "padronização de filtros" que inclui módulo completo de backend (rotas, service, repository, DTOs, migrations).
  - ✅ Correto: features de alto risco (integrações, contratos, webhooks, storage, dados jurídicos) têm issue e PR **independentes**.
  - 📌 Checklist antes de abrir PR:
    1. O título descreve **todo** o que há nele?
    2. Algum arquivo em `prisma/migrations/` não estava previsto na issue?
    3. Algum novo módulo (`*.routes.ts`, `*.service.ts`, `*.repository.ts`) foi criado além do escopo?
    → Se sim a qualquer resposta: separar em PRs distintos.
  - 📅 29/03/2026

---

- [ ] **Task de formatação/máscara = alterar somente o campo alvo, nada mais**
  - 🔴 Anti-padrão: ao adicionar máscara de CPF/telefone, reimplementar a barra de filtros e alterar o `disabled` do botão em outros campos do mesmo formulário.
  - ✅ Correto: identificar o `<FormField>` / `<Input>` específico e aplicar **apenas nele**. Se perceber necessidade de alterar outra coisa, parar e perguntar ao usuário.
  - 📅 21/03/2026

---

- [ ] **Ler o arquivo completo antes de qualquer edição em tela existente**
  - 🔴 Anti-padrão: editar apenas os trechos relevantes sem ler o arquivo completo — causa alteração acidental de padrões que estavam corretos (zonas estáveis).
  - ✅ Correto:
    1. Ler o arquivo inteiro
    2. Mapear as "zonas estáveis" (partes corretas que não devem ser tocadas)
    3. Confirmar que o diff final afeta exclusivamente o que a issue pede
  - 📌 Zonas estáveis comuns: barras de filtros já no padrão, campos de pesquisa com classes corretas, lógica `disabled` já funcional, textos já em PT-BR.
  - 📅 21/03/2026
