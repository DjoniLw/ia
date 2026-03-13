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

## Pré-requisitos

- **Node.js 22+** → https://nodejs.org
- **Docker Desktop** → https://www.docker.com/products/docker-desktop (para PostgreSQL + Redis)
- **Git** → https://git-scm.com

---

## Setup após clonar o repositório

### 1. Clonar

```bash
git clone https://github.com/DjoniLw/ia.git
cd ia
```

### 2. Fluxa — API (Backend)

```bash
cd fluxa/apps/api

# Copiar variáveis de ambiente
cp .env.example .env
# Edite .env e preencha as chaves do Stripe, MercadoPago, Resend etc.

# Subir banco de dados e Redis
docker-compose up -d

# Instalar dependências
npm install

# Rodar migrations e iniciar servidor
npm run db:migrate
npm run dev
# → API disponível em http://localhost:3000
```

### 3. Fluxa — Web (Frontend)

```bash
cd fluxa/apps/web

# Copiar variáveis de ambiente
cp .env.example .env.local
# Por padrão NEXT_PUBLIC_API_URL=http://localhost:3000 já funciona para dev

# Instalar dependências e iniciar
npm install
npm run dev
# → Frontend disponível em http://localhost:3003
```

### 4. Aesthera — API (Backend)

```bash
cd aesthera/apps/api

# Copiar variáveis de ambiente (na raiz de aesthera/)
cp ../../aesthera/.env.example .env
# Edite .env e preencha as chaves necessárias

# Subir banco de dados e Redis (porta 5433 para não conflitar com Fluxa)
cd ../..
docker-compose up -d

# Instalar dependências
cd apps/api
npm install

# Rodar migrations e iniciar servidor
npm run db:migrate
npm run dev
# → API disponível em http://localhost:3001
```

### 5. Aesthera — Web (Frontend)

```bash
cd aesthera/apps/web

# Instalar dependências e iniciar
npm install
npm run dev
# → Frontend disponível em http://localhost:3002
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
