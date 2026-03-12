# Feature: Clinics

## Summary
Clinics are the tenants of Aesthera. Every resource belongs to a clinic.
A clinic represents one business unit — a single location/branch.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /clinics | No | Register new clinic (onboarding) |
| GET | /clinics/me | Clinic JWT | Get own clinic profile |
| PATCH | /clinics/me | Clinic JWT | Update clinic info |
| DELETE | /clinics/me | Clinic JWT | Soft-delete clinic |
| GET | /clinics/me/business-hours | Clinic JWT | Get working hours config |
| PUT | /clinics/me/business-hours | Clinic JWT | Set working hours |
| GET | /clinics/me/api-keys | Clinic JWT | List API keys |
| POST | /clinics/me/api-keys | Clinic JWT | Generate API key |
| DELETE | /clinics/me/api-keys/:id | Clinic JWT | Revoke API key |
| GET | /clinics | Admin | List all clinics (paginated) |
| PATCH | /clinics/:id/status | Admin | Activate / suspend clinic |

## Business Rules
- Every clinic gets a unique `clinic_id` (UUID) used as tenant key in all tables
- `slug` is chosen at registration, URL-safe, lowercase, letters/numbers/hyphens only (e.g. `clinica-ana`)
- `slug` is unique and immutable after first use — changing it would break bookmarked URLs
- Registration triggers email verification before full access
- Business hours define the available time window for booking appointments
- Suspended clinics: no new appointments, payments rejected
- Deletion is soft — data retained 90 days before purge
- A clinic can have multiple API keys (production, staging, etc.)

## Tenant Resolution (subdomain strategy)
The frontend runs on `*.aesthera.com.br` (DNS wildcard).

```
User accesses: clinicaana.aesthera.com.br
        ↓
Next.js reads subdomain from request host header
        ↓
Sends header to backend: X-Clinic-Slug: clinicaana
        ↓
Backend middleware: slug → clinic_id (Redis cache, TTL 5min)
        ↓
All subsequent queries scoped to that clinic_id
```

**Fallback (login page without subdomain):**
```
User accesses: aesthera.com.br/login
        ↓
User enters email + slug/clinic name
        ↓
Frontend redirects to: [slug].aesthera.com.br
        ↓
Normal subdomain flow continues
```

**Slug resolution middleware** (`shared/middleware/tenant.middleware.ts`):
- Reads `X-Clinic-Slug` header (set by frontend from subdomain)
- Looks up `clinic_id` in Redis first (key: `slug:<slug>`) — cache TTL 5min
- On miss: queries DB `SELECT id FROM clinics WHERE slug = ? AND status != 'deleted'`
- Stores result in Redis
- Attaches `clinic_id` to request context
- Returns `404` if slug not found, `403` if clinic suspended

## Data Model
```
Clinic {
  id             UUID PK
  slug           STRING UNIQUE NOT NULL   -- URL identifier: clinicaana.aesthera.com.br
  name           STRING NOT NULL
  email          STRING UNIQUE NOT NULL
  document       STRING UNIQUE NOT NULL   -- CNPJ
  phone          STRING?
  address        JSONB?                   -- street, city, state, zip
  plan           ENUM(free, starter, pro) DEFAULT free
  status         ENUM(active, suspended, deleted) DEFAULT active
  email_verified BOOLEAN DEFAULT false
  timezone       STRING DEFAULT 'America/Sao_Paulo'
  deleted_at     TIMESTAMP?
  updated_at     TIMESTAMP
  created_at     TIMESTAMP
}

BusinessHours {
  id             UUID PK
  clinic_id      UUID FK → Clinic
  day_of_week    INTEGER NOT NULL         -- 0=Sun, 1=Mon ... 6=Sat
  open_time      TIME NOT NULL            -- e.g. 08:00
  close_time     TIME NOT NULL            -- e.g. 18:00
  is_open        BOOLEAN DEFAULT true

  UNIQUE(clinic_id, day_of_week)
}

ApiKey {
  id             UUID PK
  clinic_id      UUID FK → Clinic
  name           STRING
  key_hash       STRING NOT NULL
  key_prefix     STRING NOT NULL          -- first 8 chars shown in UI
  expires_at     TIMESTAMP?
  last_used_at   TIMESTAMP?
  created_at     TIMESTAMP
}
```

## Dependencies
- Auth module
- All other modules depend on this (clinic_id as tenant key)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
