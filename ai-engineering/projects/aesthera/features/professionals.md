# Feature: Professionals

## Summary
Professionals are the staff members of a clinic who perform services.
Each professional has their own working hours and service list.
They can log in to view their own schedule.

## Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /professionals | Clinic JWT | Create professional |
| GET | /professionals | Clinic JWT | List professionals (paginated) |
| GET | /professionals/:id | Clinic JWT | Get professional details |
| PATCH | /professionals/:id | Clinic JWT | Update professional |
| DELETE | /professionals/:id | Clinic JWT | Soft-delete professional |
| PUT | /professionals/:id/working-hours | Clinic JWT | Set working hours |
| GET | /professionals/:id/working-hours | Clinic JWT | Get working hours |
| PUT | /professionals/:id/services | Clinic JWT | Assign services to professional |
| GET | /professionals/:id/services | Clinic JWT | List assigned services |
| GET | /professionals/:id/schedule | Clinic JWT or Professional JWT | View schedule (appointments) |
| GET | /professionals/me/schedule | Professional JWT | Own schedule |
| POST | /professionals/:id/invite | Clinic JWT | Send login invite to professional |

## Business Rules
- Professional always belongs to a clinic (`clinic_id` required)
- Working hours override clinic business hours for that professional
- A professional can perform only services assigned to them
- Deleting a professional soft-deletes — existing appointments are preserved (status: orphaned)
- An invited professional receives email with password setup link (TTL 48h)
- A professional can only see their own appointments — not other professionals'

## Data Model
```
Professional {
  id             UUID PK
  clinic_id      UUID FK → Clinic        -- tenant key
  name           STRING NOT NULL
  email          STRING NOT NULL
  phone          STRING?
  speciality     STRING?
  avatar_url     STRING?
  active         BOOLEAN DEFAULT true
  deleted_at     TIMESTAMP?
  updated_at     TIMESTAMP
  created_at     TIMESTAMP

  UNIQUE(clinic_id, email)
}

ProfessionalWorkingHours {
  id               UUID PK
  professional_id  UUID FK → Professional
  clinic_id        UUID FK → Clinic       -- tenant key
  day_of_week      INTEGER NOT NULL       -- 0=Sun ... 6=Sat
  start_time       TIME NOT NULL
  end_time         TIME NOT NULL
  is_available     BOOLEAN DEFAULT true

  UNIQUE(professional_id, day_of_week)
}

ProfessionalService {
  professional_id  UUID FK → Professional
  service_id       UUID FK → Service
  clinic_id        UUID FK → Clinic       -- tenant key

  PRIMARY KEY (professional_id, service_id)
}
```

## Dependencies
- Clinics module (tenant key)
- Services module (assigned services)
- Appointments module (schedule view)
- Auth module (professional login)
- Notifications module (invite email)

## Status
[ ] Planned  [ ] In Progress  [ ] Done
