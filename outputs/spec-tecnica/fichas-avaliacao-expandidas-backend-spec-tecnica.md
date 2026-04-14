# Spec Técnica — [FICHAS DE AVALIAÇÃO EXPANDIDAS] 1/3 — Backend (#157)

**Issue:** #157
**Data:** 2026-04-14
**Módulo(s):** `measurement-sheets`, `measurement-sessions`
**Tipo:** Backend

---

## 1. Contexto

O módulo `measurement-sheets` serve medidas corporais via fichas `SIMPLE` e `TABULAR`, com todos os registros tendo implicitamente `category=CORPORAL` e `scope=SYSTEM`. Esta issue expande o modelo para suportar 6 categorias de avaliação (corporal, facial, dermato-funcional, nutricional, postural, personalizada), fichas personalizadas por cliente (`scope=CUSTOMER`), uma biblioteca de 6 templates pré-configurados com endpoints para consulta e cópia, e o campo computado `categories` na response das sessões de medição.

A migration é estritamente não-destrutiva: todos os campos novos têm `@default`, preservando registros existentes.

---

## 2. Escopo da Implementação

### 2.1 Backend

**Arquivos a CRIAR:**
```
aesthera/apps/api/src/modules/measurement-sheets/measurement-templates.ts
  — Arquivo com os 6 templates pré-configurados (constante tipada, sem lógica)

aesthera/apps/api/prisma/migrations/{timestamp}_add-measurement-category-scope/
  — Migration gerada por `prisma migrate dev`
```

**Arquivos a MODIFICAR:**
```
aesthera/apps/api/prisma/schema.prisma
  — Adicionar enums MeasurementCategory e MeasurementScope; campos category, scope, customerId, createdByUserId ao model MeasurementSheet; 2 novos índices; 2 relações (customer, createdBy)

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.dto.ts
  — Adicionar fields category/scope/customerId/createdByUserId ao CreateDto; category ao UpdateDto; category/scope/customerId ao ResponseDto; refine de scope=CUSTOMER→customerId obrigatório; filtros scope/category ao ListQuery

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.service.ts
  — create(): armazenar createdByUserId, verificar agendamento quando role=professional e scope=CUSTOMER
  — update(): lógica de autorização por scope
  — findAll(): filtros scope/category

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.routes.ts
  — Registrar GET /measurement-sheets/templates e POST /measurement-sheets/templates/:id/copy ANTES de /:id

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.repository.ts
  — Adicionar suporte aos filtros scope/category no findAll

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.test.ts
  — 12 novos casos de teste (listados na Seção 8)

aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.service.ts
  — Incluir campo computado `categories` na response de listagem de sessões
```

**Nenhuma alteração necessária em:**
```
MeasurementSession (schema)
MeasurementSheetRecord (schema)
MeasurementValue (schema)
MeasurementTabularValue (schema)
Módulos: billing, appointments, anamnese, contracts
```

### 2.2 Banco de Dados

**Migração necessária:** Sim

```prisma
-- Novos enums
enum MeasurementCategory {
  CORPORAL
  FACIAL
  DERMATO_FUNCIONAL
  NUTRICIONAL
  POSTURAL
  PERSONALIZADA
}

enum MeasurementScope {
  SYSTEM
  CUSTOMER
}

-- Campos adicionados ao model MeasurementSheet (todos com default ou nullable)
category          MeasurementCategory @default(CORPORAL) @map("category")
scope             MeasurementScope    @default(SYSTEM)   @map("scope")
customerId        String?             @map("customer_id")
createdByUserId   String?             @map("created_by_user_id")

-- Relações
customer    Customer?  @relation(fields: [customerId],      references: [id], onDelete: Restrict)
createdBy   User?      @relation(fields: [createdByUserId], references: [id])

-- Novos índices
@@index([clinicId, scope, active])
@@index([clinicId, customerId])
```

> Registros existentes recebem `category=CORPORAL` e `scope=SYSTEM` pelos defaults — migration não-destrutiva.

---

## 3. Contratos de API

### 3.1 GET /measurement-sheets/templates

```
GET /measurement-sheets/templates

Auth: Obrigatório (JwtClinicGuard)
Role: qualquer role autenticada
Guard de tenant: Sim (clinicId do JWT, mas templates são globais — sem filtro de clinic no retorno)

Request Body: N/A

Query Params (opcionais):
  category: MeasurementCategory

Response (200):
[
  {
    id: string          // ex: "tpl-perimetria"
    name: string
    category: MeasurementCategory
    type: MeasurementSheetType  // SIMPLE | TABULAR
    fields?: string[]           // presente quando type=SIMPLE
    rows?: string[]             // presente quando type=TABULAR
    columns?: string[]          // presente quando type=TABULAR
  }
]

Response (erros):
  401 — Token inválido/ausente
```

### 3.2 POST /measurement-sheets/templates/:id/copy

```
POST /measurement-sheets/templates/:id/copy

Auth: Obrigatório (JwtClinicGuard + RoleGuard('admin'))
Role: admin
Guard de tenant: Sim (clinicId sempre extraído do JWT)

Params:
  id: string  // id do template em MEASUREMENT_TEMPLATES

Request Body: (vazio — tudo vem do JWT e do template)

Response (201):
{
  id: string
  clinicId: string
  name: string         // nome do template; sufixo " 2", " 3"... se duplicado
  category: MeasurementCategory
  scope: "SYSTEM"
  type: MeasurementSheetType
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
  fields?: { id, name, unit, order }[]
  columns?: { id, name, order }[]
}

Response (erros):
  401 — Token inválido/ausente
  403 — Role insuficiente (não-admin)
  404 — Template com o id informado não existe em MEASUREMENT_TEMPLATES
```

### 3.3 GET /measurement-sheets *(modificado)*

```
GET /measurement-sheets

Auth: Obrigatório (JwtClinicGuard)
Role: qualquer role autenticada
Guard de tenant: Sim (clinicId sempre do JWT)

Query Params (opcionais — todos já existentes + novos):
  scope: MeasurementScope      // NOVO
  category: MeasurementCategory  // NOVO
  active: boolean

Response (200):
[
  {
    id, clinicId, name, type, active, order,
    category: MeasurementCategory,   // NOVO
    scope: MeasurementScope,          // NOVO
    customerId: string | null,        // NOVO
    createdAt, updatedAt
  }
]
```

### 3.4 POST /measurement-sheets *(modificado)*

```
POST /measurement-sheets

Auth: Obrigatório (JwtClinicGuard)
Role: admin para scope=SYSTEM; professional com agendamento confirmado para scope=CUSTOMER
Guard de tenant: Sim

Request Body:
{
  name: string (required)
  type: "SIMPLE" | "TABULAR" (required)
  order: number (required)
  category?: MeasurementCategory  // default: CORPORAL
  scope?: MeasurementScope         // default: SYSTEM
  customerId?: string (uuid)       // obrigatório quando scope=CUSTOMER
}

Response (201):
{ ...MeasurementSheetResponseDto, category, scope, customerId }

Response (erros):
  400 — scope=CUSTOMER sem customerId
  403 — professional sem agendamento confirmado com o customerId
  403 — role staff tentando criar scope=SYSTEM (se aplicável conforme regras de negócio)
```

### 3.5 PATCH /measurement-sheets/:id *(modificado)*

```
PATCH /measurement-sheets/:id

Auth: Obrigatório (JwtClinicGuard)
Role: verificado no service por scope da ficha

Request Body:
{
  name?: string
  order?: number
  active?: boolean
  category?: MeasurementCategory  // NOVO campo mutável
  // campo "type" NÃO deve existir no DTO — qualquer envio de "type" deve resultar em 400
}

Response (200): { ...MeasurementSheetResponseDto }

Response (erros):
  400 — campo "type" enviado no body
  403 — scope=SYSTEM e role != admin
  403 — scope=CUSTOMER e usuário não é o criador nem admin
  404 — ficha não encontrada
```

### 3.6 GET /measurement-sessions *(campo adicionado na response)*

```
O endpoint existente de listagem de sessões passa a incluir:

{
  ...(campos existentes),
  categories: MeasurementCategory[]  // derivado das fichas vinculadas aos records da sessão
}

Nenhuma alteração de rota/método/auth — apenas campo novo no response.
```

---

## 4. Fluxo de Dados

### Cópia de template (POST /measurement-sheets/templates/:id/copy)

```
Admin clica "Usar template" na interface
→ POST /measurement-sheets/templates/:id/copy
→ JwtClinicGuard extrai clinicId do JWT
→ RoleGuard valida role=admin
→ Service localiza template em MEASUREMENT_TEMPLATES pelo :id
→ Verifica se já existe sheet com mesmo nome na clinicId (@@unique([clinicId, name]))
  → Se duplicado: calcula próximo sufixo numérico disponível
→ prisma.$transaction():
    → measurementSheet.create(category, scope=SYSTEM, clinicId, name, type)
    → measurementField.createMany(fields) ou measurementColumn.createMany(columns)
→ Retorna MeasurementSheetResponseDto (201)
```

### Criação de ficha personalizada por profissional (POST /measurement-sheets, scope=CUSTOMER)

```
Profissional envia POST com scope=CUSTOMER e customerId
→ JwtClinicGuard extrai clinicId e userId do JWT
→ Service.create():
    → Valida customerId presente
    → appointmentsRepository.existsConfirmed({ clinicId, professionalId: userId, customerId })
    → Se false → ForbiddenException
    → measurementSheet.create({ ..., scope=CUSTOMER, customerId, createdByUserId: userId })
→ 201
```

### Field categories em sessões

```
GET /measurement-sessions
→ Service busca sessões com include dos SheetRecords e respectivos MeasurementSheets
→ Para cada sessão, extrai sheets vinculados → coleta .category de cada
→ Deduplica com [...new Set()] → campo categories: MeasurementCategory[]
→ Retorna na response (campo computado em memória, sem alteração de schema)
```

---

## 5. Regras de Negócio

- `scope=CUSTOMER` sem `customerId` → **400** (validado no DTO via `.refine()`)
- Profissional só pode criar ficha `scope=CUSTOMER` se tiver ao menos um agendamento com status `confirmed | in_progress | completed` para aquele cliente na clínica
- `scope=SYSTEM`: somente `admin` pode criar ou editar
- `scope=CUSTOMER`: criador (`createdByUserId === userId`) **ou** admin pode editar; qualquer outro role → **403**
- O campo `type` de uma ficha é imutável após criação — não deve existir no `UpdateMeasurementSheetDto`; envio de `type` no PATCH → **400**
- Cópia de template sempre cria com `scope=SYSTEM` e `clinicId` do JWT (nunca do body)
- Nome duplicado ao copiar template: incrementar sufixo numérico (buscar o maior suffix existente para aquele clinicId/nome base)
- `clinicId` é **sempre** extraído do JWT — nunca aceito via body ou query em nenhum endpoint
- Templates são entidade estática (arquivo `.ts`), não persistidas em banco

---

## 6. Modelo de Dados — Alterações

### Enums novos

| Enum | Valores |
|------|---------|
| `MeasurementCategory` | `CORPORAL`, `FACIAL`, `DERMATO_FUNCIONAL`, `NUTRICIONAL`, `POSTURAL`, `PERSONALIZADA` |
| `MeasurementScope` | `SYSTEM`, `CUSTOMER` |

### Campos adicionados a `MeasurementSheet`

| Campo | Tipo | Nullable | Default | Observação |
|-------|------|----------|---------|------------|
| `category` | `MeasurementCategory` | Não | `CORPORAL` | |
| `scope` | `MeasurementScope` | Não | `SYSTEM` | |
| `customerId` | `String` | Sim | `null` | FK → `Customer.id`, `onDelete: Restrict` |
| `createdByUserId` | `String` | Sim | `null` | FK → `User.id` |

### Índices adicionados

| Índice | Campos |
|--------|--------|
| Existente preservado | `[clinicId, active, order]` |
| Novo | `[clinicId, scope, active]` |
| Novo | `[clinicId, customerId]` |

---

## 7. Templates Pré-configurados

| id | name | category | type |
|----|------|----------|------|
| `tpl-perimetria` | Perimetria | CORPORAL | SIMPLE |
| `tpl-bioimpedancia` | Bioimpedância | CORPORAL | SIMPLE |
| `tpl-condicao-estetica` | Condição Estética | DERMATO_FUNCIONAL | TABULAR |
| `tpl-firmeza-tissular` | Firmeza Tissular | DERMATO_FUNCIONAL | TABULAR |
| `tpl-avaliacao-facial` | Avaliação Facial | FACIAL | SIMPLE |
| `tpl-postural` | Avaliação Postural | POSTURAL | SIMPLE |

Arquivo: `src/modules/measurement-sheets/measurement-templates.ts`
- Exportar `MEASUREMENT_TEMPLATES` como `const` array tipado
- Cada item contém: `id`, `name`, `category`, `type`, e `fields[]` (SIMPLE) ou `rows[]` + `columns[]` (TABULAR)
- Sem lógica de negócio — apenas dado estruturado

---

## 8. Dependências e Riscos

**Dependências:**
- `appointmentsRepository.existsConfirmed()` — verificar se o método já existe no repositório de agendamentos; se não existir, criar antes ou dentro desta issue
- Relação `Customer` e `User` já devem existir no schema Prisma com os models correspondentes
- O enum `MeasurementSheetType` já existe no schema — reutilizar

**Riscos identificados:**

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `appointmentsRepository.existsConfirmed()` inexistente | Bloqueante para criar fichas CUSTOMER por profissional | Verificar antes de implementar; criar se necessário |
| Conflict em `@@unique([clinicId, name])` ao copiar template | 409 indesejado | Lógica de sufixo numérico obrigatória no service |
| `onDelete: Restrict` em `customerId` | Impede deletar cliente com fichas vinculadas | Comportamento correto — documentar para o time de produto; futura issue pode adicionar soft-delete ou cascade |
| Registrar rotas `/templates` após `/:id` no Fastify | Rota estática seria capturada como parâmetro dinâmico | Garantir ordem: estáticas ANTES de `/:id` |
| `categories` computado em memória | N+1 se sessões não incluírem sheets via join | Garantir `include` no Prisma query de sessões |

---

## 9. Definition of Done — Checklist

### Schema & Migration
- [ ] Enums `MeasurementCategory` e `MeasurementScope` adicionados ao `schema.prisma`
- [ ] Campos `category`, `scope`, `customerId`, `createdByUserId` adicionados ao model `MeasurementSheet`
- [ ] Relações `customer` e `createdBy` adicionadas ao model
- [ ] Novos índices `[clinicId, scope, active]` e `[clinicId, customerId]` adicionados
- [ ] Migration gerada com `prisma migrate dev --name add-measurement-category-scope`
- [ ] Migration validada como não-destrutiva (dados existentes preservados)

### DTOs
- [ ] `CreateMeasurementSheetDto` aceita `category`, `scope`, `customerId`, `createdByUserId`
- [ ] `.refine()` valida `scope=CUSTOMER → customerId obrigatório` com mensagem em PT-BR
- [ ] `UpdateMeasurementSheetDto` aceita `category`; campo `type` **ausente** do schema Zod
- [ ] `MeasurementSheetResponseDto` inclui `category`, `scope`, `customerId`
- [ ] `ListSheetsQuery` aceita filtros `scope` e `category`

### Service
- [ ] `create()` armazena `createdByUserId`
- [ ] `create()` com `scope=CUSTOMER`: valida `customerId` presente
- [ ] `create()` com `role=professional` e `scope=CUSTOMER`: chama `existsConfirmed()` e lança `ForbiddenException` se false
- [ ] `update()` com `scope=SYSTEM`: exige `role=admin`
- [ ] `update()` com `scope=CUSTOMER`: permite criador ou admin; rejeita outros com `ForbiddenException`
- [ ] `findAll()` aplica filtros `scope` e `category` quando presentes
- [ ] `copyTemplate()` implementado: localiza template, trata nome duplicado, cria via `$transaction()`

### Routes
- [ ] `GET /measurement-sheets/templates` registrada com `JwtClinicGuard`
- [ ] `POST /measurement-sheets/templates/:id/copy` registrada com `JwtClinicGuard` + `RoleGuard('admin')`
- [ ] Ambas as rotas estáticas registradas **antes** de `/:id`

### Templates
- [ ] Arquivo `measurement-templates.ts` criado com os 6 templates
- [ ] Exportado como `const` com tipagem correta
- [ ] Nenhuma lógica de negócio no arquivo

### Sessões
- [ ] `measurement-sessions.service.ts` retorna campo `categories: MeasurementCategory[]` na listagem
- [ ] Campo computado via `include` dos sheets — sem N+1

### Testes
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` sem `customerId` → 400
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` por profissional sem agendamento → 403
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` por profissional com agendamento `confirmed` → 201
- [ ] `PATCH /measurement-sheets/:id` com `scope=SYSTEM` por não-admin → 403
- [ ] `PATCH /measurement-sheets/:id` com `scope=CUSTOMER` pelo criador → 200
- [ ] `PATCH /measurement-sheets/:id` com `scope=CUSTOMER` por outro usuário não-admin → 403
- [ ] `PATCH /measurement-sheets/:id` enviando campo `type` → 400
- [ ] `GET /measurement-sheets?scope=CUSTOMER&clinicId=outra` → filtra por clinicId do JWT (retorna vazio)
- [ ] `POST /measurement-sheets/templates/:id/copy` por não-admin → 403
- [ ] `POST /measurement-sheets/templates/:id/copy` por admin → 201 com `clinicId` do JWT
- [ ] Copiar mesmo template duas vezes → segundo registro com sufixo numérico no nome
- [ ] Migration não-destrutiva: fichas existentes preservam dados e recebem defaults corretos

### Geral
- [ ] Sem `console.log` / código de debug
- [ ] Sem `TODO` não resolvido
- [ ] `PLAN.md` atualizado após merge

---

## 10. Notas para o Implementador

1. **Ordem de rotas no Fastify é crítica.** `/templates` e `/templates/:id/copy` devem ser registradas antes de `/:id`. Revisar `measurement-sheets.routes.ts` com atenção.

2. **`type` imutável:** O campo `type` (SIMPLE/TABULAR) não pode ser alterado após criação. Simplesmente não incluir no schema Zod do `UpdateMeasurementSheetDto` — qualquer chave `type` enviada deve ser ignorada (se o framework strip) ou deve gerar 400 (se o schema rejeitar propriedades extras com `.strict()`). Decidir qual comportamento seguir conforme padrão existente no projeto.

3. **`appointmentsRepository.existsConfirmed()`:** Verificar se este método já existe antes de começar. Buscar em `appointments.repository.ts`. Se não existir, implementar como `findFirst` com `statusIn` como filtro ou via `count > 0`.

4. **Sufixo de nome duplicado:** A lógica deve buscar no banco todos os nomes que começam com o nome base do template para aquela clínica (`LIKE 'Perimetria%'`) e calcular o próximo índice. Não assumir que basta adicionar " 2".

5. **`categories` em sessões:** Usar `include` encadeado no Prisma até chegar em `MeasurementSheet.category`. Garantir que não há múltiplos queries extras (N+1). Deduplicar com `[...new Set(categories)]`.

6. **Enum casing:** Usar `UPPER_CASE` (`SYSTEM`, `CUSTOMER`, `CORPORAL`, etc.) — convenção do schema. Nunca usar minúsculas nos valores do enum.

7. **`clinicId` exclusivamente do JWT:** Em nenhum endpoint desta issue o `clinicId` deve ser aceito como parâmetro de rota, query ou body.
