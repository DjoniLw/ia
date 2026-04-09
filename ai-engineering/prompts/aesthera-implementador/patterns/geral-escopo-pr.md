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

---

- [ ] **Ao alterar TTL/prazo/limite de negócio no backend, buscar obrigatoriamente referências ao valor na UI antes de fechar o PR**
  - 🔴 Anti-padrão: renomear `TTL_HOURS = 72` → `TTL_DAYS = 7` no service e não atualizar o texto `"O link expira em 72 horas"` no `SendAnamnesisDialog` — UI exibe prazo errado ao usuário.
  - ✅ Correto: antes de fechar qualquer PR que altere constante com impacto visível ao usuário (expiração, prazos, limites de uso, valores máximos), executar:
    ```bash
    # Buscar todas as referências ao valor ou nome da constante na UI
    grep -rn "72 horas\|TTL_HOURS\|horas\|dias" aesthera/apps/web/
    grep -rn "TTL_DAYS\|TTL_HOURS\|EXPIRY\|EXPIRES" aesthera/apps/web/
    ```
  - 📌 Constantes com impacto visual obrigatório: TTL de links, prazos de validade de voucher/cupom, limites de uso, janelas de tempo em mensagens ao cliente.
  - 📌 Boa prática: centralizar o texto visível ao usuário junto da constante com um comentário de referência cruzada:
    ```ts
    // ⚠️ Alterar este valor exige atualizar SendAnamnesisDialog.tsx ("O link expira em X dias")
    const TTL_DAYS = 7;
    ```
  - 📅 08/04/2026 — issue #152 (`TTL_HOURS → TTL_DAYS` no service; UI do dialog exibia "72 horas" após a mudança)

---

- [ ] **Ao migrar campo de mídia de base64 para URL (ex: `signatureBase64` → `signatureUrl`), verificar todos os `src=` e usos do campo anterior na UI**
  - 🔴 Anti-padrão: renomear `signature` → `signatureHash` no schema Prisma + DTO sem buscar usos em componentes React — `<img src={request.signature} />` continua referenciando o campo antigo e exibe imagem quebrada.
  - ✅ Correto: ao renomear ou migrar qualquer campo de mídia, executar antes de fechar o PR:
    ```bash
    # Buscar o nome do campo antigo em toda a UI
    grep -rn "\.signature\b\|signatureBase64\|signatureUrl" aesthera/apps/web/
    # Verificar src= em imagens
    grep -rn "src={" aesthera/apps/web/ | grep -i "signature\|photo\|avatar\|image\|img"
    ```
  - 📌 Aplica-se a qualquer renomeação ou mudança de tipo de campo de: assinatura, foto, avatar, logotipo, URL de arquivo, thumbnail.
  - 📌 Checklist de migração de campo de mídia:
    1. [ ] Buscar nome do campo antigo em `aesthera/apps/web/`
    2. [ ] Verificar todos os `<img src={...}>` e `<Image src={...}>` que usam o campo
    3. [ ] Verificar todos os hooks/types que tipam a entidade (`use-*.ts`, `*.types.ts`)
    4. [ ] Atualizar o tipo da entidade no frontend no mesmo PR
  - 📅 08/04/2026 — issue #152 (`signature → signatureHash` no schema; `<img src={request.signature}>` não atualizado no componente de visualização)
