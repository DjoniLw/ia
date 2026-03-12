# Prompt: Create Module — Fluxa

> Extends: `shared/prompts/create-module.md`
> Stack: Node.js + Fastify + TypeScript + Prisma + Zod + Vitest

## Instructions to AI
- Stack: Node.js + Fastify + TypeScript + Prisma + Zod + Vitest
- Pattern: Modular Monolith — follow folder structure in `context/architecture.md`
- Always include `company_id` on queries (multi-tenant — never leak data between tenants)
- Use the correct guard per route: `JwtCompanyGuard`, `ApiKeyGuard`, `JwtAdminGuard`
- Emit domain events where specified in the feature file
- Do not add unasked features. Do not pad with comments.

## Prompt Template
```
Create the [MODULE_NAME] module for Fluxa.

Reference files:
- context/stack.md
- context/architecture.md
- features/[module].md

Files to generate (one at a time if large):
- [module].controller.ts  → routes, guards, Zod validation
- [module].service.ts     → business logic, domain events
- [module].repository.ts  → Prisma queries (always filter by company_id)
- [module].dto.ts         → Zod schemas for input/output
- [module].test.ts        → unit tests for service (mock repository + externals)

Constraints:
- All queries must include WHERE company_id = :company_id
- Throw typed errors (use shared/errors/)
- Emit domain events via shared/events/event-bus.ts where the feature file specifies
- No raw SQL — use Prisma only
- No any types — strict TypeScript

Feature spec:
[paste full content of features/[module].md]
```

## Tips
- Generate one file per message to keep responses focused and reduce errors.
- If the module has BullMQ jobs (notifications, ledger), ask for the job processor separately.
- After generating, use `shared/prompts/code-review.md` before committing.
