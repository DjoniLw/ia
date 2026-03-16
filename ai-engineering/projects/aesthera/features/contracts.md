# Feature: Digital Contracts

## Summary
Digital client contracts with electronic signature support. Allows clinics to generate
contracts from templates, send a unique signature link via WhatsApp, and store the
signed document in the customer profile.

---

## Contract Types (Templates)
- Image usage authorization
- Treatment consent
- Service agreement

---

## Expected Flow (planned)
1. Admin selects contract template for a customer
2. System generates a unique signature link (`/sign/{token}`)
3. Link sent via WhatsApp message to customer
4. Customer views contract, signs digitally (touch/mouse)
5. Signed document stored in customer profile with timestamp

---

## Current Status
**UI scaffold implemented** — The customer profile has a "Contratos" tab showing available
contract templates with placeholder "Gerar link" buttons. Backend integration pending.

---

## API Endpoints (planned)

```
POST /contracts          — generate contract from template → returns sign URL
GET  /contracts/:token   — public endpoint: get contract for signing
POST /contracts/:token/sign  — submit signature (base64 image)
GET  /customers/:id/contracts — list signed contracts for a customer
```

---

## Data Model (planned)

```prisma
model Contract {
  id          UUID PK
  clinicId    UUID FK → Clinic
  customerId  UUID FK → Customer
  template    String    -- image_usage | treatment_consent | service_agreement
  signToken   String    @unique
  status      String    -- pending | signed
  content     String    -- rendered HTML
  signedAt    DateTime?
  signature   String?   -- base64 signature image
  createdAt   DateTime
}
```

---

## Status
[ ] Planned  [x] UI Scaffold  [ ] Backend  [ ] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | UI scaffold added to customer profile "Contratos" tab |
