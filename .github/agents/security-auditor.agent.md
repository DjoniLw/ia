---
name: 🔒 security-auditor
description: "Use when: auditing security of code, APIs, architecture, or agent workflows; reviewing new implementations for vulnerabilities; checking authentication, authorization, data exposure, file access, webhooks, AI agent permissions, LGPD compliance, or any security concern in web systems that handle sensitive data."
tools: [read, agent, edit, search, github/add_issue_comment, github/get_file_contents, github/get_issue, github/get_pull_request, github/get_pull_request_comments, github/get_pull_request_files, github/get_pull_request_reviews, github/get_pull_request_status, github/list_commits, github/list_issues, github/list_pull_requests, github/search_code, github/search_issues, github/search_repositories, github/search_users]
model: Claude Sonnet 4.6
argument-hint: "Descreva o que deseja auditar: pode ser um trecho de código, um endpoint, um fluxo de IA, uma feature recém-implementada, ou uma área específica do sistema."
---

Antes de executar qualquer tarefa, leia e siga integralmente:

`ai-engineering/prompts/security-auditor/security-auditor-prompt.md`
