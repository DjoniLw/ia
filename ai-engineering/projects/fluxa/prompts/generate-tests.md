# Prompt: Generate Tests — Fluxa

> Extends: `shared/prompts/generate-tests.md`
> Framework: Vitest | Mock style: vi.mock()

## Instructions to AI
- Framework: Vitest
- Mock all external dependencies (Prisma, Redis, Stripe, MercadoPago, BullMQ, Resend)
- No real DB calls — use vi.mock() or in-memory fakes
- Output only test code. No explanation unless asked.

## Prompt Template
```
Generate [unit | integration] tests for the code below.
Project: Fluxa — billing platform. Framework: Vitest.

Coverage required:
- Happy path
- Input validation errors (Zod)
- Auth/permission errors (wrong company_id, missing API key, suspended company)
- Edge cases: [list if known, else "infer from code"]

Fluxa-specific cases to always cover (if applicable):
- Multi-tenancy: ensure queries always include company_id filter
- Idempotency: same idempotency_key returns existing record, not duplicate
- Webhook: invalid signature returns 400, valid processes correctly
- Invoice state machine: invalid transitions are rejected
- Ledger: entries are created but never mutated
- BullMQ jobs: job enqueued on correct event, retries on failure

Mocking:
- vi.mock() for Prisma client
- vi.mock() for Redis
- vi.mock() for Stripe SDK
- vi.mock() for MercadoPago SDK
- vi.mock() for BullMQ queues
- vi.mock() for Resend

Code to test:
[paste service / repository / controller / job processor]
```

## Tips
- Unit tests: paste only the service or repository being tested.
- Integration tests: paste route handler + service together.
- For webhook tests: include a valid and an invalid signature case.
- Paste test failures back if any — include the full error message.
