# IA — Workspace de Desenvolvimento com IA

Workspace centralizado para projetos desenvolvidos com assistência de IA (GitHub Copilot, ChatGPT, Claude).

---

## Estrutura do Repositório

```
ia/
├── ai-engineering/          ← Documentação e contexto para o Copilot/IA
│   ├── projects/
│   │   ├── aesthera/        ← Contexto do projeto Aesthera
│   │   └── fluxa/           ← Contexto do projeto Fluxa
│   └── shared/              ← Agentes e prompts reutilizáveis
│
├── aesthera/                ← Código do projeto Aesthera
│   └── apps/
│       ├── api/             ← Backend: Node.js + Fastify + TypeScript
│       └── web/             ← Frontend: Next.js 15 + Tailwind CSS 4
│
└── fluxa/                   ← Código do projeto Fluxa
    └── apps/
        ├── api/             ← Backend: Node.js + Fastify + TypeScript
        └── web/             ← Frontend: Next.js 15 + Tailwind CSS 4
```

---

## Projetos

### 🏥 Aesthera
SaaS ERP multi-tenant para clínicas estéticas — gerencia agendamentos, profissionais, serviços, clientes, billing e pagamentos.

- Documentação: [`ai-engineering/projects/aesthera/`](ai-engineering/projects/aesthera/START.md)
- Código API: [`aesthera/apps/api/`](aesthera/apps/api/)
- Código Web: [`aesthera/apps/web/`](aesthera/apps/web/)

### 💳 Fluxa
Plataforma de billing e cobrança API-first — empresas usam o Fluxa para cobrar seus clientes via PIX, boleto e cartão.

- Documentação: [`ai-engineering/projects/fluxa/`](ai-engineering/projects/fluxa/START.md)
- Código API: [`fluxa/apps/api/`](fluxa/apps/api/)
- Código Web: [`fluxa/apps/web/`](fluxa/apps/web/)

---

## Como usar o AI Engineering

Ver [`ai-engineering/README.md`](ai-engineering/README.md) para instruções completas.
