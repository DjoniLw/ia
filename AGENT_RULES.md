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

## 9. Agent Responsibility Boundaries

**Only the `aesthera-implementador` agent may write or modify system code** (files under `aesthera/`).

All other agents — including `code-reviewer`, `ux-reviewer`, `security-auditor`, `aesthera-system-architect`, `aesthera-product-owner`, `aesthera-issue-writer`, `aesthera-consolidador`, and `aesthera-pipeline` — must **only generate documents** describing what needs to be done or corrected, targeting the implementador agent.

Exception: `test-guardian` may create or modify test files (`*.test.ts`, `*.spec.ts`) exclusively.

> ⚠️ Generating a document with corrections is not optional — it is the required output format for any agent that detects a problem but is not the implementador.

---

## 9. Concurrency and State Consistency (CRITICAL)

The system MUST handle concurrent operations safely.

- Prevent double booking (appointments)
- Prevent simultaneous wallet usage conflicts
- Avoid stale UI state after mutations

Frontend MUST:
- Refresh data after mutations
- Never rely on stale cached data

Backend MUST:
- Ensure atomic operations
- Use transactions and locking where necessary_This document governs all future implementations. Be strict, clear, and concise._

---

## 10. UI Standard Enforcement

All screens MUST:

- Have filters (when applicable)
- Have empty state with CTA ("Criar primeiro ...")
- Use icon-only actions (edit/delete)
- Use confirmation dialogs (never window.confirm)
- Use unsaved changes guard (isDirty)

Any deviation is considered a violation.

---

## 11. No Assumptions Rule

Do NOT assume business rules.

If something is unclear:

- Check ai-engineering definitions
- If not defined, ask or define before implementing

Never invent behavior.

---

## 12. Mandatory Pre-Implementation Check

Before coding ANY feature:

- Validate if definitions exist in ai-engineering
- If missing, create or update definitions
- Only then proceed with implementation

---

## 13. Anti-Regression Rule

New implementations MUST NOT break:

- existing flows
- existing business rules
- existing UI behavior

Always preserve backward compatibility.
