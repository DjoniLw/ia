# Feature: AI Assistant

## Summary
Embedded AI assistant that knows the Aesthera system and helps clinic staff
work faster through natural language. It can answer questions, query live system
data via function calling, summarize records, suggest actions, and draft messages.

The assistant appears as a floating chat panel accessible from any page.

---

## AI Provider
- **Model**: `gemini-1.5-flash` (free tier: 1,500 req/day, 1M tokens/min)
- **Why changed from gemini-2.0-flash**: gemini-2.0-flash has `generate_content_free_tier_requests` quota = 0;
  switching to gemini-1.5-flash restores full free-tier access without billing.
- **Upgrade path**: Gemini 1.5 Pro or GPT-4o if more reasoning depth is needed
- **Integration**: `@ai-sdk/google` + Vercel AI SDK (streaming, tool calls, React hooks — native Next.js)

---

## Capabilities

### 1. Live System Queries (Function Calling)
The AI can call internal system tools to fetch real data before answering:

| Tool | What it does |
|------|--------------|
| `get_appointments_today` | Returns today's appointments for the clinic |
| `get_appointments_by_date` | Appointments for a given date or range |
| `get_customer_history` | Full history of a customer (appointments + billing) |
| `get_availability` | Free slots for a professional + service + date |
| `get_overdue_billing` | List of unpaid/overdue billing records |
| `get_financial_summary` | Revenue, pending, net for a given period |
| `get_professional_schedule` | A professional's appointments for a given week |
| `search_customers` | Find customer by name, phone, or document |

### 2. Summaries
- **Patient summary**: open a customer profile → AI summarizes last visits, services done, pending billing, notes
- **Daily briefing**: AI generates a morning summary — appointments today, revenue yesterday, overdue billing

### 3. Smart Scheduling Help
- "Quando a Ana tem agenda livre essa semana para um botox?"
- "Qual profissional está mais livre na quinta-feira?"
- AI calls `get_availability` internally and presents options in natural language

### 4. Message Drafting
- "Escreva um WhatsApp lembrando a Maria da consulta de amanhã às 14h"
- "Escreva um email de cobrança educado para o João"
- AI drafts the message — staff reviews and sends manually (or approves auto-send)

### 5. Proactive Alerts (on dashboard open)
- "Você tem 4 agendamentos hoje · 2 cobranças vencidas · 1 no-show ontem"
- Single AI call on dashboard load, cached for 5 minutes

### 6. System Help
- "Como cancelo um agendamento?"
- "Como adiciono um bloqueio de agenda?"
- AI answers using embedded system documentation (no RAG needed — context injected)

---

## Architecture

### Backend
```
POST /ai/chat
  - Auth: Clinic JWT (clinic_id from tenant middleware)
  - Body: { messages: ChatMessage[], context?: string }
  - Streams response via Server-Sent Events (SSE)

POST /ai/summary/customer/:id
  - Returns a generated summary for a specific customer
  - Cached in Redis (key: ai:summary:customer:<id>, TTL 10min)

POST /ai/briefing
  - Returns the daily briefing for the dashboard
  - Cached in Redis (key: ai:briefing:<clinic_id>:<date>, TTL 5min)
```

### AI Service flow
```
User sends message
      ↓
ai.service.ts builds prompt:
  - System prompt (Aesthera context + clinic name + current date + user role)
  - Conversation history (last 10 messages, stored in Redis TTL 1h)
  - Available tools (function definitions)
      ↓
Gemini API call (streaming)
      ↓
  [if tool call requested]
  ai.service.ts executes tool → calls internal service/repository
  Result injected back into context
  Gemini continues generation
      ↓
Stream response back to frontend via SSE
```

### Conversation History
- Stored in Redis: `ai:chat:<clinic_id>:<session_id>` (TTL 1 hour)
- Max 20 messages retained per session (sliding window)
- New session on page refresh or after 1h inactivity

### System Prompt (injected on every call)
```
You are Aesthera Assistant, an AI built into the Aesthera clinic management system.
You help clinic staff work faster.

Clinic: {clinic_name}
Current date: {date}
Current time: {time} ({timezone})
User role: {role}

Rules:
- Be concise and direct. This is a productivity tool, not a chatbot.
- Always answer in the same language the user writes in (pt-BR default).
- When querying data, always call a tool first — never invent numbers.
- When drafting messages, make them professional and warm.
- If you cannot help with something, say so clearly and suggest what to do instead.
- Never expose internal IDs, tokens, or technical fields in responses.
- Never answer questions unrelated to clinic management.
```

---

## Frontend

### AI Chat Panel
- Floating button (bottom-right) on all dashboard pages
- Opens a side panel (400px wide, full height)
- Streaming responses — text appears as it's generated
- Tool call indicator: "Consultando agendamentos..." while fetching
- Message history visible during the session

### Suggested prompts (first open)
- "Quais são meus agendamentos de hoje?"
- "Resumir histórico da última paciente que atendei"
- "Tenho cobranças em atraso?"
- "Qual horário livre a Ana tem essa semana?"

### Customer Profile Integration
- "Resumo IA" button on customer detail page
- One click → AI generates structured summary of that customer

### Dashboard Briefing Widget
- Small card on dashboard home
- "Bom dia! Você tem 8 agendamentos hoje. 2 cobranças vencidas precisam de atenção."
- Refreshes once per day

---

## Data Model
```
-- No persistent DB table needed for MVP
-- Conversation history in Redis only (TTL-based)
-- AI usage logs (optional, for monitoring):

AiUsageLog {
  id          UUID PK
  clinic_id   UUID FK → Clinic    -- tenant key
  type        ENUM(chat, summary, briefing)
  tokens_used INTEGER
  tools_called STRING[]
  created_at  TIMESTAMP
}
```

---

## Security & Guardrails
- All AI calls are scoped to `clinic_id` — tools only query that clinic's data
- System prompt explicitly forbids unrelated topics
- No raw DB IDs, tokens, or sensitive fields exposed in AI responses
- Rate limit: 30 AI requests per clinic per hour (Redis counter)
- If Gemini free tier limit reached: graceful error "Assistente temporariamente indisponível"

---

## Dependencies
- Google Gemini API (`@google/generative-ai`)
- Vercel AI SDK (`ai` package — streaming, useChat hook)
- All internal services (appointments, customers, billing, ledger) as tool targets
- Redis (conversation history, response cache, rate limiting)

---

## Phase
See `PLAN.md` Phase 8 — added after core system is stable.
Can be partially introduced in Phase 7 (dashboard briefing widget only).

## Status
[ ] Planned  [ ] In Progress  [x] Done

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03 | Initial implementation: chat SSE, customer summary, daily briefing, rate limiting, Redis history |
| 2026-03 | Error surfacing: `getModel()` throws `AppError(503)` instead of generic `Error` — real API errors reach the frontend |
| 2026-03 | Model switched from `gemini-2.0-flash` to `gemini-1.5-flash` — gemini-2.0-flash free tier quota = 0 |
