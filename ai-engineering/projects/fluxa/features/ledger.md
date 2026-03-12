# Feature: Ledger

## Summary
Immutable financial record of all money movement within Fluxa.
Every confirmed payment generates a ledger entry. Used for reconciliation,
reporting, and future financial features. Never mutated — only appended.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /ledger | API Key | List entries for company (paginated, filterable) |
| GET | /ledger/:id | API Key | Get single entry |
| GET | /ledger/summary | API Key | Aggregated totals (balance, volume) |

## Business Rules
- Ledger entries are **append-only** — never updated or deleted
- One entry per confirmed payment (`payment.succeeded` event)
- If a payment is refunded, a new entry is created with type `debit` — the original is not modified
- `amount` is always positive; `type` defines direction
- All amounts in BRL cents (integer)
- `reference_id` links entry back to the originating payment
- Per-company isolation enforced by `company_id`
- Summary endpoint computes: total received, total refunded, net balance — always from ledger entries (no derived state)

## Entry Types
| Type | Meaning |
|------|---------|
| `credit` | Money received (payment confirmed) |
| `debit` | Money returned (refund issued) |

## Query Filters (GET /ledger)
- `type` (credit | debit)
- `created_at` range
- `customer_id`
- `invoice_id`

## Summary Response
```json
{
  "total_credits": 150000,
  "total_debits": 5000,
  "net_balance": 145000,
  "currency": "BRL",
  "period": { "from": "2026-01-01", "to": "2026-03-10" }
}
```

## Data Model
```
LedgerEntry {
  id             UUID PK
  company_id     UUID FK → Company       -- tenant key
  type           ENUM(credit, debit)
  amount         INTEGER NOT NULL        -- BRL cents, always positive
  currency       STRING DEFAULT 'BRL'
  reference_id   UUID NOT NULL           -- FK → Payment
  invoice_id     UUID FK → Invoice
  customer_id    UUID FK → Customer
  description    STRING?
  metadata       JSONB?
  created_at     TIMESTAMP               -- immutable, set once

  -- No updated_at: entries are never modified
}
```

## Indexes
- `(company_id, created_at)` — main query pattern
- `(company_id, invoice_id)` — invoice-level reconciliation
- `(company_id, customer_id)` — customer-level history
- `reference_id` — payment lookup

## Events Consumed
| Event | Action |
|-------|--------|
| `payment.succeeded` | Create `credit` entry |
| `payment.refunded` | Create `debit` entry |

## Dependencies
- Payments module (event source)
- Companies module (tenant key)
- Invoices module (invoice reference)
- Customers module (customer reference)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
