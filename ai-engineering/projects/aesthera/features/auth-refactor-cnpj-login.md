# Refatoração de Cadastro e Autenticação — Login sem Slug + CNPJ nas Configurações + Transferência de Empresa por E-mail

## Visão Geral

Refatorar o fluxo de cadastro de empresa e autenticação em quatro frentes principais:
1. Resolver o slug pelo e-mail do usuário ao invés de exigir digitação no login
2. Tornar o CNPJ **opcional** no cadastro, movendo sua validação completa para a tela de Configurações da empresa
3. Integrar opcionalmente com a API da Receita Federal (BrasilAPI) ao informar o CNPJ nas Configurações
4. Adicionar fluxo de transferência de empresa por e-mail quando um e-mail já existe em outra empresa — tanto no cadastro de empresa quanto no convite de usuário (regra aplicável **apenas em produção**)

---

## 1 — Login sem slug manual

**Situação atual:**
- `LoginDto` exige `clinicSlug` como campo digitado pelo usuário
- A tela de login tem campo de "Identificador da clínica" + e-mail + senha
- O slug é enviado no header `X-Clinic-Slug` para o backend

**Mudança desejada:**
- Na tela de login, o usuário informa apenas **e-mail + senha**
- Ao preencher o e-mail, o frontend busca automaticamente o slug associado àquele e-mail (novo endpoint: `GET /auth/resolve-slug?email=...`)
- O endpoint retorna o `clinicSlug` sem expor dados sensíveis (resposta genérica se não encontrado, para não vazar existência de conta)
- O fluxo segue igual após isso: `X-Clinic-Slug` continua sendo enviado ao backend, só que montado automaticamente

**Impactos:**
- Novo endpoint público no backend: `GET /auth/resolve-slug?email=:email`
- `authRepository.findClinicByEmail()` já existe — basta expor a rota
- Tela de login: remover campo de slug, adicionar lógica de `onBlur` no campo e-mail para chamar o endpoint e armazenar o slug internamente
- Slug continua existindo no sistema — apenas deixa de ser digitado pelo usuário

---

## 2 — CNPJ opcional no cadastro, com validação nas Configurações

### 2a — No cadastro de empresa (tela de registro)

**Decisão atualizada (issue #54 — implementado em 2026-03-20):**
O campo CNPJ foi **removido completamente** do formulário `/register`. O CNPJ deve ser informado apenas na tela de Configurações, após o primeiro acesso. Isso elimina uma barreira desnecessária no onboarding.

**Estado atual (pós-implementação):**
- Campo `clinicDocument` **não existe mais** no formulário de cadastro (`register/page.tsx`)
- `RegisterClinicDto` no backend permanece com o campo como opcional (`optionalCnpjSchema`) — aceita `undefined` sem erro
- No Prisma: `document String?` na tabela `clinics` — sem constraint `@unique` (sem alteração)
- `applyCnpjMask`, `handleCnpjChange` e toda lógica relacionada foram removidos do frontend

**Fora do escopo (não fazer no cadastro):**
- Não validar CNPJ no cadastro (campo não existe mais)
- Não adicionar constraint `@unique` no cadastro

### 2b — Nas Configurações da empresa (após login)

**Mudança desejada:**
- Na tela de Configurações, aba ou seção "Dados da Empresa", adicionar campo CNPJ editável
- Ao salvar o CNPJ nas configurações:
  - Validar formato (`XX.XXX.XXX/XXXX-XX` ou 14 dígitos)
  - Validar dígito verificador matematicamente **apenas em produção** (`appConfig.isProduction === true`)
  - Em dev/homologação, aceitar qualquer string no formato sem validar dígitos verificadores
  - Verificar unicidade: se o CNPJ já estiver cadastrado em outra empresa → retornar `409 Conflict` com mensagem orientando a entrar em contato com o suporte (usar `companyConfig.supportEmail` / `supportWhatsapp`)
  - Se `appConfig.isProduction === true`, consultar a BrasilAPI para confirmar existência do CNPJ (ver seção 3)
  - Adicionar constraint `@unique` no campo `document` da tabela `clinics` + migration — tratando `null` como permitido múltiplo (usar `@unique` com `map` ou garantir unicidade apenas sobre valores não nulos — verificar suporte do Prisma/PostgreSQL, que permite múltiplos `NULL` em colunas `UNIQUE`)

**Arquivo de configuração da empresa fornecedora:**
- Criar `aesthera/apps/api/src/config/company.config.ts`:
  ```ts
  export const companyConfig = {
    name: 'Aesthera',
    supportEmail: '', // a preencher
    supportPhone: '', // a preencher
    supportWhatsapp: '', // a preencher
    website: '', // a preencher
  }
  ```
- A mensagem de erro de CNPJ duplicado deve usar `companyConfig.supportEmail` / `supportWhatsapp` dinamicamente

---

## 3 — Integração com Receita Federal (BrasilAPI) — acionada nas Configurações

**API:** BrasilAPI — `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}` — pública, sem autenticação

### 3a — Validação de existência do CNPJ (ao salvar nas Configurações)
- Quando `appConfig.isProduction === true`, após validar o dígito verificador, fazer requisição à BrasilAPI
- CNPJ não encontrado na Receita Federal → `422` com mensagem "CNPJ não encontrado na Receita Federal"
- BrasilAPI indisponível → logar o erro e **não bloquear** o salvamento (fail open)

### 3b — Pré-preenchimento de dados (ao digitar CNPJ nas Configurações)
- Novo endpoint: `GET /clinics/lookup-cnpj?cnpj=:cnpj` (autenticado — requer `X-Clinic-Slug` e usuário logado)
- Chama a BrasilAPI e retorna campos relevantes:
  ```json
  {
    "razaoSocial": "...",
    "nomeFantasia": "...",
    "telefone": "...",
    "email": "...",
    "cep": "...",
    "logradouro": "...",
    "municipio": "...",
    "uf": "..."
  }
  ```
- Na tela de Configurações: ao sair do campo CNPJ (`onBlur`), chamar o endpoint e pré-preencher nome da clínica, telefone e endereço
- Usuário pode editar os dados pré-preenchidos antes de salvar

### Limitação conhecida — verificação de propriedade do CNPJ
A BrasilAPI retorna dados públicos mas **não confirma identidade** — não é possível garantir que quem informa o CNPJ é o dono via API pública da Receita Federal. Criar um `TODO` no código indicando essa limitação.

---

## 4 — Transferência de empresa por e-mail (apenas em produção)

> **Regra aplicável somente quando `appConfig.isProduction === true`.**
> Em dev/homologação, ignorar silenciosamente e prosseguir normalmente.

Esta regra se aplica em **dois cenários**:

### Cenário A — Cadastro de nova empresa com e-mail já existente

**Atualização (issue #55 — implementado em 2026-03-20): Confirmação prévia + distinção admin vs membro**

O antigo fluxo criava a clínica automaticamente e enviava o e-mail de transferência sem perguntar o usuário. O novo fluxo:

1. **Sem `confirmTransfer: true` no request** → retornar `409` com código específico antes de criar a clínica:
   - `EMAIL_CONFLICT_ADMIN` (quando o usuário é admin da outra clínica) + `data: { clinicName }`
   - `EMAIL_CONFLICT_MEMBER` (quando é staff) + `data: { clinicName }`
2. **O frontend exibe um `Dialog`** com conteúdo diferente conforme o tipo de conflito:
   - Admin: alerta grave sobre perda de acesso + opção "Recuperar acesso" (chama `POST /auth/recover-access`)
   - Membro: confirmação simples de transferência
3. **Re-submit com `confirmTransfer: true`** → criar a clínica + enviar e-mail de transferência
   - E-mail de admin tem aviso reforçado: "Ao confirmar, você será transferido… e perderá acesso à [Clínica X]"

**Novo endpoint:** `POST /auth/recover-access` — recebe `{ email }`, envia e-mail de redefinição de senha (token armazenado no Redis por 1 hora), retorna 200 sem expor existência de conta. Rota adicionada ao `PUBLIC_ROUTES`.

**Situação original (antes da issue #55):**
- Se o e-mail do administrador já estava cadastrado em outra empresa, o sistema criava a nova empresa e enviava o e-mail de transferência automaticamente

### Cenário B — Convite de usuário (Configurações > aba Usuários) com e-mail de outra empresa

**Situação atual:**
- Não há verificação de empresa de origem ao convidar usuário — apenas verifica se o e-mail já foi convidado na empresa atual

**Mudança desejada:**
- Ao convidar um usuário cujo e-mail **já pertence a outra empresa**:
  1. Registrar o convite normalmente
  2. Enviar um **e-mail de confirmação de transferência** ao endereço informado (em vez do e-mail de convite padrão)
  3. Aguardar confirmação

### Fluxo do e-mail de transferência

**Conteúdo obrigatório do e-mail:**
- Nome/identificação da **empresa de origem** (empresa atual do usuário)
- Nome/identificação da **empresa de destino** (nova empresa)
- Link de confirmação com token único (expiração: 48 horas)
- Link de rejeição (caso o usuário não queira transferir)

**Ao confirmar via link:**
- Associar o usuário à empresa de destino com o papel correspondente (admin no Cenário A, papel do convite no Cenário B)
- **Não remover** o usuário da empresa de origem
- Marcar o usuário como **inativo** na empresa de origem (`status: 'inactive'` ou equivalente no modelo `ClinicUser`)
- Preservar todo o histórico do usuário na empresa de origem (registros, agendamentos etc.)
- O usuário inativo poderá ser **reativado** futuramente por um admin da empresa de origem, sem perder histórico

**Ao rejeitar via link (ou link expirar):**
- Cancelar a transferência
- No Cenário A: a empresa criada permanece, mas sem usuário admin — notificar o suporte ou colocar a empresa em estado `pending_admin`
- No Cenário B: o convite é cancelado, usuário permanece na empresa de origem

### Backend — implementação

- Criar tabela `transfer_tokens` (ou `pending_transfers`) com:
  - `id`, `token` (UUID único), `email`, `sourceClinicId`, `targetClinicId`, `role`, `expiresAt`, `status` (`pending` | `confirmed` | `rejected` | `expired`), `createdAt`
- Novo endpoint público: `POST /auth/confirm-transfer?token=:token` — processa a confirmação
- Novo endpoint público: `POST /auth/reject-transfer?token=:token` — processa a rejeição
- Job opcional de expiração de tokens (ou lazy expiration ao consultar)
- Serviço de e-mail: novo template `email-transfer-confirmation` com os dados acima

### Frontend

- Nenhuma tela adicional obrigatória no MVP desta feature
- A confirmação/rejeição ocorre via link do e-mail (página pública simples de confirmação — pode ser uma rota em `app/(auth)/transfer/confirm/page.tsx`)
- Exibir mensagem de sucesso ou erro após o clique no link

---

## Contexto técnico — arquivos a ler

| Arquivo | O que interessa |
|---|---|
| `aesthera/apps/api/src/modules/auth/auth.service.ts` | `registerClinic()`, `login()`, `inviteUser()` |
| `aesthera/apps/api/src/modules/auth/auth.dto.ts` | `RegisterClinicDto`, `LoginDto`, `InviteUserDto` |
| `aesthera/apps/api/src/modules/auth/auth.repository.ts` | `findClinicByEmail()`, `createClinicWithAdmin()` |
| `aesthera/apps/api/src/modules/auth/auth.routes.ts` | rotas públicas |
| `aesthera/apps/api/prisma/schema.prisma` | model `Clinic` — campo `document String?`; model `ClinicUser` — campo `status` |
| `aesthera/apps/web/app/(auth)/register/page.tsx` | formulário de cadastro |
| `aesthera/apps/web/app/(auth)/login/page.tsx` | formulário de login |
| `aesthera/apps/api/src/config/app.config.ts` | `appConfig.isProduction` |
| `aesthera/apps/api/src/modules/clinics/` | service e rotas da clínica (configurações) |
| `aesthera/apps/web/app/(dashboard)/settings/` | tela de configurações |

---

---

## 5 — Colisão de slug com vínculo existente (issue #56)

### Contexto

Quando um usuário tenta cadastrar uma empresa cujo nome gera um slug já existente no sistema, o `uniqueSlug()` atual simplesmente incrementa o sufixo (`clinica-estetica` → `clinica-estetica-1`) silenciosamente. Há dois cenários que esse comportamento não cobre corretamente:

- **Cenário A**: O usuário tem vínculo ativo com aquela clínica (mesmo slug + mesmo e-mail) → deve bloquear com `SLUG_LINKED_SAME_CLINIC` e oferecer recuperação de senha.
- **Cenário B**: O slug colide com uma clínica diferente (e-mail não vinculado a ela) → `uniqueSlug()` gera slug alternativo normalmente.

### Ordem de verificações em `registerClinic()`

1. Verificar conflito de e-mail → emite `EMAIL_CONFLICT_ADMIN` ou `EMAIL_CONFLICT_MEMBER` (issue #55)
2. Verificar colisão de slug com vínculo na mesma clínica → emite `SLUG_LINKED_SAME_CLINIC` (issue #56)
3. Gerar slug único com `uniqueSlug()` e prosseguir

### Backend — `auth.service.ts`

Em qualquer branch que alcança `uniqueSlug()`, adicionar antes:

```typescript
const baseSlug = slugify(dto.clinicName)
const existingClinicForSlug = await authRepository.findClinicBySlug(baseSlug)
if (existingClinicForSlug && sourceMembership?.clinicId === existingClinicForSlug.id) {
  throw new AppError(
    `Você já possui vínculo com a empresa "${existingClinicForSlug.name}", que tem o mesmo identificador que você está tentando cadastrar.`,
    409,
    'SLUG_LINKED_SAME_CLINIC',
    { clinicName: existingClinicForSlug.name },
  )
}
const slug = await this.uniqueSlug(baseSlug)
```

### Backend — `auth.repository.ts`

Adicionar `name: true` ao select de `findClinicBySlug()`:

```typescript
findClinicBySlug(slug: string) {
  return prisma.clinic.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, emailVerified: true },
  })
}
```

### Frontend — `register/page.tsx`

No `catch` do `onSubmit`, tratar `409` com código `SLUG_LINKED_SAME_CLINIC`:
- Exibir diálogo com: "Você já possui vínculo com a empresa [X], que tem o mesmo identificador que você está tentando cadastrar. Deseja recuperar o acesso à sua conta?"
- Opção **"Recuperar acesso"** → chama `POST /auth/recover-access`, fecha diálogo, exibe toast de confirmação
- Opção **"Cancelar"** → fecha diálogo
- Não oferecer "continuar cadastrando"

---

## Ordem de implementação sugerida

1. `company.config.ts` (sem dependências)
2. Endpoint `GET /auth/resolve-slug` + refatoração da tela de login (remover campo slug)
3. Campo CNPJ opcional no cadastro (apenas máscara, sem validação pesada)
4. CNPJ nas Configurações: endpoint de salvamento com validação completa + constraint `@unique` (null-safe) + migration
5. Endpoint `GET /clinics/lookup-cnpj` (BrasilAPI) + pré-preenchimento nas Configurações
6. Tabela `transfer_tokens` + migration
7. Fluxo de transferência no cadastro de empresa (`registerClinic()`)
8. Fluxo de transferência no convite de usuário (`inviteUser()`)
9. Endpoints públicos `confirm-transfer` e `reject-transfer`
10. Página frontend `app/(auth)/transfer/confirm/page.tsx`
11. Template de e-mail de transferência
12. Colisão de slug com vínculo existente (`SLUG_LINKED_SAME_CLINIC`) — issue #56
