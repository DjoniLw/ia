# Feature: Customers

## Summary
Customers are the end-payers managed by a company. A customer belongs to one company (multi-tenant).
Companies register their customers to create invoices and charge them.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /customers | API Key | Create customer |
| GET | /customers | API Key | List customers (paginated, filterable) |
| GET | /customers/:id | API Key | Get customer by ID |
| PATCH | /customers/:id | API Key | Update customer |
| DELETE | /customers/:id | API Key | Soft-delete customer |
| GET | /customers/:id/invoices | API Key | List customer invoices |
| GET | /customers/:id/payment-history | API Key | Payment history summary |

## Business Rules
- A customer always belongs to a company (`company_id` required)
- `email` or `document` (CPF/CNPJ) must be provided — at least one
- `external_id` is optional: allows companies to map their own internal IDs
- Duplicate check per company: same `document` or `email` within same `company_id` is rejected
- Deleting a customer soft-deletes — existing invoices are preserved
- Customers cannot be shared between companies

## Query Filters (GET /customers)
- `email`
- `document`
- `external_id`
- `name` (partial match)
- `status` (active | deleted)
- `created_at` range

## Data Model
```
Customer {
  id           UUID PK
  company_id   UUID FK → Company       -- tenant key
  external_id  STRING?                 -- company's own ID
  name         STRING NOT NULL
  email        STRING?
  document     STRING?                 -- CPF or CNPJ
  phone        STRING?
  address      JSONB?                  -- street, city, state, zip, country
  metadata     JSONB?                  -- free key-value for company use
  deleted_at   TIMESTAMP?
  updated_at   TIMESTAMP
  created_at   TIMESTAMP

  UNIQUE(company_id, email)
  UNIQUE(company_id, document)
  UNIQUE(company_id, external_id)
}
```

## Dependencies
- Companies module (tenant validation)
- Invoices module (customer invoices)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
