# Feature: Authentication

## Summary
Fluxa has two distinct auth contexts that must never be mixed:

| Context | Who | How | Used for |
|---------|-----|-----|----------|
| **Company Auth** | Company admins (dashboard) | Email + password → JWT | Dashboard, settings, API key management |
| **API Key Auth** | Company integrations | `Authorization: Bearer fluxa_<key>` | All data API endpoints (invoices, customers, payments...) |
| **Internal Admin** | Fluxa staff | Email + password → JWT (admin role) | Platform management |

> Customers (end-payers) never authenticate. They access invoices via public `/pay/:token` links.

---

## Endpoints

### Company Auth (dashboard login)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/register | No | Register company + send verification email |
| POST | /auth/verify-email | No | Verify email with token |
| POST | /auth/resend-verification | No | Resend verification email |
| POST | /auth/login | No | Email + password → access + refresh tokens |
| POST | /auth/logout | Company JWT | Invalidate refresh token |
| POST | /auth/refresh | No (refresh token) | Rotate access token |
| POST | /auth/forgot-password | No | Send password reset email |
| POST | /auth/reset-password | No | Set new password via reset token |

### API Key Auth (no login flow — managed via /companies/me/api-keys)
> API keys are created in the Companies module. Auth module only validates them.

---

## Token Strategy

### Company JWT (dashboard)
- **Access token**: TTL 15 min, signed HS256, payload: `{ sub: company_id, role: 'company' }`
- **Refresh token**: TTL 30 days, stored in Redis as `refresh:<token_hash> → company_id`
- Refresh rotates on every use (old token invalidated immediately)
- Logout: deletes refresh token from Redis

### API Key (integrations)
- Format: `fluxa_live_<32 random chars>` (production) / `fluxa_test_<32 random chars>` (test mode)
- Stored as bcrypt hash in DB; never retrievable after creation
- Validation: hash incoming key → compare to stored hash → load company
- Rejected if: key not found, expired, company suspended or deleted
- `last_used_at` updated on each valid request (async, non-blocking)

### Internal Admin JWT
- **Access token**: TTL 15 min, payload: `{ sub: admin_id, role: 'admin' }`
- Separate login endpoint — not exposed in public docs
- Admin role checked by `AdminGuard` — cannot be elevated from company tokens

---

## Business Rules
- Email must be verified before company can use dashboard or generate API keys
- Password: min 8 chars, 1 uppercase, 1 number, 1 special character
- Max 5 failed logins → account locked for 15 min (tracked in Redis)
- Password reset token: TTL 1h, single-use (deleted after use)
- Email verification token: TTL 24h, resendable after 60 seconds
- A company can be logged in from multiple sessions simultaneously
- API key requests bypass JWT entirely — handled by `ApiKeyGuard`

---

## Guards Summary
| Guard | Checks | Applied to |
|-------|--------|------------|
| `JwtCompanyGuard` | Valid JWT, role = company, company active | Dashboard routes |
| `ApiKeyGuard` | Valid key hash, company active, key not expired | Data API routes |
| `JwtAdminGuard` | Valid JWT, role = admin | Admin routes |
| `EmailVerifiedGuard` | `company.email_verified = true` | Post-login routes |

---

## Data Model
```
CompanyAuth {
  id              UUID PK
  company_id      UUID FK → Company UNIQUE
  password_hash   STRING NOT NULL         -- bcrypt cost 12
  failed_attempts INTEGER DEFAULT 0
  locked_until    TIMESTAMP?
  updated_at      TIMESTAMP
}

-- Tokens stored in Redis (TTL-based, not in DB):
-- verify-email:<token>    → company_id  (TTL 24h)
-- reset-password:<token>  → company_id  (TTL 1h)
-- refresh:<token_hash>    → company_id  (TTL 30d)
-- login-lock:<company_id> → attempts    (TTL 15min)
```

> `Company` table lives in the companies module. Auth only manages credentials and tokens.

---

## Dependencies
- Companies module (`company_id` FK, status check)
- Notifications module (verification + reset emails)
- Redis (token store, rate limiting, lockout)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
