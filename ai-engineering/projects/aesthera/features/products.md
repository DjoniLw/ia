# Feature: Products & Sales

## Summary
Product catalog management (CRUD) and product sales tracking with stock control,
payment method recording, and financial ledger integration.

---

## Product Catalog

### Data Model
```prisma
model Product {
  id          UUID PK
  clinicId    UUID FK → Clinic
  name        String
  description String?
  category    String?
  brand       String?
  sku         String?
  barcode     String?
  price       Int          -- BRL cents
  costPrice   Int?         -- BRL cents
  stock       Int          @default(0)
  minStock    Int          @default(0)
  unit        String       @default("un")
  active      Boolean      @default(true)
  imageUrl    String?
  createdAt   DateTime
  deletedAt   DateTime?    -- soft delete
}
```

### API Endpoints
```
GET    /products               — list (filter: name, category, active, lowStock)
GET    /products/:id           — get one
POST   /products               — create (admin only)
PATCH  /products/:id           — update (admin only)
DELETE /products/:id           — soft delete (admin only)
```

---

## Product Sales

### Data Model
```prisma
model ProductSale {
  id            UUID PK
  clinicId      UUID FK → Clinic
  productId     UUID FK → Product
  customerId    UUID? FK → Customer
  quantity      Int
  unitPrice     Int          -- price at time of sale (snapshot)
  totalPrice    Int          -- unitPrice * quantity - discount
  discount      Int          @default(0)
  paymentMethod String?      -- cash | pix | card | transfer
  notes         String?
  soldAt        DateTime     @default(now())
}
```

### API Endpoints
```
GET   /products/sales          — list sales (filter: from, to, productId, customerId)
POST  /products/sell           — record a sale
```

### Business Rules
- `unitPrice` is snapshotted at time of sale (not the current product price)
- `stock` is decremented atomically in a DB transaction with the sale creation
- If `stock < quantity` → error 400 `INSUFFICIENT_STOCK`
- If product `active = false` → error 400 `PRODUCT_INACTIVE`
- Every sale creates a **credit LedgerEntry** automatically (source: `product_sale`)
- `paymentMethod` is optional — accepts: `cash`, `pix`, `card`, `transfer`

### Financial Integration
Every `POST /products/sell` calls `LedgerService.createCreditEntry()` with:
- `amount` = `totalPrice`
- `description` = `"Venda — {product.name} ({quantity}x)"`
- `metadata.source` = `"product_sale"`
- `metadata.productSaleId` = sale ID

---

## Route Ordering (Important)

Fastify matches static segments before dynamic params. These routes MUST be
registered before `GET /products/:id`:

```
GET  /products/sales   ← must be BEFORE /products/:id
POST /products/sell    ← must be BEFORE /products/:id
```

Violation causes 404 because `"sales"` / `"sell"` get matched as `:id`.

---

## Frontend Pages

### /products — Product Catalog
- List products with stock status badges (OK / Low / Out of stock)
- Create / Edit product dialog (full form with all fields)
- Quick-sell button from product card
- Stock alert when below `minStock`

### /sales — Dedicated Sales Page (NEW)
- Record a new sale via form dialog
- Date-range filter
- Summary cards: revenue in period / # transactions / # items sold
- Payment method badge per row
- Full table: date, product, customer, qty, payment method, total

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: Product CRUD, sales endpoint, stock decrement |
| 2026-03 | Route reordering fix: `GET /products/sales` registered before `GET /products/:id` |
| 2026-03 | Ledger integration: product sales now create credit LedgerEntry |
| 2026-03 | Added `paymentMethod` field to `ProductSale` (cash/pix/card/transfer) |
| 2026-03 | Created dedicated `/sales` page with payment method tracking |
