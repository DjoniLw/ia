# Feature: Appointments

## Summary
Appointments are the core scheduling entity. A clinic books a customer
with a professional for a specific service at a specific date/time.
Availability is checked before booking to prevent double-booking.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /appointments | Clinic JWT or API Key | Create appointment |
| GET | /appointments | Clinic JWT or API Key | List appointments (paginated, filterable) |
| GET | /appointments/:id | Clinic JWT or API Key | Get appointment details |
| PATCH | /appointments/:id | Clinic JWT | Update appointment (reschedule) |
| POST | /appointments/:id/confirm | Clinic JWT | Confirm appointment |
| POST | /appointments/:id/start | Clinic JWT or Professional JWT | Mark as in progress |
| POST | /appointments/:id/complete | Clinic JWT or Professional JWT | Mark as completed |
| POST | /appointments/:id/cancel | Clinic JWT | Cancel appointment |
| POST | /appointments/:id/no-show | Clinic JWT | Mark customer as no-show |
| GET | /appointments/availability | Clinic JWT or API Key | Check available slots |
| GET | /appointments/calendar | Clinic JWT or Professional JWT | Calendar view (day or week) |
| POST | /appointments/blocked-slots | Clinic JWT | Create a blocked slot (break, day off, etc.) |
| GET | /appointments/blocked-slots | Clinic JWT | List blocked slots |
| DELETE | /appointments/blocked-slots/:id | Clinic JWT | Remove a blocked slot |

## State Machine
```
draft → confirmed → in_progress → completed
                               ↘ no_show
         ↘ cancelled
```
- Only `draft` and `confirmed` appointments can be cancelled
- Only `confirmed` appointments can be started
- Only `in_progress` appointments can be completed or marked no_show
- `completed` and `cancelled` are terminal states

## Availability Check
- Input: `professional_id` + `service_id` + `date`
- Output: list of available start times (15-min granularity)
- Logic: fetch professional working hours for that day → subtract existing `confirmed`/`in_progress` appointments → subtract `BlockedSlot` entries → return free slots
- Must be checked inside a DB transaction at booking time (prevent race conditions / double-booking)

## Calendar View (`GET /appointments/calendar`)
- Query params: `date` (required) · `view` (day | week, default: day) · `professional_id` (optional — omit for all)
- Response: appointments grouped by professional and ordered by `scheduled_at`
- Each entry includes: appointment id, customer name, service name, start time, duration, status, color hint
- Blocked slots are included in the response as separate entries (type: `blocked`)
- Used to render the visual schedule grid on the dashboard

```json
// Example response shape
{
  "date": "2026-03-11",
  "view": "day",
  "professionals": [
    {
      "id": "uuid",
      "name": "Ana",
      "slots": [
        { "type": "appointment", "start": "09:00", "duration": 60, "status": "confirmed", "customer": "Maria", "service": "Botox" },
        { "type": "blocked", "start": "12:00", "duration": 60, "reason": "Lunch break" },
        { "type": "appointment", "start": "14:00", "duration": 45, "status": "draft", "customer": "João", "service": "Facial" }
      ]
    }
  ]
}
```

## Business Rules
- Professional must be assigned to the requested service
- Slot must be within professional's working hours for that day
- Slot must not overlap a `BlockedSlot` for that professional
- Clinic must be active and not suspended
- On **confirmation** (`draft → confirmed`): WhatsApp + email sent to customer (BullMQ job)
- D-1 reminder scheduled via BullMQ at confirmation time (delayed job, cancelled if appointment is cancelled or rescheduled)
- Rescheduling: only allowed on `draft` or `confirmed` — triggers new confirmation notification
- `notes` field: clinic's internal notes about the appointment
- A `BlockedSlot` can be a one-time block (specific date) or recurring (e.g. every day 12–13h)
- Blocked slots prevent new bookings in that window — existing appointments are not auto-cancelled
- **Notification timing**: confirmation WhatsApp + email is sent on `appointment.confirmed` (NOT on `draft` creation). D-1 reminder job is scheduled at confirmation time.
- **R10 — Sala obrigatória**: `roomId` é obrigatório em toda criação de agendamento. Se não fornecido, o serviço lança `AppError('Sala é obrigatória para confirmar o agendamento', 400, 'ROOM_REQUIRED')`. A verificação ocorre antes da transação DB.

## Query Filters (GET /appointments)
- `professional_id`
- `customer_id`
- `service_id`
- `status`
- `date` (exact) or `date_from` / `date_to` range
- `created_at` range

## Data Model
```
BlockedSlot {
  id               UUID PK
  clinic_id        UUID FK → Clinic         -- tenant key
  professional_id  UUID FK → Professional
  reason           STRING?                  -- e.g. 'Lunch', 'Day off', 'Training'
  date             DATE?                    -- null if recurring
  start_time       TIME NOT NULL
  end_time         TIME NOT NULL
  recurrence       ENUM(none, daily, weekly) DEFAULT none
  day_of_week      INTEGER?                 -- 0–6, used when recurrence = weekly
  created_at       TIMESTAMP
}

Appointment {
  id               UUID PK
  clinic_id        UUID FK → Clinic         -- tenant key
  customer_id      UUID FK → Customer
  professional_id  UUID FK → Professional
  service_id       UUID FK → Service
  status           ENUM(draft, confirmed, in_progress, completed, cancelled, no_show) DEFAULT draft
  scheduled_at     TIMESTAMP NOT NULL       -- start date+time
  duration_minutes INTEGER NOT NULL         -- copied from service at booking time
  price            INTEGER NOT NULL         -- BRL cents, copied from service (can be overridden)
  notes            TEXT?
  cancellation_reason STRING?
  completed_at     TIMESTAMP?
  cancelled_at     TIMESTAMP?
  reminder_job_id  STRING?                  -- BullMQ job ID for D-1 reminder (for cancellation)
  updated_at       TIMESTAMP
  created_at       TIMESTAMP
}
```

## Events Emitted
| Event | Trigger | Notification? |
|-------|---------|--------------|
| `appointment.created` | Appointment created (status: draft) | No — awaiting confirmation |
| `appointment.confirmed` | Status → confirmed | ✅ WhatsApp + email to customer; D-1 reminder scheduled |
| `appointment.rescheduled` | Date/time changed | ✅ WhatsApp + email to customer; old D-1 cancelled, new one scheduled |
| `appointment.completed` | Status → completed | No — triggers `billing.created` |
| `appointment.cancelled` | Status → cancelled | ✅ WhatsApp + email to customer; D-1 reminder cancelled |
| `appointment.no_show` | Status → no_show | ✅ Email alert to clinic (internal) |

## Dependencies
- Clinics module (clinic status, business hours)
- Professionals module (availability, assigned services)
- Services module (service details, duration, price)
- Customers module (customer details, WhatsApp phone)
- Billing module (auto-created on `appointment.completed`)
- Notifications module (confirmation, reminder, cancellation)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
