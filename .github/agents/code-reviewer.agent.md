---
name: code-reviewer
description: "Use when: reviewing a pull request or merge request; auditing code changes for pattern violations, system integrity issues, anti-patterns, or inconsistencies; orchestrating specialist reviews (UX, Security, Architecture, Tests) based on what was changed; generating a consolidated correction report for PRs in the Aesthera project."
tools: [read, agent, search, edit, todo, github/get_file_contents, github/get_issue, github/get_pull_request, github/get_pull_request_comments, github/get_pull_request_files, github/get_pull_request_reviews, github/get_pull_request_status, github/list_commits, github/list_pull_requests, github/search_code]
model: Claude Sonnet 4.6
argument-hint: "Informe o número do PR ou branch para revisar. Ex: 'Revisar PR #148' ou 'Revisar a branch feat/billing-redesign'."
---

Antes de executar qualquer tarefa, leia e siga integralmente:

`ai-engineering/prompts/code-reviewer/code-reviewer-prompt.md`
