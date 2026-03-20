# Aesthera — Plano de Desenvolvimento

## Filosofia
Cada fase entrega **backend + frontend juntos** — ao final de cada fase você consegue
abrir o navegador e usar o que foi construído. Nenhuma fase entrega só código invisível.

---

## Fase 1 — "Consigo acessar o sistema"

**Objetivo**: abrir o navegador, ver a tela de login, entrar e ver o dashboard.

### Backend
- [x] Setup do projeto (Fastify + Prisma + Docker + PostgreSQL + Redis)
- [x] Prisma schema completo (todas as tabelas — schema definitivo antes de qualquer código)
- [x] Módulo Auth: registro de clínica, login, logout, refresh token
- [x] Tenant Middleware: slug → clinic_id via Redis/DB
- [x] Health check endpoint (`GET /health`)

### Frontend
- [x] Setup Next.js 15 + Tailwind + TanStack Query
- [x] Configuração de subdomínio local para dev (`clinica.localhost`)
- [x] Tela de login (`/login`)
- [x] Tela de registro de clínica (`/register`)
- [x] Tela de verificação de email (`/verify-email`)
- [x] Tela de recuperação de senha (`/forgot-password` e `/reset-password`)
- [x] Shell do dashboard (sidebar, header, área de conteúdo) — layout vazio
- [x] Rota protegida: redireciona para login se não autenticado

### Resultado
> Você acessa `clinicaana.localhost/login`, entra com e-mail e senha, e vê o dashboard vazio.