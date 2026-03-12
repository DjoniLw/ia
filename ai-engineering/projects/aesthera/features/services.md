# Feature: Services

## Summary
Services are the catalog of treatments/procedures offered by a clinic.
Each service has a name, duration, price, and category.
Services are assigned to professionals who can perform them.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /services | Clinic JWT | Create service |
| GET | /services | Clinic JWT | List services (paginated, filterable) |
| GET | /services/:id | Clinic JWT | Get service details |
| PATCH | /services/:id | Clinic JWT | Update service |
| DELETE | /services/:id | Clinic JWT | Soft-delete service |

## Business Rules
- Service always belongs to a clinic (`clinic_id` required)
- `duration_minutes` must be > 0 and in 15-minute increments (e.g. 30, 45, 60, 90)
- `price` in BRL cents (integer), must be >= 0 (services can be free)
- Deleting a service soft-deletes — existing appointments are preserved
- A deactivated service cannot be booked in new appointments
- Service can be assigned to multiple professionals

## Query Filters (GET /services)
- `category`
- `active` (true | false)
- `name` (partial match)

## Data Model
```
Service {
  id                 UUID PK
  clinic_id          UUID FK → Clinic    -- tenant key
  name               STRING NOT NULL
  description        STRING?
  category           STRING?             -- e.g. 'facial', 'body', 'hair'
  duration_minutes   INTEGER NOT NULL    -- must be multiple of 15
  price              INTEGER NOT NULL    -- BRL cents
  active             BOOLEAN DEFAULT true
  deleted_at         TIMESTAMP?
  updated_at         TIMESTAMP
  created_at         TIMESTAMP
}
```

## Dependencies
- Clinics module (tenant key)
- Professionals module (service assignment)
- Appointments module (booked service)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
