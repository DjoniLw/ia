# Feature: Notifications

## Summary
Handles all outbound communication triggered by domain events:
WhatsApp messages (primary) and emails (secondary) to customers,
and internal alerts to clinic staff. All notifications are async via BullMQ.

## Triggers (event-driven — no direct API)
| Event | Recipient | Channel | Content |
|-------|-----------|---------|---------|
| `appointment.created` | Customer | WhatsApp + Email | Booking confirmation with details |
| `appointment.confirmed` | Customer | WhatsApp | Confirmation message |
| `appointment.rescheduled` | Customer | WhatsApp + Email | New date/time details |
| `appointment.cancelled` | Customer | WhatsApp + Email | Cancellation notification |
| `appointment.completed` → D-1 scheduled | Customer | WhatsApp | Reminder: appointment tomorrow |
| `appointment.no_show` | Clinic (internal) | Email | No-show logged alert |
| `billing.created` | Customer | WhatsApp + Email | Payment link |
| `payment.succeeded` | Customer | WhatsApp + Email | Payment receipt |
| `payment.failed` | Customer | WhatsApp | Payment failed, try again |
| `clinic.registered` | Clinic Admin | Email | Welcome + email verification |
| `professional.invited` | Professional | Email | Account setup invitation |

## Endpoints (management only)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /notifications/logs | Clinic JWT | List notification logs (paginated) |
| GET | /notifications/logs/:id | Clinic JWT | Get delivery details |
| POST | /notifications/logs/:id/retry | Clinic JWT | Manually retry failed delivery |

## Business Rules

### WhatsApp
- Provider: Z-API or Evolution API (HTTP REST)
- Phone must be E.164 format — skip if missing
- Message templates in pt-BR (v1)
- Failed delivery: retry 3x with exponential backoff (1min, 5min, 15min)
- After 3 failures: log as `failed`, do not block other notifications

### Email
- Provider: Resend
- All transactional (receipts, confirmations, verification)
- Failed email: retry 3x with exponential backoff
- After 3 failures: log as `failed`

### D-1 Reminder
- Scheduled BullMQ delayed job created at appointment booking
- Job fires at 9:00 AM the day before the appointment (clinic timezone)
- Job is cancelled (removed from queue) if appointment is cancelled or rescheduled
- Uses `reminder_job_id` stored on the Appointment record

### Queue
- Separate BullMQ queues: `notifications:whatsapp` · `notifications:email`
- Jobs not lost on restart (Redis persistence)
- Dead-letter: failed jobs → `notifications:failed` queue

## Data Model
```
NotificationLog {
  id              UUID PK
  clinic_id       UUID FK → Clinic        -- tenant key
  type            ENUM(whatsapp, email)
  channel         STRING                  -- phone number or email address
  event           STRING                  -- e.g. 'appointment.created'
  appointment_id  UUID? FK → Appointment
  billing_id      UUID? FK → Billing
  status          ENUM(pending, sent, failed)
  attempts        INTEGER DEFAULT 0
  last_attempt_at TIMESTAMP?
  error           STRING?
  payload         JSONB                   -- what was sent
  created_at      TIMESTAMP
}
```

## Dependencies
- Appointments module (event source, reminder scheduling)
- Billing module (event source)
- Payments module (event source)
- Customers module (recipient phone + email)
- Clinics module (clinic timezone, tenant key)
- Z-API / Evolution API (WhatsApp delivery)
- Resend (email delivery)
- BullMQ + Redis

## Status
[ ] Planned  [ ] In Progress  [ ] Done
