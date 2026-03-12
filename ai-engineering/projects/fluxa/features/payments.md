# Feature: Payments

## Summary
Handles payment creation per gateway (Stripe, MercadoPago), webhook processing,
and payment status reconciliation. Payments are always linked to an invoice.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /payments | API Key | List payments (paginated, filterable) |
| GET | /payments/:id | API Key | Get payment details |
| POST | /payments/webhooks/stripe | Public (sig) | Stripe webhook receiver |
| POST | /payments/webhooks/mercadopago | Public (sig) | MercadoPago webhook receiver |

> Payment creation is internal — triggered by invoice creation, not directly by API consumers.

## Internal Flow
```
invoice.created event
        ↓
PaymentsService.createPaymentIntent(invoice)
        ↓
  ┌─────────────────────────────────┐
  │  method = 'pix' or 'boleto'     │ → MercadoPago SDK → preference/payment
  │  method = 'card'                │ → Stripe SDK → PaymentIntent
  └─────────────────────────────────┘
        ↓
Payment record created (status: pending)
        ↓
payment_link returned → stored on Invoice
```

## Webhook Processing
```
POST /payments/webhooks/:gateway
        ↓
Verify signature (Stripe-Signature / X-Signature)
        ↓
Parse event type
        ↓
Find Payment by gateway_payment_id
        ↓
Update Payment status
        ↓
Emit domain event (payment.succeeded / payment.failed)
        ↓
InvoicesService updates invoice status
LedgerService records entry (if paid)
NotificationsService triggers email + company webhook
```

## Business Rules
- Webhook endpoints are public but **must verify gateway signature** — reject if invalid
- Each payment attempt is stored as a separate record (supports retries)
- `gateway_payment_id` must be unique per gateway
- Idempotent webhook: if event already processed (`gateway_event_id` exists), return 200 and skip
- Failed payments: update status, do not cancel invoice — retry is gateway's responsibility
- PIX: expires in 30 minutes by default (configurable per invoice)
- Boleto: expires on `due_date`
- Card: Stripe handles retries automatically

## Gateway Events to Handle

### Stripe
| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Mark payment paid, update invoice |
| `payment_intent.payment_failed` | Mark payment failed |
| `charge.dispute.created` | Flag payment as disputed |

### MercadoPago
| Event | Action |
|-------|--------|
| `payment.updated` (status=approved) | Mark payment paid, update invoice |
| `payment.updated` (status=rejected) | Mark payment failed |
| `payment.updated` (status=refunded) | Mark payment refunded |

## Data Model
```
Payment {
  id                 UUID PK
  company_id         UUID FK → Company     -- tenant key
  invoice_id         UUID FK → Invoice
  gateway            ENUM(stripe, mercadopago)
  method             ENUM(pix, boleto, card)
  status             ENUM(pending, paid, failed, expired, refunded, disputed)
  amount             INTEGER NOT NULL      -- BRL cents
  gateway_payment_id STRING UNIQUE         -- ID from Stripe or MercadoPago
  gateway_event_id   STRING?               -- for idempotency on webhooks
  payment_url        STRING?               -- PIX QR code URL or boleto URL
  pix_qr_code        STRING?               -- raw PIX copy-paste string
  paid_at            TIMESTAMP?
  expires_at         TIMESTAMP?
  metadata           JSONB?
  created_at         TIMESTAMP
  updated_at         TIMESTAMP
}
```

## Events Emitted
| Event | Trigger |
|-------|---------|
| `payment.succeeded` | Webhook confirms payment |
| `payment.failed` | Webhook reports failure |
| `payment.refunded` | Refund confirmed by gateway |
| `payment.disputed` | Chargeback/dispute opened |

## Dependencies
- Invoices module (update invoice status)
- Ledger module (record entry on `payment.succeeded`)
- Notifications module (trigger on payment events)
- Stripe SDK
- MercadoPago SDK

## Status
[ ] Planned  [ ] In Progress  [ ] Done
