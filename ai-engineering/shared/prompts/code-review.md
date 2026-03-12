# Prompt: Code Review

## Usage
Use this prompt when you need a focused, structured code review.

## Instructions to AI
Be direct. Flag only real issues. No compliments, no filler.

## Prompt Template
```
Review the code below. Project: [PROJECT_NAME].
Stack: [paste relevant stack from context/stack.md]

General checklist:
- [ ] Correctness (logic errors, edge cases)
- [ ] Security (injection, auth bypass, exposed secrets)
- [ ] Performance (N+1 queries, missing indexes, unnecessary loops)
- [ ] Error handling (unhandled promises, missing try/catch, untyped errors)
- [ ] Code style (naming, duplication, readability)

Project-specific checklist:
[paste relevant rules from context/architecture.md and features/*.md — e.g. tenant isolation, idempotency, signature verification, append-only constraints]

For each issue found:
- Severity: LOW | MEDIUM | HIGH | CRITICAL
- Location: [file:line]
- Problem: [one sentence]
- Fix: [code snippet or direct suggestion]

Code:
[paste code here]
```

## Tips
- CRITICAL = data leak between tenants, missing auth check, exposed secret.
- Paste one file per review for best results.
- If reviewing a PR, paste the diff instead of full files.
