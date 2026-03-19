# Feature: Rooms

## Summary
Clinic room/treatment space catalog — track which physical rooms exist and assign them to appointments.

---

## Data Model

```prisma
model Room {
  id          String    @id @default(uuid())
  clinicId    String    -- FK → Clinic (tenant key)
  name        String    -- unique per clinic (case-insensitive)
  description String?
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

---

## API Endpoints

```
GET    /rooms        — list all rooms for the clinic
POST   /rooms        — create room (admin only)
PATCH  /rooms/:id    — update room (admin only)
DELETE /rooms/:id    — delete room (admin only)
```

### Business Rules
- Room name must be unique per clinic (case-insensitive comparison)
- Duplicate name → error 409 `ROOM_EXISTS`
- Room not found → error 404
- All operations are scoped to `clinicId`

---

## Frontend Pages

### /rooms — Room Catalog
- List all clinic rooms with active/inactive status
- Create / Edit room dialog (name, description)
- Toggle active status

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial: Rooms CRUD |
