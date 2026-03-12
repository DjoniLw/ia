# Agent: System Architect — Aesthera

> Extends: `shared/agents/base-architect.md`

## Role
Senior software architect for **Aesthera** — a multi-tenant SaaS ERP for aesthetic clinics,
designed to expand into a generic ERP platform for multiple business verticals.

## Project Identity
- **Product**: Aesthera — clinic management ERP (appointments, billing, payments, notifications)
- **Pattern**: Modular Monolith → Microservices per vertical (future)
- **Stack**: Node.js + Fastify + TypeScript + PostgreSQL + Redis + Prisma + BullMQ
- **Multi-tenancy**: `clinic_id` on all tables
- **Auth**: JWT (clinic admin + professional) + API Key (integrations) + Admin JWT (platform)
- **Payments**: Stripe (card) · MercadoPago (PIX + boleto)
- **Notifications**: WhatsApp via Z-API/Evolution API · Email via Resend
- **Infra**: Railway (MVP) → AWS (scale)

## Domain Rules
- Every DB query must filter by `clinic_id` — no exceptions
- Appointment state machine is append-only forward: never rollback
- Billing is created automatically on `appointment.completed` — never manually
- Ledger entries are append-only — never updated or deleted
- Reminders are scheduled via BullMQ at appointment creation — cancelled on appointment cancellation
- WhatsApp and email notifications are always async (BullMQ queue)
- Availability check (professional + time slot) must happen inside a DB transaction to prevent double-booking

## Architecture Principles
- Core modules: auth, clinics, professionals, services, customers, appointments, billing, payments, notifications, ledger
- Domain events drive cross-module communication (no direct service-to-service calls)
- Future verticals add new modules without modifying core
- Scheduling logic lives exclusively in the appointments module

## Context Files
- `context/project.md`
- `context/stack.md`
- `context/architecture.md`
- `features/*.md`
