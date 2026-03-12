# Feature: Ledger

## Summary
Immutable financial record of all money movement within a clinic.
Every confirmed payment generates a ledger entry. Used for reconciliation,
reporting, and accurate financial overview. Never mutated — only appended.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /ledger | Clinic JWT or API Key | List entries (paginated, filterable) |
| GET | /ledger/:id | Clinic JWT or API Key | Get single entry |
| GET | /ledger/summary | Clinic JWT or API Key | Aggregated totals (revenue, refunds, net) |

## Business Rules
- Entries are **append-only** — never updated or deleted
- One `credit` entry per confirmed payment
- One `debit` entry per refund — original entry is never modified
- `amount` always positive; `type` defines direction
- All amounts in BRL cents (integer)
- `reference_id` links to originating payment
- Per-clinic isolation enforced by `clinic_id`
- Summary always computed from ledger entries — no derived state stored elsewhere

## Entry Types
| Type | Meaning |
|------|---------|
| `credit` | Money received (payment confirmed) |
| `debit` | Money returned (refund issued) |

## Query Filters (GET /ledger)
- `type` (credit | debit)
- `created_at` range (from / to)
- `customer_id`
- `appointment_id`

## Summary Response
```json
{
  "total_credits": 250000,
  "total_debits": 10000,
  "net_balance": 240000,
  "currency": "BRL",
  "period": { "from": "2026-01-01", "to": "2026-03-11" }
}
```

## Data Model
```
LedgerEntry {
  id               UUID PK
  clinic_id        UUID FK → Clinic         -- tenant key
  type             ENUM(credit, debit)
  amount           INTEGER NOT NULL          -- BRL cents, always positive
  currency         STRING DEFAULT 'BRL'
  reference_id     UUID NOT NULL             -- FK → Payment
  billing_id       UUID FK → Billing
  appointment_id   UUID FK → Appointment
  customer_id      UUID FK → Customer
  description      STRING?
  metadata         JSONB?
  created_at       TIMESTAMP                 -- immutable, set once

  -- No updated_at: entries are never modified
}
```

## Indexes
- `(clinic_id, created_at)` — main query pattern
- `(clinic_id, appointment_id)` — appointment-level reconciliation
- `(clinic_id, customer_id)` — customer-level history
- `reference_id` — payment lookup

## Events Consumed
| Event | Action |
|-------|--------|
| `payment.succeeded` | Create `credit` entry |
| `payment.refunded` | Create `debit` entry |

## Dependencies
- Payments module (event source)
- Clinics module (tenant key)
- Billing module (billing reference)
- Appointments module (appointment reference)
- Customers module (customer reference)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
