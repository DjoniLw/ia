# Feature: Authentication

## Summary
Aesthera has three auth contexts:

| Context | Who | How | Used for |
|---------|-----|-----|----------|
| **Clinic User** | Clinic owners/managers and staff | Email + password → JWT | Dashboard, settings, management (role-dependent) |
| **Professional** | Professionals linked to a clinic | Email + password → JWT (limited scope) | Their own schedule, appointments |
| **Platform Admin** | Aesthera staff | Email + password → JWT (admin role) | Platform management, support |

> Customers do not authenticate. They access booking/payment via public token links.
> Clinic users (admin + staff) are managed via the `users.md` module. See `features/users.md` for roles and permissions.

---

## Endpoints

### Clinic User Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/register | No | Register clinic → creates Clinic + first User (role: admin) + sends verification email |
| POST | /auth/verify-email | No | Verify email with token |
| POST | /auth/resend-verification | No | Resend verification email |
| POST | /auth/login | No | Email + password → access + refresh tokens (works for admin and staff) |
| POST | /auth/logout | Clinic JWT | Invalidate refresh token |
| POST | /auth/refresh | No (refresh token) | Rotate access token |
| POST | /auth/forgot-password | No | Send password reset email |
| POST | /auth/reset-password | No | Set new password via reset token |

> User invite flow (staff onboarding) is at `POST /users/invite` — see `features/users.md`.

### Professional Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/professional/login | No | Email + password → limited JWT |
| POST | /auth/professional/logout | Professional JWT | Invalidate refresh token |
| POST | /auth/professional/refresh | No (refresh token) | Rotate access token |

---

## Token Strategy

### Clinic User JWT
- **Access token**: TTL 15 min, payload: `{ sub: user_id, clinic_id, role: 'admin' | 'staff' }`
- **Refresh token**: TTL 7 days, stored in Redis as `user-refresh:<token_hash> → user_id`
- Refresh rotates on every use
- `JwtClinicGuard` accepts both `admin` and `staff` roles — `RoleGuard` restricts specific routes by role

### Professional JWT
- **Access token**: TTL 8h (shift duration), payload: `{ sub: professional_id, clinic_id, role: 'professional' }`
- **Refresh token**: TTL 7 days
- Scope: can only read/update appointments assigned to them within their `clinic_id`

### Platform Admin JWT
- TTL 15 min, payload: `{ sub: admin_id, role: 'platform_admin' }`
- Separate endpoint — not in public docs

---

## Registration Flow
```
POST /auth/register { name, email, password, clinic_name, clinic_slug, clinic_cnpj }
      ↓
Create Clinic (status: active, email_verified: false)
      ↓
Create User (role: admin, clinic_id, email, password_hash)
      ↓
Send verification email (token TTL 24h)
      ↓
POST /auth/verify-email { token }
      ↓
Clinic.email_verified = true → access granted
```

---

## Business Rules
- Email must be verified before clinic can access dashboard or invite users/professionals
- Password: min 8 chars, 1 uppercase, 1 number, 1 special character
- Max 5 failed logins → account locked 15 min (tracked in Redis)
- Password reset token: TTL 1h, single-use
- Email verification token: TTL 24h, resendable after 60 seconds
- Login uses the same endpoint for both `admin` and `staff` users — role is in the JWT

---

## Guards Summary
| Guard | Checks | Applied to |
|-------|--------|------------|
| `JwtClinicGuard` | Valid JWT, role in (admin, staff), clinic active | All dashboard routes |
| `RoleGuard(admin)` | Additionally checks role = admin | Financial, settings, user management routes |
| `JwtProfessionalGuard` | Valid JWT, role = professional, same clinic_id | Professional portal |
| `ApiKeyGuard` | Valid key hash, clinic active | Integration routes |
| `JwtAdminGuard` | Valid JWT, role = platform_admin | Platform admin routes |

---

## Data Model
```
-- Auth data lives in the User model (see features/users.md):
-- User { id, clinic_id, email, password_hash, role, failed_attempts, locked_until, ... }

ProfessionalAuth {
  id              UUID PK
  professional_id UUID FK → Professional UNIQUE
  clinic_id       UUID FK → Clinic        -- tenant key
  password_hash   STRING NOT NULL         -- bcrypt cost 12
  failed_attempts INTEGER DEFAULT 0
  locked_until    TIMESTAMP?
  updated_at      TIMESTAMP
}

-- Redis tokens (TTL-based):
-- verify-email:<token>         → clinic_id       (TTL 24h)
-- reset-password:<token>       → user_id         (TTL 1h)
-- user-refresh:<token_hash>    → user_id         (TTL 7d)
-- user-invite:<token>          → user_id         (TTL 48h)
-- user-lock:<user_id>          → attempts        (TTL 15min)
-- refresh-pro:<token_hash>     → professional_id (TTL 7d)
-- login-lock:<id>         → attempts        (TTL 15min)
```

## Dependencies
- Clinics module (clinic status check)
- Professionals module (professional lookup)
- Notifications module (verification + reset emails)
- Redis (token store, rate limiting, lockout)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
