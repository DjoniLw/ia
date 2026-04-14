# Spec Técnica — [FICHAS DE AVALIAÇÃO EXPANDIDAS] 1/3 — Backend (#157)

**Issue:** #157
**Data:** 14/04/2026
**Módulo(s):** `measurement-sheets`, `measurement-sessions`, `appointments` (modificação mínima)
**Tipo:** Backend

---

## 1. Contexto

O módulo `measurement-sheets` existe e serve exclusivamente fichas corporais (`SIMPLE` e `TABULAR`). Todos os `MeasurementSheet` têm implicitamente `category=CORPORAL` e `scope=SYSTEM`. Esta issue adiciona 2 novos enums (`MeasurementCategory`, `MeasurementScope`), 4 novos campos ao model, migration não-destrutiva, biblioteca de templates como constante de código, 2 novos endpoints, autorização granular por role/scope e o campo computado `categories` na response de sessões.

> ⚠️ **Discrepância de nomenclatura:** A issue menciona `measurement-sheets.controller.ts`, mas a convenção do codebase usa `measurement-sheets.routes.ts`. Utilizar sempre `routes.ts`.

---

## 2. Escopo da Implementação

### 2.1 Backend

**Arquivos a CRIAR:**
```
aesthera/apps/api/src/modules/measurement-sheets/measurement-templates.ts
  — Constante MEASUREMENT_TEMPLATES com 6 templates pré-configurados

aesthera/apps/api/prisma/migrations/{timestamp}_add-measurement-category-scope/
  — Migration gerada por `prisma migrate dev`
```

**Arquivos a MODIFICAR:**
```
aesthera/apps/api/prisma/schema.prisma
  — Adicionar enums MeasurementCategory e MeasurementScope;
    adicionar 4 campos + 2 relações + 2 índices a MeasurementSheet

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.dto.ts
  — Expandir CreateSheetDto, UpdateSheetDto, ListSheetsQuery

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.service.ts
  — Expandir createSheet, updateSheet, listSheets com nova autorização, filtros e lógica de scope

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.repository.ts
  — Atualizar createSheet e listSheets; adicionar countActiveCustomerSheets,
    findSheetByNameForCustomer, copyTemplateAsSheet

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.routes.ts
  — Adicionar endpoints GET /templates e POST /templates/:id/copy (antes de /:id);
    atualizar POST e PATCH para passar userId e role ao service

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.test.ts
  — Adicionar cenários de teste para os novos comportamentos

aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.service.ts
  — Computar e retornar campo categories: MeasurementCategory[] em listSessions

aesthera/apps/api/src/modules/appointments/appointments.repository.ts
  — Adicionar método existsConfirmed() (query READ-ONLY; justificativa: RN-10 da spec
    exige verificação de vínculo no service layer de measurement-sheets — sem essa query
    não é possível implementar a regra sem acoplar diretamente ao Prisma no service)
```

**Nenhuma alteração necessária em:**
```
measurement-sessions.repository.ts — SESSION_INCLUDE já inclui sheet; categories é computado no service
measurement-sessions.dto.ts        — nenhum campo de input muda
measurement-sessions.routes.ts     — assinatura das rotas permanece igual
```

### 2.2 Banco de Dados

**Migração necessária:** Sim — **não-destrutiva**

```prisma
-- Novos enums adicionados ao schema.prisma:

enum MeasurementCategory {
  CORPORAL
  FACIAL
  DERMATO_FUNCIONAL
  NUTRICIONAL
  POSTURAL
  PERSONALIZADA
}

enum MeasurementScope {
  SYSTEM    -- visível a todos os clientes da clínica
  CUSTOMER  -- visível apenas ao cliente vinculado
}

-- Campos adicionados ao model MeasurementSheet (após campo `order`):

category          MeasurementCategory  @default(CORPORAL)    @map("category")
scope             MeasurementScope     @default(SYSTEM)      @map("scope")
customerId        String?              @map("customer_id")
createdByUserId   String?              @map("created_by_user_id")

-- Relações adicionadas ao model MeasurementSheet:

customer    Customer?  @relation(fields: [customerId], references: [id], onDelete: Restrict)
createdBy   User?      @relation(fields: [createdByUserId], references: [id])

-- Índices adicionados ao model MeasurementSheet (manter o @@unique existente):

@@index([clinicId, scope, active])
@@index([clinicId, customerId])
```

Todos os `MeasurementSheet` existentes recebem `category=CORPORAL` e `scope=SYSTEM` pelos defaults — **zero downtime**.

Gerar com:
```
prisma migrate dev --name add-measurement-category-scope
```

---

## 3. Contratos de API

### 3.1 GET /measurement-sheets

Filtros adicionados à query string (todos opcionais):

```
GET /measurement-sheets?scope=SYSTEM&category=CORPORAL&customerId=uuid&includeInactive=false

Query params novos:
  scope       : 'SYSTEM' | 'CUSTOMER'   — opcional
  category    : MeasurementCategory      — opcional
  customerId  : string (UUID)            — obrigatório quando scope=CUSTOMER

Response (200): MeasurementSheet[] (schema inalterado + campos category, scope, customerId)

Auth: Obrigatório (JwtClinicGuard)
Role: any (clinicId do JWT sempre no where)
Guard de tenant (clinicId): Sim — sempre extraído do JWT
```

### 3.2 POST /measurement-sheets

```
POST /measurement-sheets

Request Body:
  name            : string (1–100)       — obrigatório
  type            : 'SIMPLE' | 'TABULAR' — default SIMPLE
  category        : MeasurementCategory  — default CORPORAL
  scope           : 'SYSTEM' | 'CUSTOMER'— default SYSTEM
  customerId      : UUID                 — obrigatório quando scope=CUSTOMER
  order           : number               — opcional

Response (201): MeasurementSheet com todos os campos

Errors:
  400 — scope=CUSTOMER sem customerId
  403 — profissional sem agendamento confirmado com o cliente
  403 — staff tentando criar scope=SYSTEM (role guard no route, verificação no service)
  409 — nome duplicado na clínica (ou no cliente, para scope=CUSTOMER)
  422 — MAX_SHEETS_REACHED (scope=SYSTEM, limit 20) ou MAX_CUSTOMER_SHEETS_REACHED (scope=CUSTOMER, limit 10)

Auth: Obrigatório (JwtClinicGuard)
Role:
  scope=SYSTEM  → apenas admin (roleGuard no route)
  scope=CUSTOMER → admin, staff, professional (verificação de vínculo no service para professional)
Guard de tenant (clinicId): Sim — extraído do JWT, nunca do body
```

> ⚠️ O `roleGuard(['admin'])` existente na rota POST deve ser REMOVIDO. A verificação de role passa a ser feita no **service**, pois o critério varia pelo campo `scope` do DTO.

### 3.3 PATCH /measurement-sheets/:id

```
PATCH /measurement-sheets/:id

Request Body:
  name     : string (1–100) — opcional
  category : MeasurementCategory — opcional (campo NOVO mutável)
  order    : number       — opcional
  active   : boolean      — opcional
  -- campo `type` AUSENTE do schema Zod (nunca permitido no PATCH)

Response (200): MeasurementSheet atualizado

Errors:
  403 — scope=SYSTEM por não-admin
  403 — scope=CUSTOMER por usuário que não é criador nem admin
  404 — ficha não encontrada / cross-tenant

Auth: Obrigatório (JwtClinicGuard)
Role: verificado no service conforme scope da ficha
Guard de tenant (clinicId): Sim
```

### 3.4 GET /measurement-sheets/templates ← NOVO

```
GET /measurement-sheets/templates

Response (200): Array de templates da constante MEASUREMENT_TEMPLATES
  [
    {
      id       : string
      name     : string
      category : MeasurementCategory
      type     : 'SIMPLE' | 'TABULAR'
      fields?  : string[]    -- para type=SIMPLE
      rows?    : string[]    -- para type=TABULAR
      columns? : string[]    -- para type=TABULAR
    }
  ]

Sem consulta ao banco — retorna MEASUREMENT_TEMPLATES diretamente.

Auth: Obrigatório (JwtClinicGuard)
Role: any
Guard de tenant (clinicId): Não necessário (templates são globais/read-only)
```

### 3.5 POST /measurement-sheets/templates/:id/copy ← NOVO

```
POST /measurement-sheets/templates/:id/copy

Params:
  id: ID do template (ex: 'tpl-perimetria')

Request Body: vazio

Response (201): MeasurementSheet criada na clínica do JWT (com fields/columns incluídos)

Errors:
  404 — templateId não encontrado em MEASUREMENT_TEMPLATES
  403 — role !== 'admin'
  422 — MAX_SHEETS_REACHED (se limite de 20 atingido)

Lógica de nome duplicado:
  Se nome já existe na clínica: tentar `{nome} 2`, `{nome} 3`, ... até nome livre (máx 99)
  Se não encontrar nome livre: retornar 409

Auth: Obrigatório (JwtClinicGuard + roleGuard(['admin']))
Role: admin
Guard de tenant (clinicId): Sim — extraído do JWT
Transação: Sim — prisma.$transaction() para criar sheet + fields/columns atomicamente
```

---

## 4. Detalhamento de Implementação

### 4.1 measurement-templates.ts (NOVO)

Criar `src/modules/measurement-sheets/measurement-templates.ts`:

```typescript
import { MeasurementCategory } from '@prisma/client'

type SimpleTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: 'SIMPLE'
  fields: string[]
}

type TabularTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: 'TABULAR'
  rows: string[]
  columns: string[]
}

export type MeasurementTemplate = SimpleTemplate | TabularTemplate

export const MEASUREMENT_TEMPLATES: readonly MeasurementTemplate[] = [
  {
    id: 'tpl-perimetria',
    name: 'Perimetria',
    category: 'CORPORAL',
    type: 'SIMPLE',
    fields: ['Cintura', 'Abdome', 'Quadril', 'Braço D', 'Braço E', 'Coxa D', 'Coxa E'],
  },
  {
    id: 'tpl-bioimpedancia',
    name: 'Bioimpedância',
    category: 'CORPORAL',
    type: 'SIMPLE',
    fields: ['Peso', 'Altura', '% Gordura', 'Massa Muscular', 'Massa Óssea', 'Água Corporal'],
  },
  {
    id: 'tpl-condicao-estetica',
    name: 'Condição Estética',
    category: 'DERMATO_FUNCIONAL',
    type: 'TABULAR',
    rows: ['Braços', 'Costas', 'Axilares', 'Flancos', 'Abdome', 'Glúteos', 'Culotes'],
    columns: ['FEG I', 'FEG II', 'FEG III', 'Adiposidade', 'Dura/Mole', 'Flacidez Muscular/Tissular', 'Estrias Brancas', 'Estrias Vermelhas', 'Varicose'],
  },
  {
    id: 'tpl-firmeza-tissular',
    name: 'Firmeza Tissular',
    category: 'DERMATO_FUNCIONAL',
    type: 'TABULAR',
    rows: ['Braços', 'Abdome', 'Flancos', 'Glúteos', 'Coxas'],
    columns: ['Grau 1', 'Grau 2', 'Grau 3', 'Grau 4'],
  },
  {
    id: 'tpl-avaliacao-facial',
    name: 'Avaliação Facial',
    category: 'FACIAL',
    type: 'SIMPLE',
    fields: ['Fototipo Fitzpatrick', 'Tipo de Pele', 'Oleosidade', 'Sensibilidade', 'Manchas', 'Rugas'],
  },
  {
    id: 'tpl-postural',
    name: 'Avaliação Postural',
    category: 'POSTURAL',
    type: 'SIMPLE',
    fields: ['Joelhos (valgo/varo)', 'Coluna', 'Ombros', 'Quadril', 'Pelve'],
  },
] as const
```

### 4.2 measurement-sheets.dto.ts — Mudanças

```typescript
// Enums a importar de @prisma/client
import { MeasurementCategory, MeasurementScope } from '@prisma/client'

// CreateSheetDto — SUBSTITUIR por:
export const CreateSheetDto = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['SIMPLE', 'TABULAR']).default('SIMPLE'),
  category: z.nativeEnum(MeasurementCategory).optional().default('CORPORAL'),
  scope: z.nativeEnum(MeasurementScope).optional().default('SYSTEM'),
  customerId: z.string().uuid().optional(),
  order: z.number().int().nonnegative().optional(),
}).refine(
  (data) => data.scope !== 'CUSTOMER' || !!data.customerId,
  { message: 'customerId é obrigatório para fichas personalizadas', path: ['customerId'] },
)

// UpdateSheetDto — SUBSTITUIR por (campo `type` ausente — nunca permitido no PATCH):
export const UpdateSheetDto = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.nativeEnum(MeasurementCategory).optional(),  // NOVO — mutável
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  // `type` deliberadamente ausente
})

// ListSheetsQuery — SUBSTITUIR por:
export const ListSheetsQuery = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
  scope: z.nativeEnum(MeasurementScope).optional(),       // NOVO
  category: z.nativeEnum(MeasurementCategory).optional(), // NOVO
  customerId: z.string().uuid().optional(),               // NOVO (obrigatório quando scope=CUSTOMER)
})

// Nova constante de limite (adicionar ao bloco de constantes):
export const MAX_ACTIVE_CUSTOMER_SHEETS = 10
```

### 4.3 measurement-sheets.service.ts — Mudanças

**Assinatura de `listSheets()` — atualizar:**
```typescript
async listSheets(clinicId: string, q: ListSheetsQuery) {
  return this.repo.listSheets(clinicId, {
    activeOnly: !q.includeInactive,
    scope: q.scope,
    category: q.category,
    customerId: q.customerId,
  })
}
```

**Assinatura de `createSheet()` — adicionar parâmetros de contexto:**
```typescript
async createSheet(
  clinicId: string,
  userId: string,    // NOVO — request.user.sub
  role: string,      // NOVO — request.user.role
  dto: CreateSheetDto,
) {
  // scope=SYSTEM: apenas admin
  if (dto.scope === 'SYSTEM' && role !== 'admin') {
    throw new ForbiddenError('Apenas administradores podem criar fichas do sistema')
  }

  // scope=CUSTOMER: validações extras
  if (dto.scope === 'CUSTOMER') {
    // customerId garantido pelo refine do DTO — aqui só assertion
    // Verificar limite de fichas personalizadas por cliente
    const customerCount = await this.repo.countActiveCustomerSheets(clinicId, dto.customerId!)
    if (customerCount >= MAX_ACTIVE_CUSTOMER_SHEETS) {
      throw new ValidationError('MAX_CUSTOMER_SHEETS_REACHED')
    }

    // Profissional: exigir agendamento confirmado
    if (role === 'professional') {
      const hasAppointment = await this.appointmentsRepo.existsConfirmed({
        clinicId,
        professionalId: userId,
        customerId: dto.customerId!,
      })
      if (!hasAppointment) {
        throw new ForbiddenError('Você não tem agendamento confirmado com este cliente.')
      }
    }

    // Unicidade de nome por cliente (além da verificação global)
    const existingCustomer = await this.repo.findSheetByNameForCustomer(
      clinicId, dto.customerId!, dto.name,
    )
    if (existingCustomer) {
      throw new ConflictError('Nome de ficha já existe para este cliente')
    }
  } else {
    // scope=SYSTEM: verificar limite global (lógica existente)
    const count = await this.repo.countActiveSheets(clinicId)
    if (count >= MAX_ACTIVE_SHEETS) throw new ValidationError('MAX_SHEETS_REACHED')

    const existing = await this.repo.findSheetByName(clinicId, dto.name)
    if (existing) throw new ConflictError('Nome de ficha já existe nesta clínica')
  }

  return this.repo.createSheet(clinicId, userId, dto)
}
```

**`updateSheet()` — adicionar verificação de scope:**
```typescript
async updateSheet(id: string, clinicId: string, userId: string, role: string, dto: UpdateSheetDto) {
  const sheet = await this.repo.findSheetById(id, clinicId)
  if (!sheet) throw new NotFoundError('MeasurementSheet')
  if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

  // Autorização por scope
  if (sheet.scope === 'SYSTEM' && role !== 'admin') {
    throw new ForbiddenError('Apenas administradores podem editar fichas do sistema')
  }
  if (sheet.scope === 'CUSTOMER' && role !== 'admin' && sheet.createdByUserId !== userId) {
    throw new ForbiddenError('Você não tem permissão para editar esta ficha personalizada')
  }

  // ... lógica existente de nome único e limite de reativação ...
  // (preservada sem alteração)
}
```

**`copyTemplate()` — NOVO método no service:**
```typescript
async copyTemplate(clinicId: string, templateId: string): Promise<MeasurementSheet> {
  const template = MEASUREMENT_TEMPLATES.find((t) => t.id === templateId)
  if (!template) throw new NotFoundError('Template')

  // Verificar limite
  const count = await this.repo.countActiveSheets(clinicId)
  if (count >= MAX_ACTIVE_SHEETS) throw new ValidationError('MAX_SHEETS_REACHED')

  // Encontrar nome disponível (evita duplicata)
  const availableName = await this.resolveAvailableName(clinicId, template.name)

  return this.repo.copyTemplateAsSheet(clinicId, template, availableName)
}

private async resolveAvailableName(clinicId: string, baseName: string): Promise<string> {
  const existing = await this.repo.findSheetByName(clinicId, baseName)
  if (!existing) return baseName

  for (let i = 2; i <= 99; i++) {
    const candidate = `${baseName} ${i}`
    const found = await this.repo.findSheetByName(clinicId, candidate)
    if (!found) return candidate
  }
  throw new ConflictError(`Não foi possível encontrar um nome disponível para "${baseName}"`)
}
```

**Injeção do `AppointmentsRepository`:**
```typescript
import { AppointmentsRepository } from '../appointments/appointments.repository'

export class MeasurementSheetsService {
  private repo = new MeasurementSheetsRepository()
  private appointmentsRepo = new AppointmentsRepository()  // NOVO
  // ...
}
```

### 4.4 measurement-sheets.repository.ts — Mudanças

**`createSheet()` — atualizar assinatura:**
```typescript
async createSheet(clinicId: string, createdByUserId: string, dto: CreateSheetDto) {
  return prisma.measurementSheet.create({
    data: {
      clinicId,
      name: dto.name,
      type: dto.type,
      category: dto.category ?? 'CORPORAL',
      scope: dto.scope ?? 'SYSTEM',
      customerId: dto.customerId ?? null,
      createdByUserId,
      order: dto.order ?? 0,
    },
    include: { columns: true, fields: true },
  })
}
```

**`listSheets()` — atualizar para aceitar filtros:**
```typescript
async listSheets(
  clinicId: string,
  filters: {
    activeOnly: boolean
    scope?: MeasurementScope
    category?: MeasurementCategory
    customerId?: string
  },
) {
  return prisma.measurementSheet.findMany({
    where: {
      clinicId,
      ...(filters.activeOnly ? { active: true } : {}),
      ...(filters.scope ? { scope: filters.scope } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    orderBy: { order: 'asc' },
    include: {
      columns: { orderBy: { order: 'asc' } },
      fields: {
        ...(filters.activeOnly ? { where: { active: true } } : {}),
        orderBy: { order: 'asc' },
      },
    },
  })
}
```

**Novos métodos a adicionar:**
```typescript
// Contar fichas personalizadas ativas por cliente
async countActiveCustomerSheets(clinicId: string, customerId: string): Promise<number> {
  return prisma.measurementSheet.count({
    where: { clinicId, customerId, scope: 'CUSTOMER', active: true },
  })
}

// Verificar nome duplicado dentro de um cliente
async findSheetByNameForCustomer(clinicId: string, customerId: string, name: string) {
  return prisma.measurementSheet.findFirst({
    where: {
      clinicId,
      customerId,
      scope: 'CUSTOMER',
      name: { equals: name, mode: 'insensitive' },
    },
  })
}

// Copiar template como nova ficha (TABULAR ou SIMPLE) — transação atômica
async copyTemplateAsSheet(
  clinicId: string,
  template: MeasurementTemplate,
  name: string,
) {
  return prisma.$transaction(async (tx) => {
    const sheet = await tx.measurementSheet.create({
      data: {
        clinicId,
        name,
        type: template.type,
        category: template.category,
        scope: 'SYSTEM',
        order: 0,
      },
    })

    if (template.type === 'SIMPLE') {
      await tx.measurementField.createMany({
        data: template.fields.map((fieldName, index) => ({
          sheetId: sheet.id,
          clinicId,
          name: fieldName,
          inputType: 'INPUT',
          order: index,
          active: true,
        })),
      })
    } else {
      // TABULAR: criar colunas e campos (linhas)
      await tx.measurementSheetColumn.createMany({
        data: template.columns.map((colName, index) => ({
          sheetId: sheet.id,
          name: colName,
          inputType: 'INPUT',
          order: index,
        })),
      })
      await tx.measurementField.createMany({
        data: template.rows.map((rowName, index) => ({
          sheetId: sheet.id,
          clinicId,
          name: rowName,
          inputType: 'INPUT',
          order: index,
          active: true,
        })),
      })
    }

    return tx.measurementSheet.findFirst({
      where: { id: sheet.id },
      include: {
        columns: { orderBy: { order: 'asc' } },
        fields: { orderBy: { order: 'asc' } },
      },
    })
  })
}
```

### 4.5 measurement-sheets.routes.ts — Mudanças

**Ordem obrigatória de registro (Fastify):**
As rotas estáticas `/templates` e `/templates/:id/copy` devem ser registradas **antes** da rota dinâmica `/:id`. Violação desta ordem faz o Fastify tratar `templates` como parâmetro `id`.

```typescript
// ─── Fichas ──────────────────────────────────────────────────────────────────

// GET /measurement-sheets/templates — ANTES de /:id
app.get('/measurement-sheets/templates', { preHandler: [jwtClinicGuard] }, ...)

// POST /measurement-sheets/templates/:id/copy — ANTES de /:id
app.post('/measurement-sheets/templates/:id/copy', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, ...)

// GET /measurement-sheets
app.get('/measurement-sheets', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
  const q = ListSheetsQuery.parse(req.query)
  return reply.send(await svc.listSheets(req.clinicId, q))
})

// POST /measurement-sheets — SEM roleGuard fixo (verificação é no service, baseada em scope)
app.post('/measurement-sheets', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
  const dto = CreateSheetDto.parse(req.body)
  return reply
    .status(201)
    .send(await svc.createSheet(req.clinicId, req.user.sub, req.user.role, dto))
})

// PATCH /measurement-sheets/:id — SEM roleGuard fixo (verificação é no service, baseada em scope)
app.patch('/measurement-sheets/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
  const { id } = req.params as { id: string }
  const dto = UpdateSheetDto.parse(req.body)
  return reply.send(await svc.updateSheet(id, req.clinicId, req.user.sub, req.user.role, dto))
})

// DELETE /measurement-sheets/:id — mantém roleGuard(['admin'])
app.delete('/measurement-sheets/:id', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, ...)
```

> ⚠️ O `roleGuard(['admin'])` que existia no `POST /measurement-sheets` e no `PATCH /measurement-sheets/:id` deve ser **removido** — a lógica passa ao service para suportar o critério variável por scope.

### 4.6 measurement-sessions.service.ts — Campo `categories`

Em `listSessions()`, após buscar os dados do repositório, mapear o campo `categories` a partir das fichas vinculadas:

```typescript
async listSessions(clinicId: string, q: ListSessionsQuery) {
  const customer = await this.repo.findCustomerInClinic(q.customerId, clinicId)
  if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

  const result = await this.repo.listSessions(clinicId, q)

  // Computar categories por sessão a partir das fichas vinculadas
  const items = result.items.map((session) => {
    const categories = [
      ...new Set(
        session.sheetRecords
          .map((sr) => sr.sheet?.category)
          .filter(Boolean),
      ),
    ]
    return { ...session, categories }
  })

  return { ...result, items }
}
```

> Nota: `SESSION_INCLUDE` já inclui `sheet: { select: { id, name } }` — precisará incluir também `category` no select. Adicionar `category: true` ao select do `sheet` em `SESSION_INCLUDE` no repository.

**`SESSION_INCLUDE` — atualização mínima no repository:**
```typescript
sheet: { select: { id: true, name: true, category: true } },  // adicionar category: true
```

### 4.7 appointments.repository.ts — Método existsConfirmed (NOVO)

Adicionar ao final da classe `AppointmentsRepository`:

```typescript
async existsConfirmed(params: {
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

> Modificação mínima e READ-ONLY. Não altera nenhuma lógica existente de agendamentos.
> Verificar o nome dos valores do enum `AppointmentStatus` no schema Prisma antes de implementar — garantir que os valores `confirmed`, `in_progress`, `completed` correspondem exatamente ao enum persistido.

---

## 5. Fluxo de Dados

### Criar ficha do sistema (admin)
```
POST /measurement-sheets { scope: 'SYSTEM', category: 'FACIAL', ... }
→ jwtClinicGuard valida JWT
→ CreateSheetDto.parse() valida body (refine: scope=SYSTEM não exige customerId)
→ MeasurementSheetsService.createSheet(clinicId, userId, role='admin', dto)
→ role=SYSTEM + role='admin' → passa
→ countActiveSheets() → < 20 → passa
→ findSheetByName() → null → passa
→ repo.createSheet() → Prisma INSERT
→ 201 MeasurementSheet
```

### Criar ficha personalizada (profissional)
```
POST /measurement-sheets { scope: 'CUSTOMER', customerId: 'uuid', ... }
→ jwtClinicGuard valida JWT (role='professional')
→ CreateSheetDto.parse() valida body (refine: customerId obrigatório)
→ MeasurementSheetsService.createSheet(clinicId, userId, role='professional', dto)
→ scope=CUSTOMER + role='professional'
  → countActiveCustomerSheets() → < 10 → passa
  → appointmentsRepo.existsConfirmed() → true → passa
→ findSheetByNameForCustomer() → null → passa
→ repo.createSheet() → Prisma INSERT
→ 201 MeasurementSheet
```

### Copiar template (admin)
```
POST /measurement-sheets/templates/tpl-perimetria/copy
→ jwtClinicGuard + roleGuard(['admin'])
→ MeasurementSheetsService.copyTemplate(clinicId, 'tpl-perimetria')
→ MEASUREMENT_TEMPLATES.find('tpl-perimetria') → encontrado
→ countActiveSheets() → < 20 → passa
→ resolveAvailableName(): 'Perimetria' livre? findSheetByName() → null → usa 'Perimetria'
→ repo.copyTemplateAsSheet() → prisma.$transaction(CREATE sheet + createMany fields)
→ 201 MeasurementSheet (com fields incluídos)
```

### Listar sessões (com categories)
```
GET /measurement-sessions?customerId=uuid
→ repo.listSessions() → retorna sessions com sheetRecords[].sheet.category
→ service mapeia categories = [...new Set(sheetRecords.map(sr => sr.sheet.category))]
→ { items: [..., { ...session, categories: ['DERMATO_FUNCIONAL', 'CORPORAL'] }], total, page, limit }
```

---

## 6. Regras de Negócio

- **RN-01**: `scope=CUSTOMER` exige `customerId` — validação dupla: Zod (`.refine`) + service
- **RN-02**: Máximo de 20 fichas do sistema ativas por clínica (`scope=SYSTEM`)
- **RN-03**: Máximo de 10 fichas personalizadas ativas por **cliente** por clínica (`scope=CUSTOMER`)
- **RN-04**: Profissional só pode criar ficha personalizada para cliente com agendamento `confirmed | in_progress | completed` — verificação obrigatória no service (não apenas no frontend)
- **RN-05**: `scope=SYSTEM` → somente admin pode criar ou editar
- **RN-06**: `scope=CUSTOMER` → criador (`createdByUserId`) ou admin podem editar
- **RN-07**: Campo `type` (`SIMPLE/TABULAR`) jamais mutável via PATCH — ausente do `UpdateSheetDto`
- **RN-08**: `category` é mutável a qualquer momento pelo admin
- **RN-09**: `clinicId` é sempre extraído do JWT — nunca aceito do body
- **RN-10**: Copiar template com nome duplicado na clínica → sufixo numérico (`"Perimetria 2"`, `"Perimetria 3"`)
- **RN-11**: Templates da biblioteca são globais e somente leitura (constante de código — sem persistência)
- **RN-12**: `categories` na response de sessões é computado no service, **sem alterar o schema** de `MeasurementSession`
- **RN-13**: `deleteSheet()` mantém comportamento existente — apenas admin, via `roleGuard` na rota (não precisa verificar scope)

---

## 7. Dependências e Riscos

**Dependências:**
- Schema Prisma deve ser atualizado (migration) antes de qualquer deploy
- `AppointmentsRepository.existsConfirmed()` deve existir antes que `MeasurementSheetsService.createSheet()` com `scope=CUSTOMER` e `role=professional` seja chamado
- Os valores corretos do enum `AppointmentStatus` no Prisma schema devem ser confirmados antes de implementar o filtro `status: { in: [...] }`

**Riscos identificados:**

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Remoção do `roleGuard(['admin'])` do POST | Se não verificado no service, qualquer autenticado poderia criar fichas do sistema | Verificação explícita no service: `if (scope === 'SYSTEM' && role !== 'admin') throw ForbiddenError` |
| Ordem das rotas em `routes.ts` | `GET /templates` interpretado como `GET /:id` com `id='templates'` | Registrar rotas estáticas obrigatoriamente antes de rotas dinâmicas (`/:id`) |
| Race condition em `copyTemplate` com nome duplicado | Dois admins copiando o mesmo template simultaneamente podem gerar nome igual | `@@unique([clinicId, name])` no schema garante rejeição no banco como última linha de defesa; service retorna `ConflictError` tratável |
| `existsConfirmed` sem índice para a tripla `(clinicId, professionalId, customerId, status)` | Query lenta em clínicas com alto volume | Verificar se índice existe; se não, adicionar `@@index([clinicId, professionalId, customerId])` ao model `Appointment` |
| `SESSION_INCLUDE` sem `category` no select de `sheet` | `categories` seria `undefined` em todas as sessões | Adicionar `category: true` ao select do `sheet` em `SESSION_INCLUDE` (único ponto de mudança no repositório de sessões) |

---

## 8. Definition of Done — Checklist

O `aesthera-implementador` deve marcar cada item ao concluir.

### Prisma / Banco
- [ ] Enums `MeasurementCategory` e `MeasurementScope` adicionados ao `schema.prisma`
- [ ] 4 novos campos + 2 relações adicionados ao model `MeasurementSheet`
- [ ] 2 novos índices adicionados ao model `MeasurementSheet`
- [ ] Migration gerada com `prisma migrate dev --name add-measurement-category-scope`
- [ ] Migration validada como não-destrutiva (fichas existentes preservam dados)
- [ ] `prisma generate` executado após migration

### DTOs
- [ ] `CreateSheetDto` com `category`, `scope`, `customerId` e `.refine()` de validação cruzada
- [ ] `UpdateSheetDto` com `category`; campo `type` **ausente**
- [ ] `ListSheetsQuery` com `scope`, `category`, `customerId`
- [ ] Constante `MAX_ACTIVE_CUSTOMER_SHEETS = 10` adicionada

### Service
- [ ] `listSheets()` repassa filtros de scope/category/customerId ao repository
- [ ] `createSheet()` aceita `userId` e `role`; aplica regras de scope, limite por cliente e vínculo de agendamento
- [ ] `updateSheet()` aceita `userId` e `role`; aplica verificação de scope na autorização
- [ ] `copyTemplate()` implementado com resolução de nome e `prisma.$transaction`
- [ ] `AppointmentsRepository` injetado no service (instância privada)

### Repository
- [ ] `createSheet()` persiste `category`, `scope`, `customerId`, `createdByUserId`
- [ ] `listSheets()` aceita e aplica todos os novos filtros
- [ ] `countActiveCustomerSheets()` implementado
- [ ] `findSheetByNameForCustomer()` implementado
- [ ] `copyTemplateAsSheet()` implementado com `prisma.$transaction`
- [ ] `SESSION_INCLUDE` atualizado com `category: true` no select de `sheet`

### Routes
- [ ] `GET /measurement-sheets/templates` registrado **antes** de `/:id`
- [ ] `POST /measurement-sheets/templates/:id/copy` registrado **antes** de `PATCH /:id`
- [ ] `POST /measurement-sheets` sem `roleGuard(['admin'])` fixo (removido)
- [ ] `PATCH /measurement-sheets/:id` sem `roleGuard(['admin'])` fixo (removido)
- [ ] `POST` e `PATCH` passam `req.user.sub` e `req.user.role` ao service

### Arquivo de templates
- [ ] `measurement-templates.ts` criado com os 6 templates listados na spec
- [ ] Tipagem discriminada por `type: 'SIMPLE' | 'TABULAR'` implementada

### Appointments
- [ ] `existsConfirmed()` adicionado ao `AppointmentsRepository`
- [ ] Enum `AppointmentStatus` verificado no schema — valores `confirmed`, `in_progress`, `completed` confirmados

### Sessions
- [ ] `listSessions()` no service retorna `categories: MeasurementCategory[]` por sessão
- [ ] `categories` computado via `Set` para deduplicar

### Testes
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` sem `customerId` → 400
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` por profissional sem agendamento → 403
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` por profissional com agendamento `confirmed` → 201
- [ ] `PATCH /measurement-sheets/:id` com `scope=SYSTEM` por staff → 403
- [ ] `PATCH /measurement-sheets/:id` com `scope=CUSTOMER` pelo criador → 200
- [ ] `PATCH /measurement-sheets/:id` com `scope=CUSTOMER` por outro usuário não-admin → 403
- [ ] `PATCH /measurement-sheets/:id` enviando campo `type` → ignorado (Zod descarta campo desconhecido)
- [ ] `GET /measurement-sheets?scope=CUSTOMER&customerId=X` com clinicId de outra clínica → retorna vazio
- [ ] `POST /measurement-sheets/templates/:id/copy` por staff → 403
- [ ] `POST /measurement-sheets/templates/:id/copy` por admin → 201 com `clinicId` do JWT
- [ ] Copiar mesmo template duas vezes → segundo com sufixo numérico no nome
- [ ] `listSessions` retorna `categories` por sessão corretamente
- [ ] Migration não-destrutiva verificada (fichas com category=CORPORAL, scope=SYSTEM)

### Geral
- [ ] Sem `console.log` ou `TODO` irresolvido
- [ ] `PLAN.md` do projeto atualizado

---

## 9. Notas para o Implementador

1. **`request.user.sub`** é o userId no JWT do Aesthera — usar `req.user.sub` para obter o ID do usuário autenticado nas rotas Fastify.

2. **Verificar valores do enum `AppointmentStatus`** no `schema.prisma` antes de implementar `existsConfirmed()`. O Prisma rejeitará valores de enum que não existam no schema.

3. **`UpdateSheetDto` e o campo `type`**: o Zod por padrão **ignora** campos desconhecidos (`strip` mode). Adicionar `.strict()` ao `UpdateSheetDto` se quiser rejeitar explicitamente com erro 400. A issue pede "ignorado/rejeitado (400)" — usar `.strict()` para rejeitar.

4. **Remover `roleGuard(['admin'])` do `POST /measurement-sheets`**: esta mudança é intencional e necessária para suportar a criação de fichas personalizadas por profissionais. A verificação ocorre no service com mais granularidade.

5. **`resolveAvailableName()` usa queries N+1**: para evitar lentidão, limitar o loop a 99 iterações e usar `findSheetByName()` que já existe. Em produção, um único query `LIKE 'Perimetria%'` seria mais eficiente, mas a implementação simples é adequada para o MVP.

6. **Nomes das fichas personalizadas vs. do sistema**: a constraint `@@unique([clinicId, name])` atual cobre todo o `clinicId`, mas com `scope=CUSTOMER` o nome deve ser único apenas dentro do cliente. Avaliar se a constraint única atual precisa ser relaxada ou se a validação por software no service é suficiente (há risco de race condition — protegido pela constraint de DB em `scope=SYSTEM`; para `scope=CUSTOMER`, a constraint precisaria ser `@@unique([clinicId, customerId, name])` com valor de `customerId` não-null).

   **Decisão recomendada:** manter `@@unique([clinicId, name])` para `scope=SYSTEM` e adicionar `@@unique([clinicId, customerId, name])` para `scope=CUSTOMER`. Como o Prisma não suporta constraint condicional, a validação de unicidade para `scope=CUSTOMER` fica no nível do service (camada de software).

7. **Fixtures de teste**: usar o padrão existente de `makeSheet()` e adicionar `makeSheet({ scope: 'CUSTOMER', customerId: 'cust-1', createdByUserId: 'user-1' })` para os novos cenários.
