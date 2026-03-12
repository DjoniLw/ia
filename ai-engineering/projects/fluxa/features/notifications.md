# Feature: Notifications

## Summary
Handles all outbound communication triggered by domain events: emails to customers
(payment reminders, receipts) and webhook deliveries to companies (integration events).
Notifications are async — processed via queue (BullMQ).

## Triggers (no direct API — event-driven)
| Event | Recipient | Channel | Template |
|-------|-----------|---------|----------|
| `invoice.created` + `notify: true` | Customer | Email | invoice-created |
| `invoice.paid` | Customer | Email | payment-receipt |
| `invoice.paid` | Company | Webhook | `invoice.paid` payload |
| `invoice.overdue` | Customer | Email | invoice-overdue |
| `invoice.overdue` | Company | Webhook | `invoice.overdue` payload |
| `invoice.cancelled` | Customer | Email | invoice-cancelled |
| `invoice.expired` | Customer | Email | invoice-expired |
| `payment.failed` | Customer | Email | payment-failed |
| `payment.failed` | Company | Webhook | `payment.failed` payload |
| `company.registered` | Company | Email | welcome + verify email |
| `company.email_verified` | Company | Email | activation confirmed |

## Endpoints (management only)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /notifications/logs | API Key | List notification logs (paginated) |
| GET | /notifications/logs/:id | API Key | Get delivery details |
| POST | /notifications/logs/:id/retry | API Key | Manually retry failed delivery |

## Business Rules

### Email
- Provider: Resend (primary)
- All emails are sent in the customer's language (pt-BR default, v1 only pt-BR)
- Failed email: retry 3x with exponential backoff (1min, 5min, 15min)
- After 3 failures: log as `failed`, do not retry automatically
- Unsubscribe link required in all customer-facing emails

### Webhook (company endpoints)
- Payload signed with HMAC-SHA256 using `WebhookEndpoint.secret`
- Signature sent in header: `X-Fluxa-Signature: sha256=<hash>`
- Delivery timeout: 10 seconds
- Retry on failure: 5 attempts with exponential backoff (1min, 5min, 15min, 1h, 6h)
- After 5 failures: log as `failed`, disable endpoint after 3 consecutive days of failure
- Payload always includes: `event`, `created_at`, `data`, `company_id`

### Queue
- Email and webhook deliveries are separate BullMQ queues
- Jobs are not lost on restart (Redis persistence)
- Dead-letter: failed jobs moved to `notifications:failed` queue for inspection

## Data Model
```
NotificationLog {
  id              UUID PK
  company_id      UUID FK → Company       -- tenant key
  type            ENUM(email, webhook)
  channel         STRING                  -- email address or webhook URL
  event           STRING                  -- e.g. 'invoice.paid'
  invoice_id      UUID? FK → Invoice
  status          ENUM(pending, sent, failed)
  attempts        INTEGER DEFAULT 0
  last_attempt_at TIMESTAMP?
  error           STRING?                 -- last error message
  payload         JSONB                   -- what was sent
  created_at      TIMESTAMP
}
```

## Dependencies
- Invoices module (event source)
- Payments module (event source)
- Companies module (webhook endpoints, tenant key)
- Customers module (recipient email)
- Resend SDK
- BullMQ + Redis

## Status
[ ] Planned  [ ] In Progress  [ ] Done
