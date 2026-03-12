# Feature: Customers

## Summary
Customers are the patients/clients managed by a clinic.
A customer belongs to one clinic (multi-tenant). They do not authenticate —
they receive booking confirmations and payment links via WhatsApp and email.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /customers | Clinic JWT or API Key | Create customer |
| GET | /customers | Clinic JWT or API Key | List customers (paginated, filterable) |
| GET | /customers/:id | Clinic JWT or API Key | Get customer details |
| PATCH | /customers/:id | Clinic JWT or API Key | Update customer |
| DELETE | /customers/:id | Clinic JWT or API Key | Soft-delete customer |
| GET | /customers/:id/appointments | Clinic JWT | Appointment history |
| GET | /customers/:id/billing | Clinic JWT | Billing history |

## Business Rules
- Customer always belongs to a clinic (`clinic_id` required)
- `phone` or `email` must be provided — at least one
- WhatsApp notifications require `phone` in E.164 format (e.g. +5511999999999)
- Duplicate check per clinic: same `document` or `email` within same `clinic_id` is rejected
- Deleting is soft — existing appointments and billing records are preserved
- Customers cannot be shared between clinics

## Query Filters (GET /customers)
- `name` (partial match)
- `email`
- `phone`
- `document` (CPF)
- `status` (active | deleted)
- `created_at` range

## Data Model
```
Customer {
  id             UUID PK
  clinic_id      UUID FK → Clinic        -- tenant key
  external_id    STRING?                 -- clinic's own ID (optional mapping)
  name           STRING NOT NULL
  email          STRING?
  phone          STRING?                 -- E.164 for WhatsApp
  document       STRING?                 -- CPF
  birth_date     DATE?
  address        JSONB?                  -- street, city, state, zip
  notes          TEXT?                   -- clinical/aesthetic notes
  metadata       JSONB?                  -- free key-value for clinic use
  deleted_at     TIMESTAMP?
  updated_at     TIMESTAMP
  created_at     TIMESTAMP

  UNIQUE(clinic_id, email)
  UNIQUE(clinic_id, document)
  UNIQUE(clinic_id, external_id)
}
```

## Dependencies
- Clinics module (tenant key)
- Appointments module (appointment history)
- Billing module (billing history)
- Notifications module (WhatsApp + email recipient)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
