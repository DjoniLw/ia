# Spec Técnica — [FICHAS DE AVALIAÇÃO EXPANDIDAS] 1/3 — Backend (#157)

**Issue:** #157
**Data:** 14/04/2026
**Módulo(s):** `measurement-sheets`, `measurement-sessions`, `appointments`
**Tipo:** Backend

---

## 1. Contexto

O módulo `measurement-sheets` existe e está em produção, servindo fichas de avaliação do tipo `SIMPLE` e `TABULAR` com escopo implícito de medidas corporais. Todos os registros atuais têm `category=CORPORAL` e `scope=SYSTEM` implicitamente — nenhum dado existente será perdido. Esta issue expande o modelo para suportar 6 categorias de avaliação (`MeasurementCategory`), fichas de escopo por cliente (`MeasurementScope=CUSTOMER`), uma biblioteca de 6 templates pré-definidos e autorização granular por role/scope. A listagem de sessões passa a incluir o campo `categories` de forma computada, sem alteração no schema de `MeasurementSession`.

---

## 2. Escopo da Implementação

### 2.1 Backend

**Arquivos a CRIAR:**
```
aesthera/apps/api/src/modules/measurement-sheets/measurement-templates.ts
  — Constante MEASUREMENT_TEMPLATES com os 6 modelos pré-definidos (separado do service, sem lógica de negócio)

aesthera/apps/api/prisma/migrations/{timestamp}_add-measurement-category-scope/migration.sql
  — Migration não-destrutiva: 2 enums + 4 campos + 2 índices + substituição da constraint de nome
```

**Arquivos a MODIFICAR:**
```
aesthera/apps/api/prisma/schema.prisma
  — 2 novos enums (MeasurementCategory, MeasurementScope) + 4 campos em MeasurementSheet
    + 2 novas relações (customer, createdBy) + substituição do @@unique por índices parciais (SQL raw)
    + relação measurementSheets adicionada ao User e ao Customer

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.dto.ts
  — CreateSheetDto: +category, +scope, +customerId, +createdByUserId + .refine() para scope=CUSTOMER
  — UpdateSheetDto: +category; campo type explicitamente AUSENTE (nunca permitido no PATCH)
  — ListSheetsQuery: +scope, +category, +customerId
  — SheetResponseDto: tipagem de retorno inclui category, scope, customerId

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.repository.ts
  — listSheets(): novo parâmetro { scope?, category?, customerId? } no where
  — countActiveSheets(): novo parâmetro scope + customerId para diferenciar limite SYSTEM×CUSTOMER
  — createSheet(): persistir category, scope, customerId, createdByUserId
  — updateSheet(): persistir category quando presente no DTO
  — findSheetByName(): scope-aware para checagem de duplicidade (SYSTEM vs CUSTOMER/customerId)
  — NOVO: existsConfirmedAppointment() — NÃO adicionar aqui; ver appointments.repository.ts

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.service.ts
  — createSheet(): lógica de autorização scope×role; verificação de vínculo de agendamento para professional
  — updateSheet(): autorização por scope e createdByUserId
  — listSheets(): repassar filtros scope, category, customerId
  — NOVO: listTemplates() + copyTemplate()

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.routes.ts
  — NOVOS: GET /measurement-sheets/templates + POST /measurement-sheets/templates/:id/copy
  — MODIF: GET /measurement-sheets (novos query params: scope, category, customerId)
  — MODIF: POST /measurement-sheets (guard de role movido para service; route mantém apenas JwtClinicGuard)
  — MODIF: PATCH /measurement-sheets/:id (guard de role removido da route; service cuida da autorização)
  — ⚠️ ORDEM OBRIGATÓRIA: /templates e /templates/:id/copy registradas ANTES de /:id

aesthera/apps/api/src/modules/appointments/appointments.repository.ts
  — NOVO método: existsConfirmedAppointment({ clinicId, professionalId, customerId, statusIn }) → boolean

aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.repository.ts
  — SESSION_INCLUDE: incluir category na seleção de sheet (select: { id, name, category })
  — listSessions() / createSession() / updateSession(): campo categories computado na transformação do retorno

aesthera/apps/api/src/modules/measurement-sheets/measurement-sheets.test.ts
  — Novos casos de teste (ver seção DoD Checklist)
```

**Nenhuma alteração necessária em:**
```
aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.dto.ts
  — Não alterar schema de sessão; categories é campo computado no retorno do service/repository
aesthera/apps/api/src/modules/measurement-sessions/measurement-sessions.service.ts
  — Apenas a query de include precisa de ajuste no repository; service não muda
aesthera/apps/api/prisma/schema.prisma (modelos MeasurementSession, MeasurementSheetRecord,
  MeasurementValue, MeasurementTabularValue) — sem alteração nesses modelos
Módulos billing, appointments (além do método existsConfirmedAppointment), anamnese, contratos
```

### 2.2 Banco de Dados

**Migração necessária:** Sim — não-destrutiva

A migration deve:
1. Criar os 2 enums (`MeasurementCategory`, `MeasurementScope`)
2. Adicionar as 4 colunas com `DEFAULT` para preservar dados existentes
3. Adicionar as 2 FK columns (`customer_id`, `created_by_user_id`) como nullable
4. Remover o índice/constraint `@@unique([clinicId, name])` existente
5. Criar dois índices parciais via SQL raw (não suportados pelo Prisma schema diretamente):
   - `CREATE UNIQUE INDEX measurement_sheets_clinic_name_system_unique ON measurement_sheets (clinic_id, name) WHERE scope = 'SYSTEM';`
   - `CREATE UNIQUE INDEX measurement_sheets_clinic_customer_name_unique ON measurement_sheets (clinic_id, customer_id, name) WHERE scope = 'CUSTOMER';`
6. Criar os 2 novos índices compostos de performance

```sql
-- Pseudocode da migration (gerado por prisma migrate dev + customização manual):

-- 1. Criar enums
CREATE TYPE "MeasurementCategory" AS ENUM (
  'CORPORAL', 'FACIAL', 'DERMATO_FUNCIONAL', 'NUTRICIONAL', 'POSTURAL', 'PERSONALIZADA'
);
CREATE TYPE "MeasurementScope" AS ENUM ('SYSTEM', 'CUSTOMER');

-- 2. Adicionar colunas com defaults (não-destrutivo)
ALTER TABLE "measurement_sheets"
  ADD COLUMN "category" "MeasurementCategory" NOT NULL DEFAULT 'CORPORAL',
  ADD COLUMN "scope" "MeasurementScope" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "customer_id" TEXT,
  ADD COLUMN "created_by_user_id" TEXT;

-- 3. Remover constraint de unicidade existente
DROP INDEX "measurement_sheets_clinic_id_name_key";  -- nome gerado pelo Prisma

-- 4. Criar índices parciais de unicidade por scope
CREATE UNIQUE INDEX "measurement_sheets_clinic_name_system_unique"
  ON "measurement_sheets" ("clinic_id", "name")
  WHERE scope = 'SYSTEM';

CREATE UNIQUE INDEX "measurement_sheets_clinic_customer_name_unique"
  ON "measurement_sheets" ("clinic_id", "customer_id", "name")
  WHERE scope = 'CUSTOMER';

-- 5. Índices de performance
CREATE INDEX "measurement_sheets_clinic_scope_active" ON "measurement_sheets" ("clinic_id", "scope", "active");
CREATE INDEX "measurement_sheets_clinic_customer" ON "measurement_sheets" ("clinic_id", "customer_id");

-- 6. FKs
ALTER TABLE "measurement_sheets"
  ADD CONSTRAINT "measurement_sheets_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "measurement_sheets"
  ADD CONSTRAINT "measurement_sheets_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

> ⚠️ **Atenção ao nome exato do índice:** O Prisma gera automaticamente o nome da constraint `@@unique` como `{tabela}_{campo1}_{campo2}_key`. Verificar no banco antes de gerar a migration para usar o nome exato no `DROP INDEX`.

> ⚠️ **Partial indexes no Prisma schema:** Não usar `@@unique` no schema para esses índices — usar apenas `@@index` para os índices de performance. Os índices parciais de unicidade residem exclusivamente na migration SQL. O Prisma não sabe sobre eles; a proteção de race condition é garantida pelo banco.

---

## 3. Contratos de API

### 3.1 GET /measurement-sheets

```
GET /measurement-sheets

Query Params:
  includeInactive: boolean (opcional, default false)
  scope: 'SYSTEM' | 'CUSTOMER' (opcional)
  category: 'CORPORAL' | 'FACIAL' | 'DERMATO_FUNCIONAL' | 'NUTRICIONAL' | 'POSTURAL' | 'PERSONALIZADA' (opcional)
  customerId: string UUID (opcional; obrigatório quando scope=CUSTOMER)

Response (200):
  Array<{
    id: string
    clinicId: string
    name: string
    type: 'SIMPLE' | 'TABULAR'
    category: MeasurementCategory
    scope: MeasurementScope
    customerId: string | null
    active: boolean
    order: number
    createdAt: string (ISO)
    updatedAt: string (ISO)
    columns: MeasurementSheetColumn[]
    fields: MeasurementField[]
  }>

Erros:
  401 — não autenticado
  403 — clinicId diferente do JWT (CROSS_TENANT_VIOLATION)

Auth: Obrigatório (JwtClinicGuard)
Role: qualquer usuário autenticado da clínica
Guard de tenant (clinic_id): Sim — extraído do JWT, NUNCA do body/query
```

> ⚠️ O `clinicId` é sempre o do JWT. O `customerId` no query é apenas um filtro adicional — nunca permite acessar fichas de outra clínica.

---

### 3.2 POST /measurement-sheets

```
POST /measurement-sheets

Request Body:
  name: string (min 1, max 100) — obrigatório
  type: 'SIMPLE' | 'TABULAR' — opcional, default 'SIMPLE'
  category: MeasurementCategory — opcional, default 'CORPORAL'
  scope: MeasurementScope — opcional, default 'SYSTEM'
  customerId: string UUID — obrigatório quando scope='CUSTOMER'
  order: number int ≥ 0 — opcional

Validação Zod (.refine()):
  scope='CUSTOMER' → customerId NOT NULL
  Mensagem: 'customerId é obrigatório para fichas personalizadas'
  Path: ['customerId']

Response (201): MeasurementSheet (mesmo formato de GET, sem fields/columns ainda)

Erros:
  400 — scope=CUSTOMER sem customerId
  403 — scope=SYSTEM por role não-admin
  403 — scope=CUSTOMER por professional sem agendamento confirmado com o customerId
  409 — nome duplicado na clínica (para o mesmo scope/customerId)
  422 — limite de fichas ativas atingido (MAX_ACTIVE_SHEETS=20 para SYSTEM, 10 para CUSTOMER)

Auth: Obrigatório (JwtClinicGuard)
Role: admin para scope=SYSTEM; admin|staff|professional para scope=CUSTOMER
       (diferença de autorização tratada no SERVICE, não na route)
Guard de tenant (clinic_id): Sim
```

---

### 3.3 PATCH /measurement-sheets/:id

```
PATCH /measurement-sheets/:id

Request Body:
  name: string (min 1, max 100) — opcional
  category: MeasurementCategory — opcional (mutável a qualquer momento)
  order: number int ≥ 0 — opcional
  active: boolean — opcional
  ⛔ type: AUSENTE do schema Zod (omitir — nunca permitir alteração de type pós-criação)

Response (200): MeasurementSheet completa (com fields e columns)

Erros:
  400 — type enviado no body → rejeitar (z.never() ou .strip() + warning); ou simplesmente omitir do schema (automaticamente ignorado pelo Zod z.object())
  403 — scope=SYSTEM por role não-admin
  403 — scope=CUSTOMER por usuário que não é o criador (createdByUserId) nem admin
  404 — id não encontrado
  409 — nome duplicado

Auth: Obrigatório (JwtClinicGuard)
Role: verificação de scope×createdByUserId no service
Guard de tenant (clinic_id): Sim
```

> **Nota sobre `type`:** A abordagem mais segura é simplesmente **não incluir `type` no UpdateSheetDto** (Zod descarta campos desconhecidos por padrão com `.strip()`). Não é necessário `z.never()`.

---

### 3.4 GET /measurement-sheets/templates

```
GET /measurement-sheets/templates

Response (200):
  Array<{
    id: string                          — identificador do template (ex: 'tpl-perimetria')
    name: string                        — nome localizado em PT-BR
    category: MeasurementCategory
    type: 'SIMPLE' | 'TABULAR'
    fields?: string[]                   — apenas para type=SIMPLE (nomes dos campos)
    rows?: string[]                     — apenas para type=TABULAR (linhas)
    columns?: string[]                  — apenas para type=TABULAR (colunas/cabeçalhos)
  }>

Erros:
  401 — não autenticado

Auth: Obrigatório (JwtClinicGuard)
Role: qualquer usuário autenticado
Guard de tenant (clinic_id): Não — templates são globais ao sistema
```

> Resposta derivada diretamente da constante `MEASUREMENT_TEMPLATES`; sem query ao banco.

---

### 3.5 POST /measurement-sheets/templates/:id/copy

```
POST /measurement-sheets/templates/:id/copy

Path Params:
  id: string — identificador do template (ex: 'tpl-perimetria')

Request Body: vazio (clinicId extraído do JWT, NUNCA do body)

Response (201):
  {
    sheet: MeasurementSheet (com fields e columns)
    name: string               — nome final (pode ter sufixo numérico se houve duplicidade)
    copiedFromTemplateId: string
  }

Erros:
  403 — role não-admin
  404 — templateId não encontrado na constante MEASUREMENT_TEMPLATES
  422 — limite de 20 fichas SYSTEM ativas atingido

Auth: Obrigatório (JwtClinicGuard + RoleGuard(['admin']))
Role: admin
Guard de tenant (clinic_id): Sim — extraído do JWT
```

**Lógica de deduplicação de nome:**
- Verificar se já existe ficha com `scope=SYSTEM` e `name=template.name` na clínica
- Se existir: tentar `name + ' 2'`, depois `' 3'`, etc. (até encontrar disponível ou limite razoável de 99)
- Toda a operação em `prisma.$transaction()`

---

## 4. Modelo de Dados

### 4.1 Schema Prisma atualizado (MeasurementSheet)

```prisma
// Novos enums — adicionar antes do model MeasurementSheet
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

model MeasurementSheet {
  id        String               @id @default(uuid())
  clinicId  String               @map("clinic_id")
  name      String
  type      MeasurementSheetType @default(SIMPLE)
  category  MeasurementCategory  @default(CORPORAL) @map("category")
  scope     MeasurementScope     @default(SYSTEM)   @map("scope")
  customerId      String?  @map("customer_id")
  createdByUserId String?  @map("created_by_user_id")
  active    Boolean              @default(true)
  order     Int                  @default(0)
  createdAt DateTime             @default(now()) @map("created_at")
  updatedAt DateTime             @updatedAt @map("updated_at")

  clinic       Clinic                   @relation(fields: [clinicId], references: [id])
  customer     Customer?                @relation(fields: [customerId], references: [id], onDelete: Restrict)
  createdBy    User?                    @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)
  fields       MeasurementField[]
  columns      MeasurementSheetColumn[]
  sheetRecords MeasurementSheetRecord[]

  // @@unique([clinicId, name]) — REMOVIDO; substituído por índices parciais na migration SQL
  @@index([clinicId, active, order])       // existente — mantido
  @@index([clinicId, scope, active])       // NOVO — performance em listagens por scope
  @@index([clinicId, customerId])          // NOVO — performance em fichas por cliente
  @@map("measurement_sheets")
}
```

> ⚠️ **Relações inversas obrigatórias:** Os modelos `User` e `Customer` precisam das relações inversas para o Prisma gerar os tipos corretamente:
>
> ```prisma
> // Em model User — adicionar:
> measurementSheets  MeasurementSheet[] @relation("CreatedByUser")
>
> // Em model Customer — adicionar:
> measurementSheets  MeasurementSheet[]
> ```
>
> Usar `@relation("CreatedByUser")` no `MeasurementSheet.createdBy` e `User.measurementSheets` para evitar ambiguidade, pois `User` já tem outras relações.

### 4.2 Impacto em dados existentes

| Campo | Comportamento nos registros existentes |
|-------|---------------------------------------|
| `category` | Todos recebem `CORPORAL` (default da migration) |
| `scope` | Todos recebem `SYSTEM` (default da migration) |
| `customerId` | NULL (nullable — sem FK obrigatória) |
| `createdByUserId` | NULL (nullable — não retroativo) |

**Migration é 100% não-destrutiva**: nenhum dado é perdido, nenhuma query existente quebra.

---

## 5. Autorização

### 5.1 Matriz de autorização por endpoint

| Endpoint | admin | staff | professional | Observação |
|----------|-------|-------|--------------|------------|
| `GET /measurement-sheets/templates` | ✅ | ✅ | ✅ | Sem verificação de role |
| `POST /measurement-sheets/templates/:id/copy` | ✅ | ❌ | ❌ | RoleGuard na route |
| `GET /measurement-sheets` | ✅ | ✅ | ✅ | Filtros scope/category/customerId disponíveis |
| `POST /measurement-sheets` com `scope=SYSTEM` | ✅ | ❌ | ❌ | Verificação no service |
| `POST /measurement-sheets` com `scope=CUSTOMER` | ✅ | ✅ | ⚠️ | professional: verificar agendamento no service |
| `PATCH /measurement-sheets/:id` com `scope=SYSTEM` | ✅ | ❌ | ❌ | Verificação no service |
| `PATCH /measurement-sheets/:id` com `scope=CUSTOMER` | ✅ | ⚠️ | ⚠️ | Apenas criador (`createdByUserId`) ou admin |
| `DELETE /measurement-sheets/:id` | ✅ | ❌ | ❌ | Comportamento existente mantido |

### 5.2 Verificação de vínculo de agendamento (professional + scope=CUSTOMER)

Implementar no `MeasurementSheetsService.createSheet()`, chamando `AppointmentsRepository.existsConfirmedAppointment()`:

```typescript
// AppointmentsRepository — novo método:
async existsConfirmedAppointment(params: {
  clinicId: string
  professionalId: string
  customerId: string
  statusIn: AppointmentStatus[]
}): Promise<boolean> {
  const count = await prisma.appointment.count({
    where: {
      clinicId: params.clinicId,
      professionalId: params.professionalId,
      customerId: params.customerId,
      status: { in: params.statusIn },
    },
  })
  return count > 0
}

// MeasurementSheetsService.createSheet() — trecho da lógica:
if (dto.scope === 'CUSTOMER' && userRole === 'professional') {
  const hasAppointment = await this.appointmentsRepo.existsConfirmedAppointment({
    clinicId,
    professionalId: authenticatedUserId,
    customerId: dto.customerId!,
    statusIn: ['confirmed', 'in_progress', 'completed'],
  })
  if (!hasAppointment) {
    throw new ForbiddenError('Você não tem agendamento confirmado com este cliente.')
  }
}
```

> ⚠️ O `MeasurementSheetsService` precisará receber `AppointmentsRepository` como dependência (injeção manual no construtor ou importação direta — consistente com o padrão atual do projeto onde services instanciam repositories diretamente).

### 5.3 Regras de autorização no update (scope=CUSTOMER)

```typescript
// MeasurementSheetsService.updateSheet():
if (sheet.scope === 'SYSTEM' && userRole !== 'admin') {
  throw new ForbiddenError('Apenas administradores podem editar fichas do sistema.')
}
if (sheet.scope === 'CUSTOMER' && userRole !== 'admin' && sheet.createdByUserId !== authenticatedUserId) {
  throw new ForbiddenError('Você só pode editar fichas criadas por você.')
}
```

### 5.4 Limites de fichas ativas

| Tipo | Limite | Escopo |
|------|--------|--------|
| `scope=SYSTEM` | 20 fichas ativas | por clínica |
| `scope=CUSTOMER` | 10 fichas ativas | por cliente por clínica |

O `countActiveSheets()` no repository precisa ser atualizado para aceitar `{ clinicId, scope, customerId? }`.

---

## 6. Templates

### 6.1 Arquivo measurement-templates.ts

```
Localização: aesthera/apps/api/src/modules/measurement-sheets/measurement-templates.ts
```

O arquivo deve exportar:
- A constante `MEASUREMENT_TEMPLATES` (array `as const`)
- Um tipo `MeasurementTemplate` derivado do array
- Uma função helper `findTemplateById(id: string): MeasurementTemplate | undefined`

### 6.2 Templates a implementar

| id | name | category | type | fields | rows | columns |
|----|------|----------|------|--------|------|---------|
| `tpl-perimetria` | Perimetria | CORPORAL | SIMPLE | Cintura, Abdome, Quadril, Braço D, Braço E, Coxa D, Coxa E | — | — |
| `tpl-bioimpedancia` | Bioimpedância | CORPORAL | SIMPLE | Peso, Altura, % Gordura, Massa Muscular, Massa Óssea, Água Corporal | — | — |
| `tpl-condicao-estetica` | Condição Estética | DERMATO_FUNCIONAL | TABULAR | — | Braços, Costas, Axilares, Flancos, Abdome, Glúteos, Culotes | FEG I, FEG II, FEG III, Adiposidade, Dura/Mole, Flacidez Muscular/Tissular, Estrias Brancas, Estrias Vermelhas, Varicose |
| `tpl-firmeza-tissular` | Firmeza Tissular | DERMATO_FUNCIONAL | TABULAR | — | Braços, Abdome, Flancos, Glúteos, Coxas | Grau 1, Grau 2, Grau 3, Grau 4 |
| `tpl-avaliacao-facial` | Avaliação Facial | FACIAL | SIMPLE | Fototipo Fitzpatrick, Tipo de Pele, Oleosidade, Sensibilidade, Manchas, Rugas | — | — |
| `tpl-postural` | Avaliação Postural | POSTURAL | SIMPLE | Joelhos (valgo/varo), Coluna, Ombros, Quadril, Pelve | — | — |

### 6.3 Estrutura discriminada do tipo de template

```typescript
type SimpleTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: 'SIMPLE'
  fields: readonly string[]
}

type TabularTemplate = {
  id: string
  name: string
  category: MeasurementCategory
  type: 'TABULAR'
  rows: readonly string[]
  columns: readonly string[]
}

type MeasurementTemplate = SimpleTemplate | TabularTemplate
```

### 6.4 Lógica de cópia de template (copyTemplate no service)

```
1. Localizar template por id → NotFoundException se não encontrado
2. Verificar limite de 20 fichas SYSTEM ativas → ValidationError se atingido
3. Identificar nome disponível:
   a. Tentar template.name
   b. Se existir: tentar `${name} 2`, `${name} 3`... até achar disponível (máx 99 tentativas)
4. Em prisma.$transaction():
   a. Criar MeasurementSheet com name disponível + category + type + scope=SYSTEM + clinicId do JWT
   b. Se type=SIMPLE: criar MeasurementField[] para cada item de template.fields
   c. Se type=TABULAR:
      - Criar MeasurementField[] para cada item de template.rows
      - Criar MeasurementSheetColumn[] para cada item de template.columns
5. Retornar { sheet: MeasurementSheet (com fields e columns), name, copiedFromTemplateId }
```

---

## 7. Integração com Sessions

### 7.1 Campo `categories` na response de listagem

O campo `categories: MeasurementCategory[]` é **computado** a partir das fichas da sessão — não armazenado no banco.

**Modificação necessária em `measurement-sessions.repository.ts`:**

```typescript
// SESSION_INCLUDE atualizado — incluir category na seleção de sheet:
const SESSION_INCLUDE = {
  sheetRecords: {
    include: {
      sheet: { select: { id: true, name: true, category: true } },  // ← adicionar category
      // ... restante sem alteração
    }
  }
  // ...
}
```

**Transformação no retorno do repository (ou service):**

```typescript
// Função utilitária a ser aplicada em listSessions/createSession/updateSession:
function mapSessionWithCategories(session: SessionWithIncludes) {
  const categories = [
    ...new Set(session.sheetRecords.map((sr) => sr.sheet.category))
  ] as MeasurementCategory[]

  return { ...session, categories }
}
```

> ⚠️ **Não alterar o schema `MeasurementSession`** — `categories` é apenas um campo virtual na response. O schema Prisma não precisa mudar.

### 7.2 Impacto em endpoints existentes de sessions

| Endpoint | Mudança |
|----------|---------|
| `GET /measurement-sessions?customerId=X` | Passa a retornar `categories` em cada sessão |
| `POST /measurement-sessions` | Retorno passa a incluir `categories` |
| `PATCH /measurement-sessions/:id` | Retorno passa a incluir `categories` |

> A adição de `categories` é **backward compatible** (campo novo na response — clientes existentes ignoram).

---

## 8. Fluxo de Dados

### 8.1 POST /measurement-sheets (scope=CUSTOMER, role=professional)

```
Professional faz POST /measurement-sheets
  → JwtClinicGuard: extrai clinicId, userId, userRole do JWT
  → MeasurementSheetsRoutes: parse DTO → CreateSheetDto.parse(req.body)
  → MeasurementSheetsService.createSheet(clinicId, userId, userRole, dto):
      1. Zod .refine(): scope=CUSTOMER → customerId NOT NULL
      2. Limite CUSTOMER: countActiveSheets({ clinicId, scope: 'CUSTOMER', customerId }) < 10
      3. Role check: scope=SYSTEM → role must be admin
      4. Vínculo de agendamento: role=professional → existsConfirmedAppointment()
      5. Nome único: findSheetByName(clinicId, dto.name, scope, customerId)
      6. createSheet() no repository
  ← 201 MeasurementSheet
```

### 8.2 POST /measurement-sheets/templates/:id/copy

```
Admin faz POST /measurement-sheets/templates/tpl-perimetria/copy
  → JwtClinicGuard: extrai clinicId do JWT
  → RoleGuard(['admin']): verifica role
  → MeasurementSheetsRoutes: extrai templateId do path
  → MeasurementSheetsService.copyTemplate(clinicId, templateId):
      1. findTemplateById(templateId) → 404 se não encontrado
      2. countActiveSheets({ clinicId, scope: 'SYSTEM' }) < 20
      3. Encontrar nome disponível (loop de sufixo numérico)
      4. prisma.$transaction(): criar sheet + fields/columns
  ← 201 { sheet, name, copiedFromTemplateId }
```

---

## 9. Dependências e Riscos

### Dependências

- `AppointmentsRepository` deve existir e ser acessível ao `MeasurementSheetsService` (já existe em `appointments.repository.ts`)
- O enum `AppointmentStatus` do Prisma deve incluir os valores `confirmed`, `in_progress`, `completed` (já existem no schema atual)
- O modelo `Customer` deve existir com FK para `MeasurementSheet` (Customer já existe; a relação inversa é nova)
- O modelo `User` deve aceitar a relação inversa `measurementSheets` (User já existe)

### Riscos identificados

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `@@unique([clinicId, name])` existente quebra a migration | Alto — migration falha | Verificar nome exato da constraint no banco antes de gerar migration; `DROP INDEX` com nome correto |
| Índices parciais não declarados no schema Prisma | Médio — Prisma desconhece e pode tentar recriar em future migrations | Documentar na migration com comentário; adicionar `@@ignore` ou anotar no prisma.schema |
| `countActiveSheets` filtrando scope=SYSTEM não considera fichas CUSTOMER | Médio — limite errado aplicado | Atualizar `countActiveSheets` para receber `{ scope, customerId? }` como parâmetro |
| `SESSION_INCLUDE` quebra compilação TypeScript após adicionar `category` | Baixo — erro de tipo | Atualizar tipo do include e ajustar mapeamento; garantir que `mapSessionWithCategories` não quebre sessions sem sheetRecords |
| Race condition em insert duplicado de nome | Baixo — unique index parcial no banco | Os índices parciais da migration garantem integridade em nível de banco |
| `professional` autentica via JWT diferente de `User` | A verificar — `ProfessionalAuth` é modelo separado | Confirmar se o JWT de professional inclui `professionalId` e como `MeasurementSheetsService` recebe esse ID para a query de agendamento |

> ⚠️ **Risco crítico — autenticação de professional:** O modelo `Professional` tem `ProfessionalAuth` separado de `User`. Verificar se o `jwtClinicGuard` retorna `professionalId` ou `userId` no request, e ajustar a chamada de `existsConfirmedAppointment()` para usar o campo correto. Se o JWT de professional expõe `id` como `professionalId`, o campo no guard é diferente do `userId` de um `User`.

---

## 10. DoD Checklist

O `aesthera-implementador` deve marcar cada item ao concluir.

### Schema e Migration

- [ ] Enums `MeasurementCategory` e `MeasurementScope` criados no schema Prisma
- [ ] 4 campos adicionados a `MeasurementSheet` com defaults corretos (`CORPORAL`, `SYSTEM`, null, null)
- [ ] Relações `customer` e `createdBy` adicionadas a `MeasurementSheet`
- [ ] Relações inversas adicionadas a `User` e `Customer`
- [ ] `@@unique([clinicId, name])` removido do schema
- [ ] Migration gerada com `prisma migrate dev --name add-measurement-category-scope`
- [ ] Migration modificada manualmente para: `DROP INDEX` existente + 2 `CREATE UNIQUE INDEX ... WHERE`
- [ ] Migration executada com sucesso em ambiente de dev
- [ ] Verificado: nenhuma ficha existente perdida; todas com `category=CORPORAL`, `scope=SYSTEM`

### DTOs

- [ ] `CreateSheetDto` com campos `category`, `scope`, `customerId`, `createdByUserId`
- [ ] `.refine()` implementado: `scope='CUSTOMER' → customerId NOT NULL`
- [ ] `UpdateSheetDto` sem campo `type` (omitido do schema Zod)
- [ ] `UpdateSheetDto` com campo `category` como mutável
- [ ] `ListSheetsQuery` com filtros `scope`, `category`, `customerId`

### Repository

- [ ] `listSheets()` aplica filtros `scope`, `category`, `customerId` no where
- [ ] `countActiveSheets()` atualizado para receber `scope` e `customerId`
- [ ] `createSheet()` persiste `category`, `scope`, `customerId`, `createdByUserId`
- [ ] `updateSheet()` persiste `category`
- [ ] `findSheetByName()` scope-aware (diferencia SYSTEM vs CUSTOMER)
- [ ] `AppointmentsRepository.existsConfirmedAppointment()` criado

### Service

- [ ] `createSheet()` verifica role para scope=SYSTEM (ForbiddenError se não-admin)
- [ ] `createSheet()` chama `existsConfirmedAppointment` para professional + scope=CUSTOMER
- [ ] `createSheet()` limite separado: 20 SYSTEM × 10 CUSTOMER
- [ ] `createSheet()` armazena `createdByUserId = authenticatedUserId`
- [ ] `updateSheet()` verifica scope=SYSTEM → role=admin
- [ ] `updateSheet()` verifica scope=CUSTOMER → criador ou admin
- [ ] `listTemplates()` retorna `MEASUREMENT_TEMPLATES` formatado
- [ ] `copyTemplate()` implementado com deduplicação de nome e `prisma.$transaction()`

### Routes

- [ ] `GET /measurement-sheets/templates` registrado ANTES de `/:id`
- [ ] `POST /measurement-sheets/templates/:id/copy` registrado ANTES de `/:id`
- [ ] `GET /measurement-sheets` aceita query params `scope`, `category`, `customerId`
- [ ] `POST /measurement-sheets` com `JwtClinicGuard` apenas (sem roleGuard na route — no service)
- [ ] `PATCH /measurement-sheets/:id` com `JwtClinicGuard` apenas (sem roleGuard na route — no service)
- [ ] Parâmetros `authenticatedUserId` e `userRole` extraídos do JWT e repassados ao service

### Templates

- [ ] `measurement-templates.ts` criado com 6 templates corretos
- [ ] Tipos `SimpleTemplate`, `TabularTemplate`, `MeasurementTemplate` exportados
- [ ] Helper `findTemplateById()` exportado
- [ ] Templates TABULAR têm `rows` e `columns` (não `fields`)
- [ ] Templates SIMPLE têm `fields` (não `rows`/`columns`)

### Integração com Sessions

- [ ] `SESSION_INCLUDE` inclui `category` na seleção de `sheet`
- [ ] `mapSessionWithCategories()` (ou equivalente) aplicado em todas as responses de sessão
- [ ] `GET /measurement-sessions` retorna `categories: MeasurementCategory[]` por sessão
- [ ] `POST /measurement-sessions` retorna `categories` na sessão criada

### Testes

- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` sem `customerId` → 400
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` por professional sem agendamento → 403
- [ ] `POST /measurement-sheets` com `scope=CUSTOMER` por professional com agendamento `confirmed` → 201
- [ ] `POST /measurement-sheets` com `scope=SYSTEM` por staff → 403
- [ ] `PATCH /measurement-sheets/:id` de ficha `scope=SYSTEM` por staff → 403
- [ ] `PATCH /measurement-sheets/:id` de ficha `scope=CUSTOMER` pelo criador → 200
- [ ] `PATCH /measurement-sheets/:id` de ficha `scope=CUSTOMER` por outro usuário não-admin → 403
- [ ] `PATCH /measurement-sheets/:id` enviando campo `type` → campo ignorado (não modifica o type original)
- [ ] `GET /measurement-sheets?scope=CUSTOMER&customerId=X` com clinicId de outra clínica → vazio
- [ ] `POST /measurement-sheets/templates/:id/copy` por staff → 403
- [ ] `POST /measurement-sheets/templates/:id/copy` por admin → 201 com `clinicId` do JWT (não do body)
- [ ] Copiar mesmo template duas vezes → segundo com sufixo numérico no nome
- [ ] Migration não-destrutiva: fichas existentes mantêm todos os dados + `category=CORPORAL`, `scope=SYSTEM`

### Geral

- [ ] Sem `console.log` ou debug no código
- [ ] Sem `TODO` não resolvido
- [ ] PLAN.md atualizado após conclusão

---

## 11. Notas para o Implementador

### 1. Ordem de registro de rotas no Fastify (crítico)

O Fastify resolve rotas em ordem de registro. A rota `/templates` e `/templates/:id/copy` **devem ser registradas antes** de `/:id`, caso contrário o Fastify interpreta a string `"templates"` como um valor do parâmetro `id`.

```typescript
// ✅ CORRETO — ordem de registro no routes.ts:
app.get('/measurement-sheets/templates', ...)           // 1º
app.post('/measurement-sheets/templates/:id/copy', ...) // 2º
app.post('/measurement-sheets/reorder', ...)            // 3º — já existe; manter antes de /:id
app.get('/measurement-sheets', ...)                     // 4º
app.post('/measurement-sheets', ...)                    // 5º
app.patch('/measurement-sheets/:id', ...)               // 6º
app.delete('/measurement-sheets/:id', ...)              // 7º
```

### 2. Índices parciais e Prisma Migrate (crítico)

O Prisma não tem suporte nativo a partial unique indexes no schema. Ao rodar `prisma migrate dev` após as mudanças no schema:
- O Prisma vai gerar uma migration sem os índices parciais
- É obrigatório **editar manualmente** o arquivo `migration.sql` gerado para:
  1. Adicionar `DROP INDEX "measurement_sheets_clinic_id_name_key"` (nome exato do índice atual)
  2. Adicionar os dois `CREATE UNIQUE INDEX ... WHERE scope = '...'`
- O índice `@@unique([clinicId, name])` deve ser **removido do schema.prisma** para que o Prisma não tente recriá-lo em migrations futuras
- Se o `prisma migrate dev` tentar recriar o índice em próximas migrations, usar `prisma migrate diff` para verificar e corrigir o `migration.sql` antes de aplicar

### 3. Autenticação de professional vs user

Verificar no `jwtClinicGuard` quais campos são adicionados ao `req` para profissionais. O `Professional` tem `ProfessionalAuth` separado de `User`. Se o JWT de professional não contém `userId` (mas sim `professionalId`), a query de `existsConfirmedAppointment()` deve usar `professionalId`. Verificar o payload exato do JWT em `auth.service.ts`.

### 4. AppointmentsRepository como dependência do MeasurementSheetsService

O padrão atual do projeto instancia repositories diretamente (ex.: `private repo = new MeasurementSheetsRepository()`). Seguir o mesmo padrão:

```typescript
import { AppointmentsRepository } from '../appointments/appointments.repository'

export class MeasurementSheetsService {
  private repo = new MeasurementSheetsRepository()
  private appointmentsRepo = new AppointmentsRepository()
  // ...
}
```

Não é necessário injeção de dependências para este projeto (sem IoC container).

### 5. Nomenclatura: routes vs controller

O projeto usa Fastify com `*routes.ts` — não existe controller. A issue menciona `measurement-sheets.controller.ts` mas o arquivo real é `measurement-sheets.routes.ts`. Manter nomenclatura existente.

### 6. Limite de fichas personalizadas (RN-08)

O limite de 10 fichas `scope=CUSTOMER` é **por cliente por clínica** (não global). A query deve ser:
```typescript
prisma.measurementSheet.count({
  where: { clinicId, scope: 'CUSTOMER', customerId: dto.customerId, active: true }
})
```

### 7. Deduplicação de nome em copyTemplate

A lógica de sufixo incremental deve ser implementada no service (não no banco). Limite razoável de 99 para evitar loop infinito em casos extremos. Se não houver nome disponível até `${name} 99`, lançar `ConflictError`.

### 8. Campo `categories` em sessions — performance

A derivação de `categories` usa dados já presentes no `SESSION_INCLUDE` — não gera queries adicionais. O `Set` garante deduplicação sem overhead relevante.
