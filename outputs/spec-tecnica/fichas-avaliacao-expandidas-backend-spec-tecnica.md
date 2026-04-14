# Spec Técnica — [FICHAS DE AVALIAÇÃO EXPANDIDAS] 1/3 — Backend (#157)

**Issue:** #157
**Data:** 14/04/2026
**Módulo(s):** `measurement-sheets`, `measurement-sessions`, `appointments`
**Tipo:** Backend

---

## 1. Contexto

O módulo `measurement-sheets` existe e serve exclusivamente medidas corporais (implicitamente `category=CORPORAL`, `scope=SYSTEM`). A issue expande o modelo de dados para suportar **6 categorias de avaliação**, **fichas personalizadas por cliente** (`scope=CUSTOMER`) e uma **biblioteca de templates pré-configurados**. O objetivo desta issue é entregar a camada de dados, DTO, service, repository e endpoints necessários para que as issues 2/3 (frontend de configurações) e 3/3 (frontend de perfil do cliente) possam ser implementadas.

---

## 2. Escopo da Implementação

### 2.1 Backend

**Arquivos a CRIAR:**
```
aesthera/apps/api/src/modules/measurement-sheets/measurement-templates.ts
  → Array MEASUREMENT_TEMPLATES com os 6 templates pré-definidos (constante pura, sem DB)

aesthera/apps/api/prisma/migrations/{timestamp}_add-measurement-category-scope/migration.sql
  → Migration não-destrutiva gerada por `prisma migrate dev`
```

**Arquivos a MODIFICAR:**
```
aesthera/apps/api/prisma/schema.prisma
  → Adicionar enums MeasurementCategory e MeasurementScope
  → Adicionar campos category, scope, customerId, createdByUserId ao model MeasurementSheet
  → Substituir @@unique([clinicId, name]) por partial unique index via SQL raw
  → Adicionar @@index([clinicId, scope, active]) e @@index([clinicId, customerId])
  → Adicionar relações customer e createdBy ao MeasurementSheet
  → Adicionar measurementSheets ao model Customer (relação inversa)
  → Adicionar measurementSheets ao model User (relação inversa)

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.dto.ts
  → CreateSheetDto: adicionar category, scope, customerId, createdByUserId + .refine()
  → UpdateSheetDto: adicionar category; confirmar ausência de type
  → ListSheetsQuery: adicionar scope e category como filtros opcionais

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.service.ts
  → createSheet(): receber authenticatedUserId e userRole; lógica de autorização por scope
  → updateSheet(): autorização granular por scope/createdByUserId
  → listSheets(): aplicar filtros scope e category
  → Adicionar createSheetFromTemplate()

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.repository.ts
  → listSheets(): suportar filtros scope e category
  → createSheet(): persistir category, scope, customerId, createdByUserId
  → updateSheet(): persistir category
  → findSheetByName(): escopo-aware (scope + clinicId + customerId para unicidade)
  → countActiveSheets(): diferenciar SYSTEM vs CUSTOMER (por customerId)
  → Adicionar hasConfirmedAppointment() para verificação de vínculo profissional-cliente
  → Adicionar countActiveCustomerSheets()

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.routes.ts
  → POST /measurement-sheets: remover roleGuard(['admin']) — autorização migra para o service
  → PATCH /measurement-sheets/:id: remover roleGuard(['admin']) — autorização migra para o service
  → Adicionar GET /measurement-sheets/templates (antes de /:id)
  → Adicionar POST /measurement-sheets/templates/:templateId/copy (antes de /:id)

aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.repository.ts
  → SESSION_INCLUDE: adicionar category ao select de sheet

aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.service.ts
  → listSessions(): mapear categories: MeasurementCategory[] por sessão na response

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.test.ts
  → Adicionar casos de teste para os novos comportamentos (ver seção 8)
```

**Nenhuma alteração necessária em:**
```
aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.dto.ts
aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.routes.ts
aesthera/apps/api/prisma/schema.prisma (models MeasurementSession, MeasurementSheetRecord, MeasurementValue, MeasurementTabularValue)
Módulos: appointments, billing, anamnese, contratos, customers (lógica), frontend
```

### 2.2 Banco de Dados

**Migração necessária:** Sim — não-destrutiva

```sql
-- Novos enums
CREATE TYPE "MeasurementCategory" AS ENUM (
  'CORPORAL', 'FACIAL', 'DERMATO_FUNCIONAL', 'NUTRICIONAL', 'POSTURAL', 'PERSONALIZADA'
);
CREATE TYPE "MeasurementScope" AS ENUM ('SYSTEM', 'CUSTOMER');

-- Novos campos em measurement_sheets
ALTER TABLE "measurement_sheets"
  ADD COLUMN "category"             "MeasurementCategory" NOT NULL DEFAULT 'CORPORAL',
  ADD COLUMN "scope"                "MeasurementScope"    NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "customer_id"          UUID REFERENCES "customers"("id") ON DELETE RESTRICT,
  ADD COLUMN "created_by_user_id"   TEXT;  -- sem FK física (ver nota 9.7)

-- Remover constraint única existente (clinicId + name)
DROP INDEX IF EXISTS "measurement_sheets_clinic_id_name_key";

-- Partial unique index para SYSTEM (substitui a constraint anterior)
CREATE UNIQUE INDEX "measurement_sheets_system_name_unique"
  ON "measurement_sheets"("clinic_id", "name")
  WHERE "scope" = 'SYSTEM';

-- Partial unique index para CUSTOMER (unicidade por cliente)
CREATE UNIQUE INDEX "measurement_sheets_customer_name_unique"
  ON "measurement_sheets"("clinic_id", "customer_id", "name")
  WHERE "scope" = 'CUSTOMER';

-- Novos índices de performance
CREATE INDEX "measurement_sheets_clinic_scope_active_idx"
  ON "measurement_sheets"("clinic_id", "scope", "active");

CREATE INDEX "measurement_sheets_clinic_customer_idx"
  ON "measurement_sheets"("clinic_id", "customer_id");
```

> ⚠️ **Atenção:** Os partial unique indexes não são suportados nativamente no `@@unique` do Prisma. A migration deve ser gerada via `prisma migrate dev` e depois **editada manualmente** para substituir o `@@unique([clinicId, name])` gerado pelo Prisma pelos dois partial unique indexes descritos acima. O campo `@@unique([clinicId, name])` deve ser removido do schema.prisma e documentado como gerenciado via SQL raw.

> ✅ **Todos os `MeasurementSheet` existentes** recebem automaticamente `category='CORPORAL'` e `scope='SYSTEM'` pelos defaults da coluna — migration é não-destrutiva.

---

## 3. Contratos de API

### 3.1 GET /measurement-sheets

**Modificação:** adicionar filtros `scope` e `category` ao query existente.

```
GET /measurement-sheets?scope=SYSTEM&category=CORPORAL&includeInactive=false

Auth: JwtClinicGuard (admin | staff | professional)
Guard de tenant: Sim — clinicId do JWT, nunca do body
```

**Request Query:**
```typescript
{
  includeInactive?: boolean         // padrão: false (comportamento existente mantido)
  scope?: 'SYSTEM' | 'CUSTOMER'    // opcional; sem filtro = retorna todos os scopes
  category?: 'CORPORAL' | 'FACIAL' | 'DERMATO_FUNCIONAL' | 'NUTRICIONAL' | 'POSTURAL' | 'PERSONALIZADA'
  customerId?: string (uuid)        // obrigatório quando scope=CUSTOMER no query
}
```

**Response 200 — item (campos adicionados):**
```typescript
{
  id: string
  clinicId: string
  name: string
  type: 'SIMPLE' | 'TABULAR'
  category: MeasurementCategory   // NOVO
  scope: MeasurementScope         // NOVO
  customerId: string | null       // NOVO
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
  fields: MeasurementField[]
  columns: MeasurementSheetColumn[]
}
```

---

### 3.2 POST /measurement-sheets

**Modificação:** autorização por scope migra do route guard para o service; route guard mantém apenas `jwtClinicGuard`.

```
POST /measurement-sheets

Auth: JwtClinicGuard (admin | staff | professional)
Guard de tenant: Sim — clinicId do JWT
```

**Request Body:**
```typescript
{
  name: string            // min 1, max 100
  type?: 'SIMPLE' | 'TABULAR'  // default: 'SIMPLE'
  category?: 'CORPORAL' | 'FACIAL' | 'DERMATO_FUNCIONAL' | 'NUTRICIONAL' | 'POSTURAL' | 'PERSONALIZADA'
             // default: 'CORPORAL'
  scope?: 'SYSTEM' | 'CUSTOMER'  // default: 'SYSTEM'
  customerId?: string (uuid)     // obrigatório quando scope=CUSTOMER
  order?: number
}

Validação Zod (.refine):
  scope === 'CUSTOMER' → customerId NOT NULL
  Mensagem: "customerId é obrigatório para fichas com scope=CUSTOMER"
```

**Response 201:** shape idêntica ao item do GET (com novos campos)

**Respostas de erro:**
```
400 — scope=CUSTOMER sem customerId (Zod refine)
403 — scope=SYSTEM por staff ou professional
403 — scope=CUSTOMER por professional sem agendamento confirmado com o customerId
      Mensagem: "Você não tem agendamento confirmado com este cliente."
422 — MAX_SHEETS_REACHED: limite de 20 fichas ativas do sistema (scope=SYSTEM)
422 — MAX_CUSTOMER_SHEETS_REACHED: limite de 10 fichas personalizadas ativas (scope=CUSTOMER)
409 — Nome de ficha já existe para este scope/cliente
```

---

### 3.3 PATCH /measurement-sheets/:id

**Modificação:** autorização granular por scope migra do route guard para o service.

```
PATCH /measurement-sheets/:id

Auth: JwtClinicGuard (admin | staff | professional)
Guard de tenant: Sim — clinicId do JWT
```

**Request Body:**
```typescript
{
  name?: string      // min 1, max 100
  category?: 'CORPORAL' | 'FACIAL' | 'DERMATO_FUNCIONAL' | 'NUTRICIONAL' | 'POSTURAL' | 'PERSONALIZADA'
  order?: number
  active?: boolean

  // campo 'type' NUNCA aceito — ausente do schema Zod (Zod .strip() descarta se presente)
}
```

**Respostas de erro:**
```
403 — scope=SYSTEM por staff ou professional
403 — scope=CUSTOMER por usuário diferente do createdByUserId e não-admin
404 — Ficha não encontrada ou de outra clínica
422 — MAX_SHEETS_REACHED ao reativar (active: true) com limite já atingido
409 — Nome duplicado (scope-aware)
```

---

### 3.4 GET /measurement-sheets/templates ← NOVO

```
GET /measurement-sheets/templates

Auth: JwtClinicGuard (admin | staff | professional)
Guard de tenant: Sim (apenas auth — dados são constantes globais)

⚠️ Registrar ANTES de /:id no router Fastify
```

**Response 200:**
```typescript
Array<{
  id: string                // ex: 'tpl-perimetria'
  name: string
  category: MeasurementCategory
  type: 'SIMPLE' | 'TABULAR'
  fieldsCount: number
  columnsCount: number
  fields: Array<{
    name: string
    unit?: string
    inputType: 'INPUT' | 'CHECK'
    isTextual?: boolean
  }>
  columns: Array<{           // vazio para SIMPLE
    name: string
    unit?: string
    inputType: 'INPUT' | 'CHECK'
  }>
}>
```

**Implementação:** retorna `MEASUREMENT_TEMPLATES` com `fieldsCount` e `columnsCount` computados no handler, sem chamar service ou repository.

---

### 3.5 POST /measurement-sheets/templates/:templateId/copy ← NOVO

```
POST /measurement-sheets/templates/:templateId/copy

Auth: JwtClinicGuard + RoleGuard(['admin'])
Guard de tenant: Sim — clinicId do JWT (NUNCA do body)

⚠️ Registrar ANTES de /:id no router Fastify
```

**Request:** sem body

**Lógica do service (`createSheetFromTemplate`):**
1. Localizar template por `templateId` em `MEASUREMENT_TEMPLATES`; retornar 404 se não encontrado
2. Verificar se já existe ficha SYSTEM com mesmo nome na clínica (case-insensitive)
3. Se conflito: gerar nome com sufixo numérico — `"Perimetria 2"`, `"Perimetria 3"`, etc. (iterar até nome livre; máx 99)
4. Verificar limite de 20 fichas ativas (scope=SYSTEM)
5. Criar ficha + campos + colunas via `prisma.$transaction()`
6. `createdByUserId = req.user.sub`

**Response 201:** shape da ficha criada

**Respostas de erro:**
```
403 — usuário não é admin (RoleGuard)
404 — templateId não encontrado em MEASUREMENT_TEMPLATES
422 — MAX_SHEETS_REACHED (limite de 20 fichas ativas do sistema)
```

---

## 4. Modelo de Dados

### 4.1 Novos Enums (schema.prisma)

```prisma
enum MeasurementCategory {
  CORPORAL
  FACIAL
  DERMATO_FUNCIONAL
  NUTRICIONAL
  POSTURAL
  PERSONALIZADA
}

enum MeasurementScope {
  SYSTEM    // visível para todos os clientes da clínica
  CUSTOMER  // visível somente para um cliente específico
}
```

> **Casing:** UPPER_CASE conforme convenção dos enums de domínio do schema (`WalletEntryType`, `FileCategory`, `MeasurementSheetType`, etc.).

### 4.2 Model MeasurementSheet Atualizado

```prisma
model MeasurementSheet {
  id              String               @id @default(uuid())
  clinicId        String               @map("clinic_id")
  name            String
  type            MeasurementSheetType @default(SIMPLE)
  category        MeasurementCategory  @default(CORPORAL)  @map("category")
  scope           MeasurementScope     @default(SYSTEM)    @map("scope")
  customerId      String?              @map("customer_id")
  createdByUserId String?              @map("created_by_user_id")
  active          Boolean              @default(true)
  order           Int                  @default(0)
  createdAt       DateTime             @default(now()) @map("created_at")
  updatedAt       DateTime             @updatedAt @map("updated_at")

  clinic       Clinic                   @relation(fields: [clinicId], references: [id])
  customer     Customer?                @relation(fields: [customerId], references: [id], onDelete: Restrict)
  fields       MeasurementField[]
  columns      MeasurementSheetColumn[]
  sheetRecords MeasurementSheetRecord[]

  // NOTA: @@unique([clinicId, name]) REMOVIDO
  // Substituído por dois partial unique indexes em SQL raw na migration:
  //   SYSTEM: UNIQUE(clinic_id, name) WHERE scope = 'SYSTEM'
  //   CUSTOMER: UNIQUE(clinic_id, customer_id, name) WHERE scope = 'CUSTOMER'

  @@index([clinicId, scope, active])
  @@index([clinicId, customerId])
  @@map("measurement_sheets")
}
```

> ⚠️ A relação `createdBy → User` foi **omitida** intencionalmente. Ver nota 9.7 sobre o conflito `userId vs professionalId`.

### 4.3 Relações Inversas Necessárias

**Em `Customer` (schema.prisma):**
```prisma
measurementSheets MeasurementSheet[]
```

### 4.4 Novas Constantes de Limite (measurement-sheets.dto.ts)

```typescript
export const MAX_ACTIVE_SHEETS = 20           // existente — manter
export const MAX_ACTIVE_CUSTOMER_SHEETS = 10  // NOVO
```

### 4.5 Resumo de Impacto no Banco

| Operação | Tipo | Impacto em dados existentes |
|----------|------|-----------------------------|
| ADD COLUMN category | NOT NULL DEFAULT 'CORPORAL' | Todas as fichas recebem CORPORAL ✅ |
| ADD COLUMN scope | NOT NULL DEFAULT 'SYSTEM' | Todas as fichas recebem SYSTEM ✅ |
| ADD COLUMN customer_id | NULL | Todas as fichas recebem NULL ✅ |
| ADD COLUMN created_by_user_id | NULL | Todas as fichas recebem NULL ✅ |
| DROP INDEX clinic_id_name_key | Remoção de constraint | Sem perda de dados ✅ |
| CREATE UNIQUE INDEX (partial SYSTEM) | Criação | Aplicado apenas para scope=SYSTEM ✅ |

---

## 5. Lógica de Autorização

### 5.1 Tabela de Decisão por Operação

| Operação | Admin | Staff | Professional |
|----------|-------|-------|-------------|
| `POST` scope=SYSTEM | ✅ | ❌ 403 | ❌ 403 |
| `POST` scope=CUSTOMER | ✅ | ✅ | ✅ **se agendamento confirmado** |
| `PATCH` scope=SYSTEM | ✅ | ❌ 403 | ❌ 403 |
| `PATCH` scope=CUSTOMER (própria ficha) | ✅ | ✅ se criador | ✅ se criador |
| `PATCH` scope=CUSTOMER (ficha alheia) | ✅ | ❌ 403 | ❌ 403 |
| `DELETE` (soft via active=false) | ✅ | ❌ 403 | ❌ 403 |
| `GET /templates` | ✅ | ✅ | ✅ |
| `POST /templates/:id/copy` | ✅ | ❌ 403 | ❌ 403 |

### 5.2 Fluxo de `createSheet()` no Service

```
1. scope === 'SYSTEM' && role !== 'admin'
   → throw ForbiddenError('Apenas administradores podem criar fichas do sistema.')

2. scope === 'CUSTOMER' && role === 'professional'
   → repo.hasConfirmedAppointment({ clinicId, professionalId: sub, customerId })
   → se false: throw ForbiddenError('Você não tem agendamento confirmado com este cliente.')

3. scope === 'SYSTEM'
   → repo.countActiveSheets(clinicId, 'SYSTEM') >= MAX_ACTIVE_SHEETS
   → throw ValidationError('MAX_SHEETS_REACHED')

4. scope === 'CUSTOMER'
   → repo.countActiveCustomerSheets(clinicId, customerId) >= MAX_ACTIVE_CUSTOMER_SHEETS
   → throw ValidationError('MAX_CUSTOMER_SHEETS_REACHED')

5. repo.findSheetByName(clinicId, name, scope, customerId ?? null)
   → se encontrado: throw ConflictError('Nome de ficha já existe.')

6. repo.createSheet(clinicId, authenticatedUserId, dto)
```

### 5.3 Fluxo de `updateSheet()` no Service

```
1. repo.findSheetById(id, clinicId)
   → se não encontrado: throw NotFoundError
   → se clinicId diverge: throw ForbiddenError('CROSS_TENANT_VIOLATION')

2. sheet.scope === 'SYSTEM' && role !== 'admin'
   → throw ForbiddenError('Apenas administradores podem editar fichas do sistema.')

3. sheet.scope === 'CUSTOMER'
   → isOwner = sheet.createdByUserId === authenticatedUserId
   → se !isOwner && role !== 'admin': throw ForbiddenError('Você só pode editar fichas criadas por você.')

4. dto.active === true && !sheet.active (reativar)
   → verificar limite do scope correspondente (idêntico ao create)

5. dto.name → verificar unicidade scope-aware

6. repo.updateSheet(id, clinicId, dto)
```

### 5.4 Assinatura Atualizada dos Handlers

**Route POST /measurement-sheets:**
```typescript
// Remover: { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }
// Usar:    { preHandler: [jwtClinicGuard] }
async (req, reply) => {
  const dto = CreateSheetDto.parse(req.body)
  return reply.status(201).send(
    await svc.createSheet(req.clinicId, req.user.sub, req.user.role, dto)
  )
}
```

**Route PATCH /measurement-sheets/:id:**
```typescript
// Remover: { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }
// Usar:    { preHandler: [jwtClinicGuard] }
async (req, reply) => {
  const { id } = req.params as { id: string }
  const dto = UpdateSheetDto.parse(req.body)
  return reply.send(
    await svc.updateSheet(id, req.clinicId, req.user.sub, req.user.role, dto)
  )
}
```

### 5.5 Novo Método no Repository — `hasConfirmedAppointment()`

Adicionar em `MeasurementSheetsRepository` — sem dependência do módulo de appointments:

```typescript
async hasConfirmedAppointment(params: {
  clinicId: string
  professionalId: string
  customerId: string
}): Promise<boolean> {
  const count = await prisma.appointment.count({
    where: {
      clinicId: params.clinicId,
      professionalId: params.professionalId,
      customerId: params.customerId,
      status: { in: ['confirmed', 'in_progress', 'completed'] },
    },
  })
  return count > 0
}
```

---

## 6. Arquivo de Templates

**Localização:** `aesthera/apps/api/src/modules/measurement-sheets/measurement-templates.ts`

### 6.1 Types Exportados

```typescript
export type MeasurementTemplateField = {
  name: string
  inputType: 'INPUT' | 'CHECK'
  unit?: string
  isTextual?: boolean
  subColumns?: string[]
  order: number
}

export type MeasurementTemplateColumn = {
  name: string
  inputType: 'INPUT' | 'CHECK'
  unit?: string
  isTextual?: boolean
  order: number
}

export type MeasurementTemplate = {
  id: string
  name: string
  category: 'CORPORAL' | 'FACIAL' | 'DERMATO_FUNCIONAL' | 'NUTRICIONAL' | 'POSTURAL' | 'PERSONALIZADA'
  type: 'SIMPLE' | 'TABULAR'
  fields: MeasurementTemplateField[]
  columns: MeasurementTemplateColumn[]
}
```

### 6.2 Constante `MEASUREMENT_TEMPLATES`

```typescript
export const MEASUREMENT_TEMPLATES: MeasurementTemplate[] = [
  // ─── 1. Perimetria (CORPORAL / SIMPLE) ──────────────────────────────────────
  {
    id: 'tpl-perimetria',
    name: 'Perimetria',
    category: 'CORPORAL',
    type: 'SIMPLE',
    columns: [],
    fields: [
      { name: 'Cintura',  inputType: 'INPUT', unit: 'cm', order: 0 },
      { name: 'Abdome',   inputType: 'INPUT', unit: 'cm', order: 1 },
      { name: 'Quadril',  inputType: 'INPUT', unit: 'cm', order: 2 },
      { name: 'Braço D',  inputType: 'INPUT', unit: 'cm', order: 3 },
      { name: 'Braço E',  inputType: 'INPUT', unit: 'cm', order: 4 },
      { name: 'Coxa D',   inputType: 'INPUT', unit: 'cm', order: 5 },
      { name: 'Coxa E',   inputType: 'INPUT', unit: 'cm', order: 6 },
    ],
  },

  // ─── 2. Bioimpedância (CORPORAL / SIMPLE) ───────────────────────────────────
  {
    id: 'tpl-bioimpedancia',
    name: 'Bioimpedância',
    category: 'CORPORAL',
    type: 'SIMPLE',
    columns: [],
    fields: [
      { name: 'Peso',           inputType: 'INPUT', unit: 'kg', order: 0 },
      { name: 'Altura',         inputType: 'INPUT', unit: 'cm', order: 1 },
      { name: '% Gordura',      inputType: 'INPUT', unit: '%',  order: 2 },
      { name: 'Massa Muscular', inputType: 'INPUT', unit: 'kg', order: 3 },
      { name: 'Massa Óssea',    inputType: 'INPUT', unit: 'kg', order: 4 },
      { name: 'Água Corporal',  inputType: 'INPUT', unit: '%',  order: 5 },
    ],
  },

  // ─── 3. Condição Estética (DERMATO_FUNCIONAL / TABULAR) ─────────────────────
  {
    id: 'tpl-condicao-estetica',
    name: 'Condição Estética',
    category: 'DERMATO_FUNCIONAL',
    type: 'TABULAR',
    fields: [
      { name: 'Braços',   inputType: 'INPUT', order: 0 },
      { name: 'Costas',   inputType: 'INPUT', order: 1 },
      { name: 'Axilares', inputType: 'INPUT', order: 2 },
      { name: 'Flancos',  inputType: 'INPUT', order: 3 },
      { name: 'Abdome',   inputType: 'INPUT', order: 4 },
      { name: 'Glúteos',  inputType: 'INPUT', order: 5 },
      { name: 'Culotes',  inputType: 'INPUT', order: 6 },
    ],
    columns: [
      { name: 'FEG I',             inputType: 'CHECK', order: 0 },
      { name: 'FEG II',            inputType: 'CHECK', order: 1 },
      { name: 'FEG III',           inputType: 'CHECK', order: 2 },
      { name: 'Adiposidade',       inputType: 'CHECK', order: 3 },
      { name: 'Dura/Mole',         inputType: 'INPUT', isTextual: true, order: 4 },
      { name: 'Flacidez Muscular', inputType: 'CHECK', order: 5 },
      { name: 'Flacidez Tissular', inputType: 'CHECK', order: 6 },
      { name: 'Estrias Brancas',   inputType: 'CHECK', order: 7 },
      { name: 'Estrias Vermelhas', inputType: 'CHECK', order: 8 },
      { name: 'Varicose',          inputType: 'CHECK', order: 9 },
    ],
  },

  // ─── 4. Firmeza Tissular (DERMATO_FUNCIONAL / TABULAR) ──────────────────────
  {
    id: 'tpl-firmeza-tissular',
    name: 'Firmeza Tissular',
    category: 'DERMATO_FUNCIONAL',
    type: 'TABULAR',
    fields: [
      { name: 'Braços',  inputType: 'INPUT', order: 0 },
      { name: 'Abdome',  inputType: 'INPUT', order: 1 },
      { name: 'Flancos', inputType: 'INPUT', order: 2 },
      { name: 'Glúteos', inputType: 'INPUT', order: 3 },
      { name: 'Coxas',   inputType: 'INPUT', order: 4 },
    ],
    columns: [
      { name: 'Grau 1', inputType: 'CHECK', order: 0 },
      { name: 'Grau 2', inputType: 'CHECK', order: 1 },
      { name: 'Grau 3', inputType: 'CHECK', order: 2 },
      { name: 'Grau 4', inputType: 'CHECK', order: 3 },
    ],
  },

  // ─── 5. Avaliação Facial (FACIAL / SIMPLE) ──────────────────────────────────
  {
    id: 'tpl-avaliacao-facial',
    name: 'Avaliação Facial',
    category: 'FACIAL',
    type: 'SIMPLE',
    columns: [],
    fields: [
      { name: 'Fototipo Fitzpatrick', inputType: 'INPUT', isTextual: true, order: 0 },
      { name: 'Tipo de Pele',         inputType: 'INPUT', isTextual: true, order: 1 },
      { name: 'Oleosidade',           inputType: 'INPUT', isTextual: true, order: 2 },
      { name: 'Sensibilidade',        inputType: 'INPUT', isTextual: true, order: 3 },
      { name: 'Manchas',              inputType: 'INPUT', isTextual: true, order: 4 },
      { name: 'Rugas',                inputType: 'INPUT', isTextual: true, order: 5 },
    ],
  },

  // ─── 6. Avaliação Postural (POSTURAL / SIMPLE) ──────────────────────────────
  {
    id: 'tpl-postural',
    name: 'Avaliação Postural',
    category: 'POSTURAL',
    type: 'SIMPLE',
    columns: [],
    fields: [
      { name: 'Joelhos (valgo/varo)', inputType: 'INPUT', isTextual: true, order: 0 },
      { name: 'Coluna',               inputType: 'INPUT', isTextual: true, order: 1 },
      { name: 'Ombros',               inputType: 'INPUT', isTextual: true, order: 2 },
      { name: 'Quadril',              inputType: 'INPUT', isTextual: true, order: 3 },
      { name: 'Pelve',                inputType: 'INPUT', isTextual: true, order: 4 },
    ],
  },
]
```

---

## 7. Integração com measurement-sessions

### 7.1 Objetivo

A listagem de sessões deve incluir `categories: MeasurementCategory[]` por sessão, derivado das fichas vinculadas. Permite que o frontend filtre sessões por categoria sem reprocessamento.

**Sem alteração no schema de `MeasurementSession`.**

### 7.2 Alteração em `SESSION_INCLUDE` (repository)

```typescript
// measurement-sessions.repository.ts — SESSION_INCLUDE
const SESSION_INCLUDE = {
  sheetRecords: {
    include: {
      sheet: {
        select: {
          id: true,
          name: true,
          category: true,   // ← ADICIONAR esta linha
        },
      },
      values: { /* sem alteração */ },
      tabularValues: { /* sem alteração */ },
    },
  },
  files: { /* sem alteração */ },
}
```

### 7.3 Mapeamento no Service

```typescript
// measurement-sessions.service.ts — listSessions()
async listSessions(clinicId: string, q: ListSessionsQuery) {
  const customer = await this.repo.findCustomerInClinic(q.customerId, clinicId)
  if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

  const result = await this.repo.listSessions(clinicId, q)

  const items = result.items.map((session) => ({
    ...session,
    categories: [
      ...new Set(
        session.sheetRecords
          .map((sr) => sr.sheet.category)
          .filter(Boolean)
      ),
    ],
  }))

  return { ...result, items }
}
```

### 7.4 Shape da Response Atualizada

```typescript
// GET /measurement-sessions — por item:
{
  id: string
  clinicId: string
  customerId: string
  recordedAt: string
  notes: string | null
  categories: MeasurementCategory[]   // NOVO: ex: ['CORPORAL', 'FACIAL']
  sheetRecords: [...]
  files: [...]
  createdAt: string
  updatedAt: string
}
```

---

## 8. DoD Checklist

O `aesthera-implementador` deve marcar cada item ao concluir.

### Banco de Dados / Migration

- [ ] Enums `MeasurementCategory` e `MeasurementScope` criados no schema.prisma
- [ ] Campos `category`, `scope`, `customerId`, `createdByUserId` adicionados ao model `MeasurementSheet`
- [ ] Relação `customer` (Customer?) adicionada ao model `MeasurementSheet`
- [ ] Relação inversa `measurementSheets` adicionada ao model `Customer`
- [ ] `@@unique([clinicId, name])` removido do schema
- [ ] Migration gerada: `prisma migrate dev --name add-measurement-category-scope`
- [ ] Migration editada manualmente com os dois partial unique indexes
- [ ] Fichas existentes preservam dados após migration (category=CORPORAL, scope=SYSTEM)
- [ ] Índices `[clinicId, scope, active]` e `[clinicId, customerId]` criados

### DTOs

- [ ] `CreateSheetDto`: campos `category`, `scope`, `customerId` adicionados com defaults corretos
- [ ] `CreateSheetDto`: `.refine()` implementado — scope=CUSTOMER exige customerId NOT NULL
- [ ] `UpdateSheetDto`: campo `category` adicionado; campo `type` ausente (não aceito no PATCH)
- [ ] `ListSheetsQuery`: filtros `scope`, `category`, `customerId` adicionados como opcionais
- [ ] Constante `MAX_ACTIVE_CUSTOMER_SHEETS = 10` adicionada ao DTO

### Service

- [ ] `createSheet()` recebe `authenticatedUserId` e `userRole`
- [ ] `createSheet()`: scope=SYSTEM bloqueado para não-admin (403)
- [ ] `createSheet()`: professional verifica agendamento confirmado via repo (403 sem vínculo)
- [ ] `createSheet()`: limite diferenciado por scope (SYSTEM: 20, CUSTOMER: 10)
- [ ] `createSheet()`: unicidade de nome scope-aware
- [ ] `updateSheet()` recebe `authenticatedUserId` e `userRole`
- [ ] `updateSheet()`: scope=SYSTEM bloqueado para não-admin (403)
- [ ] `updateSheet()`: scope=CUSTOMER verifica `createdByUserId === authenticatedUserId` ou admin
- [ ] `listSheets()`: filtros `scope` e `category` aplicados ao repo
- [ ] `createSheetFromTemplate()`: localiza template, trata conflito de nome com sufixo, cria via `prisma.$transaction()`

### Repository

- [ ] `hasConfirmedAppointment()` adicionado (query direta em `appointment`)
- [ ] `countActiveCustomerSheets(clinicId, customerId)` adicionado
- [ ] `countActiveSheets()` aceita parâmetro `scope` (ou separado em dois métodos)
- [ ] `listSheets()` suporta filtros `scope` e `category`
- [ ] `createSheet()` persiste `category`, `scope`, `customerId`, `createdByUserId`
- [ ] `updateSheet()` persiste campo `category`
- [ ] `findSheetByName()` é scope-aware (considera customerId para CUSTOMER)

### Routes (Controller)

- [ ] `POST /measurement-sheets`: `roleGuard(['admin'])` removido; `sub` e `role` passados ao service
- [ ] `PATCH /measurement-sheets/:id`: `roleGuard(['admin'])` removido; `sub` e `role` passados ao service
- [ ] `GET /measurement-sheets/templates`: registrado **antes** de `/:id`
- [ ] `POST /measurement-sheets/templates/:templateId/copy`: registrado **antes** de `/:id`, com `roleGuard(['admin'])`
- [ ] Ordem de registro no router validada (templates antes de `/:id`)

### Templates

- [ ] Arquivo `measurement-templates.ts` criado com os 6 templates completos
- [ ] Types `MeasurementTemplate`, `MeasurementTemplateField`, `MeasurementTemplateColumn` exportados
- [ ] Constante `MEASUREMENT_TEMPLATES` exportada, tipada e sem erros de compilação

### Integração com measurement-sessions

- [ ] `SESSION_INCLUDE` atualizado: `sheet.category` incluído no select
- [ ] `listSessions()` computa e inclui `categories: string[]` por sessão
- [ ] Campo `categories` presente na response de `GET /measurement-sessions`

### Testes (`measurement-sheets.test.ts`)

- [ ] POST scope=CUSTOMER sem customerId → 400
- [ ] POST scope=SYSTEM por staff → 403
- [ ] POST scope=SYSTEM por professional → 403
- [ ] POST scope=CUSTOMER por professional sem agendamento confirmado → 403
- [ ] POST scope=CUSTOMER por professional com agendamento confirmed → 201
- [ ] PATCH scope=SYSTEM por staff → 403
- [ ] PATCH scope=CUSTOMER pelo criador → 200
- [ ] PATCH scope=CUSTOMER por outro usuário não-admin → 403
- [ ] PATCH enviando campo `type` → campo ignorado silenciosamente (sem 400)
- [ ] GET com clinicId de outra clínica → retorna vazio (cross-tenant)
- [ ] POST /templates/:id/copy por staff → 403
- [ ] POST /templates/:id/copy por admin → 201
- [ ] Copiar mesmo template duas vezes → segundo recebe sufixo " 2"
- [ ] Copiar template inexistente → 404
- [ ] Migration não-destrutiva: fichas existentes preservam dados (verificado via seed/fixture)

### Geral

- [ ] `clinicId` nunca aceito do request body — sempre extraído do JWT
- [ ] Sem `console.log` ou código de debug no código final
- [ ] PLAN.md atualizado

---

## 9. Notas para o Implementador

### 9.1 Constraint `@@unique([clinicId, name])` — Remoção Obrigatória

O model atual tem `@@unique([clinicId, name])`. Este constraint **quebra** com `scope=CUSTOMER` porque diferentes clientes podem ter fichas com o mesmo nome na mesma clínica. **Não tente manter o `@@unique` existente** — substitua pelos dois partial unique indexes conforme a seção 2.2.

Ao executar `prisma migrate dev`, o Prisma vai gerar SQL para remover o `@@unique`. Antes de aplicar, edite o arquivo `migration.sql` gerado para adicionar os dois `CREATE UNIQUE INDEX ... WHERE scope = ...`.

### 9.2 Ordem de Rotas no Fastify — Crítico

Fastify resolve rotas por ordem de registro. Se `/:id` for registrada antes de `/templates`, a rota `/measurement-sheets/templates` irá falhar tentando resolver `"templates"` como um UUID.

**Ordem obrigatória no arquivo `measurement-sheets.routes.ts`:**
```
1. GET  /measurement-sheets
2. GET  /measurement-sheets/templates                     ← ANTES de /:id
3. POST /measurement-sheets/templates/:templateId/copy    ← ANTES de /:id
4. POST /measurement-sheets
5. PATCH /measurement-sheets/:id
6. DELETE /measurement-sheets/:id
7. Rotas de campos e colunas aninhadas
```

### 9.3 Professional JWT — `sub` é `professionalId`

Para professionals, `req.user.sub` contém o `professionalId` da tabela `professionals` (não um `userId` de `users`). O método `hasConfirmedAppointment()` usa `professionalId` na query de `appointment`, o que está correto. Não misturar `professionalId` com `userId` em nenhuma lógica de ownership.

### 9.4 Sufixo Numérico na Cópia de Template

A lógica de sufixo deve ser iterativa no service:

```typescript
let candidateName = template.name
let suffix = 2
while (await this.repo.findSheetByName(clinicId, candidateName, 'SYSTEM', null)) {
  if (suffix > 99) throw new ValidationError('Não foi possível gerar nome único para a cópia.')
  candidateName = `${template.name} ${suffix}`
  suffix++
}
```

### 9.5 `createdByUserId` — Sem FK Física no Banco (Decisão Arquitetural)

O campo `createdByUserId` referencia `professionalId` quando criado por um professional, mas o campo FK `created_by_user_id → users.id` não pode referenciar a tabela `professionals`. Por isso:

- **Não adicionar relação Prisma `createdBy User?`** ao model `MeasurementSheet`
- Manter `createdByUserId String?` como campo simples, sem FK declarada no schema
- A FK real no banco deve ser omitida (campo TEXT/UUID sem REFERENCES)
- A verificação de ownership no service usa `sheet.createdByUserId === authenticatedUserId` (comparação de string), não uma query de join

### 9.6 `prisma.$transaction()` no Copy de Template

A criação via template deve ser atômica. Usar `prisma.$transaction([...])` com o array de operações:

```typescript
await prisma.$transaction([
  prisma.measurementSheet.create({ data: sheetData }),
  ...template.fields.map((f) => prisma.measurementField.create({ data: fieldData(f) })),
  ...template.columns.map((c) => prisma.measurementSheetColumn.create({ data: colData(c) })),
])
```

### 9.7 Validação de `scope=CUSTOMER` em Sessões

O método `validateSheetsOwnership()` no `MeasurementSessionsRepository` verifica apenas que os `sheetIds` pertencem à `clinicId`. Para fichas `scope=CUSTOMER`, seria necessário também validar que `sheet.customerId === dto.customerId`. **Esta validação adicional está fora do escopo da issue #157** — registrar como dívida técnica a resolver na issue de frontend de sessões.

### 9.8 Retorno de `type` no PATCH

O `UpdateSheetDto` simplesmente não deve incluir o campo `type`. O Zod, por padrão com `.strip()`, ignorará silenciosamente campos desconhecidos no body. Não é necessário usar `z.never()` — basta a omissão.
