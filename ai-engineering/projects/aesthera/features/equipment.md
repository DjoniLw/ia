# Feature: Equipment

## Summary
Clinic equipment catalog management — track what physical equipment exists in the clinic and link it to appointments.

---

## Data Model

```prisma
model Equipment {
  id          String    @id @default(uuid())
  clinicId    String    -- FK → Clinic (tenant key)
  name        String    -- unique per clinic (case-insensitive)
  description String?
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model AppointmentEquipment {
  id            String      @id @default(uuid())
  appointmentId String      -- FK → Appointment
  equipmentId   String      -- FK → Equipment
  clinicId      String      -- FK → Clinic (denormalized for tenant filtering)
}
```

---

## API Endpoints

```
GET    /equipment        — list all equipment for the clinic
POST   /equipment        — create equipment (admin only)
PATCH  /equipment/:id    — update equipment (admin only)
DELETE /equipment/:id    — delete equipment (admin only)
```

### Business Rules
- Equipment name must be unique per clinic (case-insensitive comparison)
- Duplicate name → error 409 `EQUIPMENT_EXISTS`
- Equipment not found → error 404
- All operations are scoped to `clinicId`

---

## Frontend Pages

### /equipment — Equipment Catalog
- List all clinic equipment with active/inactive status
- Create / Edit equipment dialog (name, description)
- Toggle active status

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: Equipment CRUD + AppointmentEquipment junction |
