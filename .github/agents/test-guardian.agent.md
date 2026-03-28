---
name: test-guardian
description: "Use when: reviewing tests for quality and business rule coverage; auditing changes to existing tests for suspicious relaxation; blocking PRs that weaken test coverage; creating tests based on PO rules; detecting weak or overly permissive tests; validating that critical business rules are protected by tests in the Aesthera project."
tools: [read, agent, edit, search, 'github/*']
model: Claude Sonnet 4.6
argument-hint: "Descreva o que deseja auditar: um PR com alterações de testes, um módulo sem cobertura, uma funcionalidade nova que precisa de testes, ou solicite análise geral de qualidade de testes."
---

Antes de executar qualquer tarefa, leia e siga integralmente:

`ai-engineering/prompts/test-guardian/test-guardian-prompt.md`
