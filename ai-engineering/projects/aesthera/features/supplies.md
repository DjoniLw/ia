# Feature: Supplies

## Summary
Consumable supplies (insumos) catalog — track what materials are used per service, with stock control, service assignments, and purchase registration with conversion factor.

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

model SupplyPurchase {
  id                String    @id @default(uuid())
  clinicId          String    -- FK → Clinic (tenant key)
  supplyId          String    -- FK → Supply
  supplierName      String?
  purchaseUnit      String    -- unidade de compra (caixa, frasco, kg, ...)
  purchaseQty       Float     -- quantidade comprada na unidade de compra
  conversionFactor  Float     -- 1 purchaseUnit = X supply.unit
  stockIncrement    Int       -- Math.floor(purchaseQty * conversionFactor)
  unitCost          Int       -- BRL cents por unidade de compra
  totalCost         Int       -- Math.round(unitCost * purchaseQty)
  notes             String?
  purchasedAt       DateTime  -- obrigatório no body do POST
  createdAt         DateTime  @default(now())
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

GET    /supply-purchases                  — list purchases (filters: supplyId, supplierName, from, to; pagination)
GET    /supply-purchases/:id              — get single purchase
POST   /supply-purchases                  — create purchase (admin only)
DELETE /supply-purchases/:id              — cancel purchase and reverse stock (admin only)
```

### Business Rules
- Supply name must be unique per clinic (case-insensitive)
- Duplicate name → error 409 `SUPPLY_EXISTS`
- Cannot delete a supply that is linked to an active service → error 409 `SUPPLY_IN_USE`
- Deletion is soft (sets `deletedAt` and `active = false`)
- `PUT /services/:serviceId/supplies` replaces all assignments atomically in a DB transaction
- All operations are scoped to `clinicId`
- `stock` and `minStock` are stored as integers (fractional units tracked via `quantity` in `ServiceSupply`)
- `stockIncrement = Math.floor(purchaseQty * conversionFactor)` and is persisted on `SupplyPurchase`
- `totalCost = Math.round(unitCost * purchaseQty)` and is persisted on `SupplyPurchase`
- Purchase creation increments `Supply.stock` atomically in the same Prisma transaction that creates `SupplyPurchase`
- Purchase cancellation is performed via `DELETE /supply-purchases/:id`
- Before reversing stock on cancellation, validate `supply.stock >= stockIncrement`; otherwise return 409 `INSUFFICIENT_STOCK_FOR_REVERSAL`
- Supply purchases are immutable after creation; there is no `PATCH /supply-purchases/:id`
- `purchasedAt` is provided by the client to support retroactive purchase entry
- Only users with role `admin` can create and cancel supply purchases

---

## Frontend Pages

### /supplies — Supplies Catalog
- List supplies with stock status badges (OK / Low / Out of stock based on `minStock`)
- Create / Edit supply form (name, unit, costPrice, stock, minStock)
- Low-stock alert indicator
- Per-service supply assignment editor (on service detail page)

### /compras-insumos — Supply Purchases
- Purchase list with filters: period, supply, supplier
- Columns: purchase date, supply, supplier, purchased quantity, conversion factor, stock increment, total cost, action to cancel
- Dialog for new purchase with:
  - supply selection
  - supplier name
  - purchase unit
  - purchase quantity
  - conversion factor with dynamic preview (`1 caixa = X ml`)
  - stock preview (`Estoque atual: 200 ml → Após compra: 700 ml`)
  - unit cost in BRL
  - auto-calculated total cost
  - purchase date (required)
  - notes
- Clear error feedback when cancellation cannot reverse stock due to insufficient remaining stock

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: Supplies CRUD + ServiceSupply assignment + soft delete |
| 2026-03 | Added SupplyPurchase spec: purchase registration with conversion factor, atomic stock increment and reversal, plus frontend page `/compras-insumos` |
