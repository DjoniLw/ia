# Feature: Billing

## Summary
Billing records represent charges issued to a customer for a completed appointment.
A billing record is automatically created when an appointment is completed.
It links to a payment and tracks the payment lifecycle.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /billing | Clinic JWT or API Key | List billing records (paginated, filterable) |
| GET | /billing/:id | Clinic JWT or API Key | Get billing details |
| POST | /billing/:id/cancel | Clinic JWT | Cancel billing (before payment) |
| POST | /billing/:id/send | Clinic JWT | Resend payment link to customer |
| GET | /billing/:id/payment-link | Clinic JWT or API Key | Get payment link |

> Billing creation is internal — triggered automatically by `appointment.completed` event.
> Direct manual creation is not exposed to API consumers.

## Business Rules
- Billing is created automatically when `appointment.completed` event fires
- Amount defaults to appointment price (copied from service at booking time)
- Payment methods: configured per clinic (default: all — PIX, boleto, card)
- On creation: payment link generated, sent to customer via WhatsApp + email
- Only `pending` or `overdue` billing can be cancelled
- `paid` billing is immutable
- Idempotency: if `appointment_id` already has a billing record, return existing
- Cancelling an appointment does not auto-cancel billing if already `paid`
- `due_date` defaults to appointment date + 3 days (configurable per clinic)
- Cron runs daily: marks `pending` billing past `due_date` as `overdue` and sends WhatsApp reminder

## Status transitions
```
pending → paid
       ↘ overdue (auto, cron — past due_date)
                ↘ paid
                ↘ cancelled (manual)
       ↘ cancelled (manual, only if not paid)
```

## Query Filters (GET /billing)
- `customer_id`
- `appointment_id`
- `status` (pending | paid | overdue | cancelled)
- `due_date` range
- `created_at` range
- `amount` range

## Data Model
```
Billing {
  id               UUID PK
  clinic_id        UUID FK → Clinic         -- tenant key
  customer_id      UUID FK → Customer
  appointment_id   UUID FK → Appointment UNIQUE
  amount           INTEGER NOT NULL         -- BRL cents
  status           ENUM(pending, paid, overdue, cancelled) DEFAULT pending
  payment_methods  STRING[]                 -- ['pix', 'boleto', 'card']
  payment_link     STRING?                  -- generated URL
  payment_token    STRING UNIQUE            -- token for public payment page
  due_date         DATE NOT NULL            -- defaults to appointment_date + 3 days
  paid_at          TIMESTAMP?
  overdue_at       TIMESTAMP?
  cancelled_at     TIMESTAMP?
  updated_at       TIMESTAMP
  created_at       TIMESTAMP
}
```

## Events Emitted
| Event | Trigger |
|-------|---------|
| `billing.created` | Billing auto-created after appointment completion |
| `billing.paid` | Payment confirmed |
| `billing.overdue` | Cron marks as overdue past due_date |
| `billing.cancelled` | Manual cancel |

## Dependencies
- Appointments module (trigger source)
- Customers module (recipient)
- Payments module (payment processing, link generation)
- Notifications module (payment link via WhatsApp + email)
- Ledger module (records financial entry on `billing.paid`)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
