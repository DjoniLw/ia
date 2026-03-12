# Prompt: Generate Tests

## Usage
Use this prompt to generate unit or integration tests for a function, service, or endpoint.

## Instructions to AI
- Mock all external dependencies (DB client, cache, third-party SDKs, queues)
- No real I/O in unit tests — use mocks or in-memory fakes
- Output only test code. No explanation unless asked.

## Prompt Template
```
Generate [unit | integration] tests for the code below.
Project: [PROJECT_NAME]. Framework: [TEST_FRAMEWORK].

Coverage required:
- Happy path
- Input validation errors
- Auth/permission errors
- Edge cases: [list if known, else "infer from code"]

Project-specific cases to cover (refer to features/*.md for details):
- [list domain-specific rules, e.g. tenant isolation, idempotency, state machine transitions]

Mocking:
- [list all external dependencies and how to mock them]

Code to test:
[paste service / repository / controller / job processor]
```

## Tips
- Unit tests: paste only the service or repository being tested.
- Integration tests: paste route handler + service together.
- Paste test failures back if any — include the full error message.
