# Feature: Users

## Summary
Users are the people who operate the clinic dashboard on behalf of a clinic.
A clinic can have multiple users with different roles — controlling what each person can see and do.
The clinic owner (created at registration) is the first `admin` user automatically.

## Roles
| Role | Access |
|------|--------|
| `admin` | Full access — all modules including financial, settings, user management |
| `staff` | Operational access — appointments, customers, services. No financial or settings. |

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /users | Clinic JWT (admin) | List clinic users |
| POST | /users/invite | Clinic JWT (admin) | Invite new user via email |
| GET | /users/:id | Clinic JWT (admin) | Get user details |
| PATCH | /users/:id | Clinic JWT (admin) | Update user role or info |
| DELETE | /users/:id | Clinic JWT (admin) | Deactivate user |
| GET | /users/me | Clinic JWT | Get own profile |
| PATCH | /users/me | Clinic JWT | Update own profile (name, password) |
| POST | /users/accept-invite | No | Accept invite and set password |

## Business Rules
- A clinic always has at least one `admin` — the last admin cannot be deleted or downgraded
- Only `admin` users can invite, edit, or deactivate other users
- Invite: sends email with a setup link (TTL 48h, single-use)
- If invite expires, admin can re-send a new one
- A deactivated user cannot log in but their audit trail is preserved
- `staff` users cannot access: billing, payments, ledger, financial summary, settings, user management
- Clinic JWT payload includes `role` — checked by `RoleGuard` on restricted routes

## Permission Matrix
| Action | admin | staff |
|--------|-------|-------|
| Manage appointments | ✅ | ✅ |
| Manage customers | ✅ | ✅ |
| Manage services | ✅ | ✅ |
| View own schedule (professional) | – | – |
| Manage professionals | ✅ | ❌ |
| View billing / payments | ✅ | ❌ |
| View ledger / financial summary | ✅ | ❌ |
| Clinic settings / business hours | ✅ | ❌ |
| Manage users | ✅ | ❌ |

## Data Model
```
User {
  id             UUID PK
  clinic_id      UUID FK → Clinic        -- tenant key
  name           STRING NOT NULL
  email          STRING NOT NULL
  password_hash  STRING?                 -- null until invite accepted
  role           ENUM(admin, staff) NOT NULL
  active         BOOLEAN DEFAULT true
  invite_token   STRING?                 -- hashed, single-use
  invite_expires_at TIMESTAMP?
  last_login_at  TIMESTAMP?
  created_at     TIMESTAMP
  updated_at     TIMESTAMP

  UNIQUE(clinic_id, email)
}

-- Redis tokens:
-- user-invite:<token>       → user_id  (TTL 48h)
-- user-refresh:<token_hash> → user_id  (TTL 7d)
-- user-lock:<user_id>       → attempts (TTL 15min)
```

## Auth Integration
- JWT payload for users: `{ sub: user_id, clinic_id, role: 'admin' | 'staff' }`
- Refresh token: TTL 7 days, stored in Redis
- Login lockout: 5 failed attempts → 15 min lock (same as clinic admin)
- `JwtClinicGuard` validates both the old clinic owner JWT and user JWT
  (both share the same guard — distinguished by payload shape)

## Dependencies
- Clinics module (tenant key, clinic status check)
- Auth module (JWT issuance, token storage)
- Notifications module (invite email)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
