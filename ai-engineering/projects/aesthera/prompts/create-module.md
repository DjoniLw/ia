# Prompt: Create Module — Aesthera

> Extends: `shared/prompts/create-module.md`
> Stack: Node.js + Fastify + TypeScript + Prisma + Zod + Vitest

## Instructions to AI
- Read `AGENT_RULES.md` (repo root) before starting — it governs all decisions.
- Stack: Node.js + Fastify + TypeScript + Prisma + Zod + Vitest
- Pattern: Modular Monolith — follow folder structure in `context/architecture.md`
- Always include `clinic_id` on queries (multi-tenant — never leak data between clinics)
- Use the correct guard per route: `JwtClinicGuard`, `JwtProfessionalGuard`, `ApiKeyGuard`, `JwtAdminGuard`
- Emit domain events where specified in the feature file
- Do not add unasked features. Do not pad with comments.

## Prompt Template
```
Create the [MODULE_NAME] module for Aesthera.

Reference files:
- context/stack.md
- context/architecture.md
- features/[module].md

Files to generate (one at a time if large):
- [module].controller.ts  → routes, guards, Zod validation
- [module].service.ts     → business logic, domain events
- [module].repository.ts  → Prisma queries (always filter by clinic_id)
- [module].dto.ts         → Zod schemas for input/output
- [module].test.ts        → unit tests for service (mock repository + externals)

Constraints:
- All queries must include WHERE clinic_id = :clinic_id
- Throw typed errors (use shared/errors/)
- Emit domain events via shared/events/event-bus.ts where the feature file specifies
- No raw SQL — use Prisma only
- No any types — strict TypeScript

Feature spec:
[paste full content of features/[module].md]
```

## Tips
- Generate one file per message to keep responses focused.
- For the appointments module, ask for availability check logic separately.
- For BullMQ reminder jobs, ask for the job processor separately.
- After generating, use `shared/prompts/code-review.md` before committing.

## Required Output (after every generation)
After generating the module, the agent MUST report:

1. **Files created/modified in `aesthera/`** — list every file with a one-line summary of what changed.
2. **`ai-engineering/` updates** — list any feature file, architecture doc, or definition that needs to reflect the implementation (update them if out of date).
3. **`PLAN.md` update** — mark the completed checklist items in `ai-engineering/projects/aesthera/PLAN.md`.

> ⚠️ Never finish a task without reporting these three points. This is required by `AGENT_RULES.md` rule #7.
