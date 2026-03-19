# Prompt: Generate Tests — Aesthera

> Extends: `shared/prompts/generate-tests.md`
> Framework: Vitest | Mock style: vi.mock()

## Instructions to AI
- Read `AGENT_RULES.md` (repo root) before starting — it governs all decisions.
- Framework: Vitest
- Mock all external dependencies (Prisma, Redis, Stripe, MercadoPago, BullMQ, Resend, WhatsApp SDK)
- No real DB calls — use vi.mock() or in-memory fakes
- Output only test code. No explanation unless asked.

## Prompt Template
```
Generate [unit | integration] tests for the code below.
Project: Aesthera — clinic management ERP. Framework: Vitest.

Coverage required:
- Happy path
- Input validation errors (Zod)
- Auth/permission errors (wrong clinic_id, missing guard, suspended clinic)
- Edge cases: [list if known, else "infer from code"]

Aesthera-specific cases to always cover (if applicable):
- Multi-tenancy: ensure queries always include clinic_id filter
- Appointment state machine: invalid transitions are rejected
- Double-booking: availability check prevents overlapping appointments
- Billing idempotency: appointment_id already has billing → return existing
- Webhook: invalid gateway signature returns 400, valid processes correctly
- Ledger: entries are created but never mutated
- BullMQ reminder: job enqueued at appointment creation, cancelled on appointment cancellation
- WhatsApp: notification skipped silently if customer has no phone

Mocking:
- vi.mock() for Prisma client
- vi.mock() for Redis
- vi.mock() for Stripe SDK
- vi.mock() for MercadoPago SDK
- vi.mock() for BullMQ queues
- vi.mock() for Resend
- vi.mock() for WhatsApp provider (Z-API / Evolution API HTTP client)

Code to test:
[paste service / repository / controller / job processor]
```

## Tips
- Unit tests: paste only the service or repository being tested.
- Integration tests: paste route handler + service together.
- For availability tests: include overlapping slot, exact boundary, and free slot cases.
- For webhook tests: include valid + invalid signature cases.
- Paste test failures back if any — include the full error message.
