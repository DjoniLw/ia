# Feature: Promotions

## Summary
Discount promotion campaigns — create and manage promotional codes that apply percentage or fixed discounts to billings, with usage tracking, validity windows, and service-level targeting.

---

## Data Model

```prisma
model Promotion {
  id                   String    @id @default(uuid())
  clinicId             String    -- FK → Clinic (tenant key)
  name                 String
  code                 String    -- unique per clinic (auto-uppercased)
  description          String?
  discountType         PromotionDiscountType  -- PERCENTAGE | FIXED
  discountValue        Int       -- percentage (0–100) or BRL cents
  status               PromotionStatus @default(active)  -- active | inactive | expired
  maxUses              Int?      -- null = unlimited
  usesCount            Int       @default(0)
  minAmount            Int?      -- BRL cents — minimum billing amount to apply
  applicableServiceIds String[]  -- empty = applies to all services
  validFrom            DateTime
  validUntil           DateTime? -- null = no expiry
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}

model PromotionUsage {
  id             String    @id @default(uuid())
  clinicId       String    -- FK → Clinic (tenant key)
  promotionId    String    -- FK → Promotion
  customerId     String    -- FK → Customer
  billingId      String    -- FK → Billing
  discountAmount Int       -- BRL cents — snapshot of discount applied
  createdAt      DateTime  @default(now())
}

enum PromotionDiscountType { PERCENTAGE FIXED }
enum PromotionStatus       { active inactive expired }
```

---

## API Endpoints

```
GET    /promotions             — list promotions (filter: status; pagination)
GET    /promotions/:id         — get single promotion
POST   /promotions             — create promotion (admin only)
PATCH  /promotions/:id         — update promotion (admin only)
POST   /promotions/validate    — validate code and preview discount (no side effects)
POST   /promotions/apply       — apply promotion to a billing (admin only)
```

> **Route ordering**: `POST /promotions/validate` and `POST /promotions/apply` must be registered
> **before** `GET /promotions/:id` to avoid Fastify matching `"validate"` / `"apply"` as `:id`.

---

## Business Rules

- Promotion codes are stored and matched **uppercase** (normalized on creation)
- Duplicate code per clinic → error 409 `PROMOTION_CODE_EXISTS`
- `validate()` checks (in order):
  1. Promotion exists → else 404
  2. `status !== inactive` → else 400 `PROMOTION_INACTIVE`
  3. Not expired (`validUntil < now` or `status = expired`) → else 400 `PROMOTION_EXPIRED`
  4. `validFrom <= now` → else 400 `PROMOTION_NOT_YET_VALID`
  5. `maxUses` not exceeded → else 400 `PROMOTION_MAX_USES_REACHED`
  6. `billingAmount >= minAmount` → else 400 `PROMOTION_MIN_AMOUNT_NOT_MET`
  7. `applicableServiceIds` non-empty → at least one `serviceId` matches → else 400 `PROMOTION_NOT_APPLICABLE`
- Discount calculation:
  - `PERCENTAGE`: `floor(billingAmount × discountValue / 100)`
  - `FIXED`: `min(discountValue, billingAmount)` — never negative
- `apply()` creates a `PromotionUsage` record and increments `usesCount` atomically
- `validate()` is **read-only** — no side effects, safe to call before checkout

---

## Frontend Pages

### /promotions — Promotions
- List promotions with status badges (active / inactive / expired)
- Create / Edit promotion form
- Usage counter per promotion
- Validate code inline (preview discount)

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: Promotion CRUD, validate, apply, PromotionUsage tracking |
