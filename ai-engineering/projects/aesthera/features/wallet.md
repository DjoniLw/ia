# Feature: Wallet

## Summary
Customer wallet — stores vouchers, credits, cashback, and package balances per customer.
Supports creation, manual adjustment, and usage (spending) with a full append-only transaction log.

---

## Data Model

```prisma
model WalletEntry {
  id              String    @id @default(uuid())
  clinicId        String    -- FK → Clinic (tenant key)
  customerId      String    -- FK → Customer
  type            WalletEntryType   -- VOUCHER | CREDIT | CASHBACK | PACKAGE
  status          WalletEntryStatus @default(ACTIVE)  -- ACTIVE | USED | EXPIRED
  originalValue   Int       -- BRL cents — value at creation
  balance         Int       -- BRL cents — remaining balance
  code            String    @unique  -- auto-generated (e.g. VCHR-XXXXXXXX)
  originType      WalletOriginType  -- OVERPAYMENT | GIFT | REFUND | CASHBACK_PROMOTION | PACKAGE_PURCHASE | VOUCHER_SPLIT
  originReference String?   -- ID of originating entity (e.g. packageId, billingId)
  notes           String?
  expirationDate  DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model WalletTransaction {
  id            String    @id @default(uuid())
  clinicId      String    -- FK → Clinic (tenant key)
  walletEntryId String    -- FK → WalletEntry
  type          WalletTransactionType -- CREATE | ADJUST | USE | SPLIT
  value         Int       -- BRL cents (positive = credit, negative = debit for ADJUST)
  reference     String?   -- billingId or newEntryId for traceability
  description   String?
  createdAt     DateTime  @default(now())
}

enum WalletEntryType       { VOUCHER CREDIT CASHBACK PACKAGE }
enum WalletEntryStatus     { ACTIVE USED EXPIRED }
enum WalletOriginType      { OVERPAYMENT GIFT REFUND CASHBACK_PROMOTION PACKAGE_PURCHASE VOUCHER_SPLIT }
enum WalletTransactionType { CREATE ADJUST USE SPLIT }
```

---

## API Endpoints

```
GET    /wallet              — list wallet entries (filters: customerId, type, status; pagination)
GET    /wallet/:id          — get single wallet entry
POST   /wallet              — create wallet entry manually (admin only)
PATCH  /wallet/:id/adjust   — adjust balance (admin only)
```

### Internal API (service-to-service)
```
WalletService.createInternal(data, tx?)   — used by packages and billing modules
WalletService.use(clinicId, id, amount, billingId) — deduct balance (runs in DB transaction)
```

---

## Business Rules

- Each wallet entry has a unique auto-generated `code` (format: `VCHR-XXXXXXXX`, alphanumeric, no ambiguous chars)
- Every operation creates a `WalletTransaction` log — the log is **append-only** (never updated or deleted)
- `use()`: marks entry as `USED`, deducts full balance, creates new split entry for leftover if `balance > amount`
  - Runs inside a DB transaction with row-level lock (`SELECT ... FOR UPDATE`) to prevent double spending
  - Errors: `WALLET_NOT_ACTIVE` (409), `INSUFFICIENT_BALANCE` (400)
- `adjust()`: changes balance by a signed integer (positive = add, negative = subtract)
  - Balance cannot go negative → error 400 `INSUFFICIENT_BALANCE`
  - If balance reaches 0 → status changes to `USED`
- `createInternal()`: accepts optional Prisma transaction client — used by packages and billing to create wallet entries atomically within parent transactions

---

## Frontend Pages

### /wallet — Customer Wallet
- List wallet entries per customer with type and status badges
- Create voucher/credit dialog
- Adjust balance (admin only)

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: WalletEntry CRUD, adjust, use with row-level lock, voucher split, WalletTransaction log |
