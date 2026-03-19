# Project Context

## Name
Aesthera

## Goal
Multi-tenant SaaS ERP designed initially for aesthetic clinics to manage appointments,
professionals, services, customers, billing, and payments — with modular architecture
that allows expansion into other business verticals (gyms, salons, medical offices).

## Stage
[ ] Idea  [x] MVP  [ ] Beta  [ ] Production

## Product Vision
The system manages the full operational lifecycle of a clinic:

- Customer management (patients)
- Professional management (who performs each service)
- Service catalog (treatments, duration, price per clinic)
- Appointment scheduling (booking, availability, state machine)
- Billing and payment tracking (PIX, boleto, card)
- Financial overview (ledger, revenue per period)
- Automated reminders and notifications (WhatsApp + email)

The architecture must support future expansion into a **generic ERP platform for
multiple business verticals** — modules are added per vertical, the core is shared.

## Target Users
- Aesthetic clinics (MVP target)
- Beauty clinics
- Small service businesses
- Future: gyms, salons, medical offices

## Key Constraints
- Budget: low
- Timeline: rapid MVP
- Team size: 1 developer + AI
- UI must be **mobile-responsive** — clinic staff and customers access on phones
- Must-have integrations:
  - MercadoPago (PIX + boleto)
  - Stripe (card)
  - WhatsApp via Z-API or Evolution API (reminders, confirmations)
  - Resend (transactional email, receipts)

## Success Metrics
- Clinic can create professionals, services, and book appointments
- Customers receive WhatsApp confirmation and D-1 reminder automatically
- Payment collected via PIX/boleto/card with automatic reconciliation
- System supports multi-tenant isolation (clinic_id on all data)

## Out of Scope (v1)
- Mobile app (native)
- AI analytics / demand forecasting
- Marketplace integrations
- Advanced marketing automation
- Employee payroll

## Roadmap (post-MVP)
| Module | Description |
|--------|-------------|
| Inventory | Stock management for products used in services |
| CRM | Lead tracking, customer lifecycle, follow-ups |
| Analytics | Revenue reports, occupancy rate, churn, demand forecasting |
| Subscription Billing | Recurring plans (monthly packages, memberships) |
| Multi-gateway Routing | Automatic gateway selection by cost/availability |
| Marketing Automation | Automated campaigns, re-engagement flows |
| Multi-location | One account managing multiple clinic branches |
