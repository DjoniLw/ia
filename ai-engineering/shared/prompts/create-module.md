# Prompt: Create Module

## Usage
Use this prompt to generate a new feature module from scratch.

## Instructions to AI
- Follow the stack and folder structure defined in the project's `context/` files
- Do not add unasked features. Do not pad with comments.

## Prompt Template
```
Create the [MODULE_NAME] module for [PROJECT_NAME].

Reference files:
- context/stack.md
- context/architecture.md
- features/[module].md

Files to generate (one at a time if large):
- [module].controller.ts  → routes, guards, validation
- [module].service.ts     → business logic, domain events
- [module].repository.ts  → DB queries (always filter by tenant key)
- [module].dto.ts         → input/output schemas
- [module].test.ts        → unit tests for service (mock repository + externals)

Constraints:
- All queries must include the tenant isolation field defined in context/architecture.md
- Throw typed errors (use shared/errors/)
- Emit domain events where the feature file specifies
- No raw SQL — use the ORM defined in context/stack.md
- No any types — strict TypeScript

Feature spec:
[paste full content of features/[module].md]
```

## Tips
- Generate one file per message to keep responses focused and reduce errors.
- If the module has async jobs, ask for the job processor separately.
- After generating, use `shared/prompts/code-review.md` before committing.
