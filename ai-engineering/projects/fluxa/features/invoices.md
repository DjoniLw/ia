# Feature: Invoices

## Summary
Invoices are the core of Fluxa. A company creates an invoice for a customer,
defining amount, due date, and payment method. Fluxa generates the payment link
and tracks the lifecycle until paid, cancelled, or expired.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /invoices | API Key | Create invoice |
| GET | /invoices | API Key | List invoices (paginated, filterable) |
| GET | /invoices/:id | API Key | Get invoice details |
| POST | /invoices/:id/cancel | API Key | Cancel invoice |
| POST | /invoices/:id/send | API Key | Manually resend notification |
| GET | /invoices/:id/payment-link | API Key | Get payment link |
| GET | /pay/:token | Public | Public payment page (no auth) |

## Business Rules
- Invoice belongs to a company and a customer (both required)
- `amount` must be > 0 and in BRL cents (integer)
- `due_date` must be a future date at creation time
- `payment_methods` must include at least one: `pix`, `boleto`, `card`
- On creation: payment link generated, notification sent to customer (if `notify: true`)
- Status transitions (only forward, no rollback):
  ```
  draft → pending → paid
                 ↘ overdue (auto, cron job)
                 ↘ cancelled (manual)
                 ↘ expired (auto, after N days overdue)
  ```
- Only `pending` invoices can be cancelled
- `paid` and `cancelled` invoices are immutable
- Idempotency key (`idempotency_key`) supported — same key returns existing invoice
- Overdue automation: cron runs daily, marks `pending` past `due_date` as `overdue`
- Auto-notifications: send reminder 3 days before due, on due date, and 1 day after

## Query Filters (GET /invoices)
- `customer_id`
- `status` (draft | pending | paid | overdue | cancelled | expired)
- `payment_method`
- `due_date` range
- `created_at` range
- `amount` range

## Data Model
```
Invoice {
  id               UUID PK
  company_id       UUID FK → Company       -- tenant key
  customer_id      UUID FK → Customer
  amount           INTEGER NOT NULL        -- BRL cents
  description      STRING?
  due_date         DATE NOT NULL
  status           ENUM(draft, pending, paid, overdue, cancelled, expired) DEFAULT draft
  payment_methods  STRING[] NOT NULL       -- ['pix', 'boleto', 'card']
  payment_link     STRING?                 -- generated URL
  payment_token    STRING UNIQUE           -- token for /pay/:token public page
  idempotency_key  STRING?
  metadata         JSONB?
  paid_at          TIMESTAMP?
  cancelled_at     TIMESTAMP?
  expired_at       TIMESTAMP?
  notify           BOOLEAN DEFAULT true
  updated_at       TIMESTAMP
  created_at       TIMESTAMP

  UNIQUE(company_id, idempotency_key)
}
```

## Events Emitted
| Event | Trigger |
|-------|---------|
| `invoice.created` | Invoice created |
| `invoice.paid` | Payment confirmed |
| `invoice.overdue` | Cron marks as overdue |
| `invoice.cancelled` | Manual cancel |
| `invoice.expired` | Cron marks as expired |

## Dependencies
- Companies module (tenant validation)
- Customers module (customer validation)
- Payments module (payment link generation, status update)
- Notifications module (email triggers on status change)
- Ledger module (records financial entry on `invoice.paid`)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
