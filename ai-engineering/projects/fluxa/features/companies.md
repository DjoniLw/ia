# Feature: Companies

## Summary
Companies are the tenants of Fluxa. Every resource (customers, invoices, payments) belongs to a company.
A company registers, configures their payment gateways, and uses the API to charge their own customers.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /companies | No | Register new company (onboarding) |
| GET | /companies/me | Company JWT | Get own company profile |
| PATCH | /companies/me | Company JWT | Update company info |
| DELETE | /companies/me | Company JWT | Soft-delete company |
| GET | /companies/me/api-keys | Company JWT | List API keys |
| POST | /companies/me/api-keys | Company JWT | Generate new API key |
| DELETE | /companies/me/api-keys/:id | Company JWT | Revoke API key |
| GET | /companies/me/webhooks | Company JWT | List webhook endpoints |
| POST | /companies/me/webhooks | Company JWT | Register webhook endpoint |
| DELETE | /companies/me/webhooks/:id | Company JWT | Remove webhook endpoint |
| GET | /companies | Admin | List all companies (paginated) |
| PATCH | /companies/:id/status | Admin | Activate / suspend company |

## Business Rules
- Every company gets a unique `company_id` (UUID) used as tenant key in all tables
- Registration triggers email verification before full access is granted
- API keys are hashed before storage — shown only once at creation
- A company can have multiple API keys (e.g. production, staging)
- API keys have optional expiration date and can be named
- Webhook endpoints receive events: `invoice.paid`, `invoice.overdue`, `payment.failed`
- Suspended companies: API keys are rejected, no new invoices can be created
- Deletion is soft — data retained 90 days before purge

## Data Model
```
Company {
  id             UUID PK
  name           STRING NOT NULL
  email          STRING UNIQUE NOT NULL
  document       STRING UNIQUE NOT NULL   -- CNPJ
  plan           ENUM(free, starter, pro) DEFAULT free
  status         ENUM(active, suspended, deleted) DEFAULT active
  email_verified BOOLEAN DEFAULT false
  deleted_at     TIMESTAMP?
  updated_at     TIMESTAMP
  created_at     TIMESTAMP
}

ApiKey {
  id             UUID PK
  company_id     UUID FK → Company
  name           STRING
  key_hash       STRING NOT NULL          -- bcrypt hash
  key_prefix     STRING NOT NULL          -- first 8 chars shown in UI
  expires_at     TIMESTAMP?
  last_used_at   TIMESTAMP?
  created_at     TIMESTAMP
}

WebhookEndpoint {
  id             UUID PK
  company_id     UUID FK → Company
  url            STRING NOT NULL
  secret         STRING NOT NULL          -- used to sign payloads
  events         STRING[]                 -- subscribed event types
  active         BOOLEAN DEFAULT true
  created_at     TIMESTAMP
}
```

## Dependencies
- Auth module (company JWT + admin guard)
- Notifications module (email verification)
- All other modules depend on this (company_id as tenant key)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
