# Feature: Packages

## Summary
Service packages (pacotes) — bundle multiple services into a single sellable package with a price and optional expiry.
Purchasing a package creates a customer package record, pre-generates session slots, and creates a wallet entry.

---

## Data Model

```prisma
model ServicePackage {
  id           String    @id @default(uuid())
  clinicId     String    -- FK → Clinic (tenant key)
  name         String
  description  String?
  price        Int       -- BRL cents
  validityDays Int?      -- null = no expiry
  active       Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model ServicePackageItem {
  id        String  @id @default(uuid())
  packageId String  -- FK → ServicePackage
  serviceId String  -- FK → Service
  quantity  Int     @default(1)  -- number of sessions included
}

model CustomerPackage {
  id             String    @id @default(uuid())
  clinicId       String    -- FK → Clinic (tenant key)
  customerId     String    -- FK → Customer
  packageId      String    -- FK → ServicePackage
  walletEntryId  String    -- FK → WalletEntry (PACKAGE type)
  expiresAt      DateTime? -- computed from ServicePackage.validityDays at purchase time
  createdAt      DateTime  @default(now())
}

model CustomerPackageSession {
  id                String    @id @default(uuid())
  clinicId          String    -- FK → Clinic (tenant key)
  customerPackageId String    -- FK → CustomerPackage
  serviceId         String    -- FK → Service
  usedAt            DateTime? -- null = not yet redeemed
  appointmentId     String?   -- FK → Appointment (set on redemption)
}
```

---

## API Endpoints

```
GET    /packages                               — list packages (filter: active; pagination)
GET    /packages/:id                           — get single package
POST   /packages                               — create package (admin only)
PATCH  /packages/:id                           — update package (admin only)

GET    /packages/customer/:customerId          — list purchased packages for a customer
POST   /packages/:id/purchase                  — purchase package for a customer (admin only)
POST   /packages/sessions/:sessionId/redeem    — redeem a session (admin only)
```

> **Route ordering**: `GET /packages/customer/:customerId` and
> `POST /packages/sessions/:sessionId/redeem` must be registered **before**
> `GET /packages/:id` and `PATCH /packages/:id` to avoid dynamic param conflicts.

---

## Business Rules

- Package must include at least one service item (`items` array length ≥ 1)
- All services in the package must belong to the same clinic and be active
- Invalid/inactive service → error 404 `Service`
- Purchasing an inactive package → error 400 `PACKAGE_INACTIVE`
- Customer must belong to the clinic → error 404 `Customer`
- On purchase:
  1. A `WalletEntry` of type `PACKAGE` is created via `WalletService.createInternal()` for the package price
  2. A `CustomerPackage` record is created
  3. Session slots (`CustomerPackageSession`) are pre-generated: one per `serviceId × quantity`
- On session redemption:
  - Session must exist and belong to the clinic → else 404
  - Session already redeemed (`usedAt` set) → error 400 `SESSION_ALREADY_REDEEMED`
  - `CustomerPackage.expiresAt` exceeded → error 400 `PACKAGE_EXPIRED`
  - Sets `usedAt = now()` and optionally links an `appointmentId`

---

## Frontend Pages

### /packages — Packages Catalog
- List service packages with price and session counts
- Create / Edit package form (name, price, validityDays, service items)
- Toggle active status

### Customer profile — Packages tab
- List purchased packages with session usage progress (e.g. "3/5 sessions used")
- Purchase new package button
- Redeem session button

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: ServicePackage CRUD, purchase flow, session pre-generation, redemption |
