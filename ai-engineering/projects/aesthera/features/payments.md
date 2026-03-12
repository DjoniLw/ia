# Feature: Payments

## Summary
Handles payment creation per gateway (Stripe, MercadoPago), webhook processing,
and payment status reconciliation. Payments are always linked to a billing record.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /payments | Clinic JWT or API Key | List payments (paginated, filterable) |
| GET | /payments/:id | Clinic JWT or API Key | Get payment details |
| POST | /payments/webhooks/stripe | Public (sig) | Stripe webhook receiver |
| POST | /payments/webhooks/mercadopago | Public (sig) | MercadoPago webhook receiver |

> Payment creation is internal — triggered by billing creation, not directly by API consumers.

## Internal Flow
```
billing.created event
        ↓
PaymentsService.createPaymentIntent(billing)
        ↓
  ┌─────────────────────────────────┐
  │  method = 'pix' or 'boleto'     │ → MercadoPago SDK
  │  method = 'card'                │ → Stripe SDK
  └─────────────────────────────────┘
        ↓
Payment record created (status: pending)
        ↓
payment_link returned → stored on Billing
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
BillingService updates billing status
LedgerService records entry (if paid)
NotificationsService sends receipt (WhatsApp + email)
```

## Business Rules
- Webhook endpoints are public but **must verify gateway signature** — reject if invalid
- Idempotent webhook: if `gateway_event_id` already processed, return 200 and skip
- Failed payments: update status, do not cancel billing — retry is gateway's responsibility
- PIX: expires in 30 minutes (configurable per clinic setting)
- Boleto: expires on appointment date + 1 day
- Card: Stripe handles retries automatically

## Gateway Events to Handle

### Stripe
| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Mark payment paid, update billing |
| `payment_intent.payment_failed` | Mark payment failed |
| `charge.dispute.created` | Flag as disputed |

### MercadoPago
| Event | Action |
|-------|--------|
| `payment.updated` (status=approved) | Mark payment paid, update billing |
| `payment.updated` (status=rejected) | Mark payment failed |
| `payment.updated` (status=refunded) | Mark payment refunded |

## Data Model
```
Payment {
  id                 UUID PK
  clinic_id          UUID FK → Clinic       -- tenant key
  billing_id         UUID FK → Billing
  gateway            ENUM(stripe, mercadopago)
  method             ENUM(pix, boleto, card)
  status             ENUM(pending, paid, failed, expired, refunded, disputed)
  amount             INTEGER NOT NULL        -- BRL cents
  gateway_payment_id STRING UNIQUE
  gateway_event_id   STRING?                 -- idempotency on webhooks
  payment_url        STRING?                 -- PIX QR code URL or boleto URL
  pix_qr_code        STRING?                 -- raw PIX copy-paste string
  paid_at            TIMESTAMP?
  expires_at         TIMESTAMP?
  metadata           JSONB?
  created_at         TIMESTAMP
  updated_at         TIMESTAMP
}
```

## Events Emitted
| Event | Trigger |
|-------|--------|
| `payment.succeeded` | Gateway confirms payment paid |
| `payment.failed` | Gateway reports payment failure |
| `payment.refunded` | Gateway reports refund |
| `payment.disputed` | Stripe dispute created |

## Dependencies
- Billing module (event source — `billing.created` triggers payment intent creation)
- Clinics module (tenant key, gateway config per clinic)
- Customers module (payer info for payment link)
- Ledger module (consumes `payment.succeeded` to append credit entry)
- Notifications module (consumes `payment.succeeded` to send receipt)
- Stripe SDK
- MercadoPago SDK

## Status
[ ] Planned  [ ] In Progress  [ ] Done
