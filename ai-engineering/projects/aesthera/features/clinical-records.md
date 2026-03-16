# Feature: Clinical Records (Histórico Clínico)

## Summary
Append-only clinical records linked to customers. Each record captures clinical observations,
procedures, exams, and prescriptions with a timestamp and optional responsible professional.
Records can never be updated or deleted — only new records can be added.

---

## Data Model

```prisma
model ClinicalRecord {
  id             UUID PK
  clinicId       UUID FK → Clinic
  customerId     UUID FK → Customer
  professionalId UUID? FK → Professional
  title          String
  content        String        -- clinical notes (rich text)
  type           String        -- note | exam | procedure | prescription
  createdAt      DateTime      @default(now())
}
```

---

## API Endpoints

```
GET  /clinical-records?customerId=&type=&page=&limit=   — list records
POST /clinical-records                                    — create record (append-only)
```

### Rules
- Records are **append-only** — no PATCH/DELETE endpoints
- All records are scoped to `clinicId` (tenant isolation)
- `professionalId` is optional (can be null for admin entries)

---

## Frontend — Customer Profile Tab

The customer detail panel has a **"Clínico"** tab:
- Shows all clinical records sorted by date (newest first)
- "Novo registro" button opens inline form
- Form fields: tipo (note/procedure/exam/prescription), título, conteúdo
- After save, form closes and list refreshes

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial implementation: schema, API endpoints, frontend tab |
