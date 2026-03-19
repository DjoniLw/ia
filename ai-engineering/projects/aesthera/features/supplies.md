# Feature: Supplies

## Summary
Consumable supplies (insumos) catalog — track what materials are used per service, with stock control and service assignments.

---

## Data Model

```prisma
model Supply {
  id              String    @id @default(uuid())
  clinicId        String    -- FK → Clinic (tenant key)
  name            String    -- unique per clinic (case-insensitive)
  description     String?
  unit            String    @default("un")   -- measurement unit (un, ml, g, etc.)
  costPrice       Int?      -- BRL cents
  stock           Int       @default(0)
  minStock        Int       @default(0)      -- triggers low-stock alert when stock < minStock
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? -- soft delete
}

model ServiceSupply {
  id               String  @id @default(uuid())
  clinicId         String  -- FK → Clinic (tenant key)
  serviceId        String  -- FK → Service
  supplyId         String  -- FK → Supply
  quantity         Float   -- how much of the supply is used per service session
  usageUnit        String? -- optional override unit
  conversionFactor Float   @default(1)
}
```

---

## API Endpoints

```
GET    /supplies                          — list supplies (filters: name, active; pagination)
GET    /supplies/:id                      — get single supply
POST   /supplies                          — create supply (admin only)
PATCH  /supplies/:id                      — update supply (admin only)
DELETE /supplies/:id                      — soft delete supply (admin only)

GET    /services/:serviceId/supplies      — get supplies assigned to a service
PUT    /services/:serviceId/supplies      — replace all supplies for a service (admin only)
```

### Business Rules
- Supply name must be unique per clinic (case-insensitive)
- Duplicate name → error 409 `SUPPLY_EXISTS`
- Cannot delete a supply that is linked to an active service → error 409 `SUPPLY_IN_USE`
- Deletion is soft (sets `deletedAt` and `active = false`)
- `PUT /services/:serviceId/supplies` replaces all assignments atomically in a DB transaction
- All operations are scoped to `clinicId`
- `stock` and `minStock` are stored as integers (fractional units tracked via `quantity` in `ServiceSupply`)

---

## Frontend Pages

### /supplies — Supplies Catalog
- List supplies with stock status badges (OK / Low / Out of stock based on `minStock`)
- Create / Edit supply form (name, unit, costPrice, stock, minStock)
- Low-stock alert indicator
- Per-service supply assignment editor (on service detail page)

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: Supplies CRUD + ServiceSupply assignment + soft delete |
