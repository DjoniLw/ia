# AGENT_RULES.md — Aesthera System

> These rules are **mandatory** for all AI-driven development in this repository.  
> Every agent, automation, or developer must follow them without exception.

---

## 1. Source of Truth

`ai-engineering/projects/aesthera` is the **authoritative source** for:

- **Architecture** — system structure, modules, service boundaries
- **Business rules** — domain logic, constraints, and workflows
- **System design** — data models, API contracts, integration patterns

No implementation decision may contradict definitions stored there.

---

## 2. Mandatory Development Workflow

For **any** change, large or small:

1. **Validate or update** the relevant definitions in `ai-engineering/projects/aesthera`
2. **Then** implement the change in `aesthera`

> ⚠️ Never skip or reverse this step. Code must always follow the documented design.

---

## 3. UI/UX Rules

- All interfaces **must** follow the standards defined in [`docs/ui-standards.md`](./aesthera/docs/ui-standards.md)
- **Reuse** existing components whenever possible — do not duplicate UI elements
- **Maintain consistency** across all screens in layout, naming, and interaction patterns

---

## 4. Data Integrity Rules

- **Never allow orphan records** — every child record must have a valid parent
- **Enforce referential integrity** at both the database level and the backend layer
- **Safe delete only** — use soft-delete or cascade strategies; never hard-delete without explicit justification

---

## 5. Business Rules Consistency

All implementations must respect:

- **Wallet system** — vouchers, credits, cashback, and packages must behave according to their defined rules
- **Billing flow** — charges, refunds, and invoicing must follow the documented billing process
- **Appointment rules** — double booking is strictly prohibited; scheduling constraints must be enforced

---

## 6. Change Safety Rules

- Changes must be **minimal and isolated** — affect only what is required by the task
- **Do NOT refactor** unrelated code as part of a feature or fix
- **Do NOT break existing features** — validate that current behavior is preserved after every change

---

## 7. Required Output for Tasks

After any implementation, always report:

- **What was changed in `aesthera`** — files modified, logic added or updated, components affected
- **What was updated in `ai-engineering`** — definitions, diagrams, or documentation that were revised

---

## 8. Final Rule

If definitions are missing or outdated in `ai-engineering/projects/aesthera`:

> **→ Update them BEFORE writing any code.**

Never implement against an undefined or stale specification.

---

_This document governs all future implementations. Be strict, clear, and concise._
