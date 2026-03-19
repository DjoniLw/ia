# IA — Workspace de Desenvolvimento com IA
teste

Workspace centralizado para projetos desenvolvidos com assistência de IA (GitHub Copilot, ChatGPT, Claude).

> **Quer rodar sem clonar?** Use o Railway — veja a seção [Deploy online (Railway)](#deploy-online-railway) abaixo.

---

## Deploy online (Railway)

Não precisa instalar nada no PC. Siga os passos:

### Serviço 1 — API (backend)

1. Acesse [railway.com](https://railway.com) e crie uma conta gratuita
2. Clique em **New Project → Deploy from GitHub repo** → selecione `DjoniLw/ia`
3. Railway vai encontrar o `railway.toml` na raiz e usar `Dockerfile.api` automaticamente
4. No painel do projeto, clique em **+ New** → **Database → PostgreSQL**
5. Clique em **+ New** → **Database → Redis**
6. No serviço `ia` (a API), abra a aba **Variables** e adicione:

   | Variável | Valor |
   |----------|-------|
   | `DATABASE_URL` | (copie da aba *Connect* do serviço PostgreSQL no Railway) |
   | `REDIS_URL` | (copie da aba *Connect* do serviço Redis no Railway) |
   | `JWT_SECRET` | qualquer string longa ≥ 32 chars |
   | `JWT_REFRESH_SECRET` | outra string longa ≥ 32 chars |
   | `PORT` | `3000` |

7. Clique em **Deploy** — a API ficará disponível na URL gerada

> **Gerar JWT_SECRET rapidamente (rode no terminal ou em [replit.com](https://replit.com)):**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Serviço 2 — Web (frontend)

1. No mesmo projeto Railway, clique em **+ New → GitHub Repo** → `DjoniLw/ia` novamente
2. Clique no novo serviço → aba **Settings → Build**
3. Em **Dockerfile Path**, insira: `Dockerfile.web`
4. Na aba **Variables**, adicione:

   | Variável | Valor |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | URL pública da API (ex: `https://ia-production.up.railway.app`) |

5. Clique em **Deploy**

Pronto! Acesse a URL do serviço web no browser.

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
