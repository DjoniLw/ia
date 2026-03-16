# Aesthera — ERP para clínicas estéticas

> **TL;DR — Não precisa clonar para o PC!**  
> Você pode subir o Aesthera em nuvem gratuita (Railway) em ~5 minutos. Veja a [Opção 1](#opção-1-railway-online-sem-instalar-nada) abaixo.

---

## Opções para rodar

### Opção 1 · Railway (online, sem instalar nada)

A forma mais rápida — tudo roda na nuvem, você acessa pelo browser.

1. Crie uma conta gratuita em **[railway.com](https://railway.com)** (sem cartão)
2. Clique em **"New Project → Deploy from GitHub repo"** e selecione este repositório
3. Railway vai detectar o `railway.toml` e criar o serviço da API automaticamente
4. No painel Railway, adicione os serviços de banco:
   - **+ New → Database → PostgreSQL**
   - **+ New → Database → Redis**
5. Configure as variáveis de ambiente no serviço `api` (aba *Variables*):

   | Variável | Valor |
   |----------|-------|
   | `DATABASE_URL` | (copiado do serviço PostgreSQL no Railway) |
   | `REDIS_URL` | (copiado do serviço Redis no Railway) |
   | `JWT_SECRET` | string aleatória ≥ 32 chars |
   | `JWT_REFRESH_SECRET` | outra string aleatória ≥ 32 chars |
   | `PORT` | `3000` |

6. Para o **frontend web**, crie um segundo serviço apontando para `apps/web/` e adicione:

   | Variável | Valor |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | URL pública da API (ex: `https://aesthera-api.up.railway.app`) |

7. Acesse a URL gerada pelo Railway — pronto!

> **Gerar JWT_SECRET rapidamente:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

### Opção 2 · Docker Compose (PC com Docker)

Se você tem **Docker Desktop** instalado, um único comando sobe tudo:

```bash
git clone https://github.com/DjoniLw/ia.git
cd ia/aesthera

# (Opcional) copie e ajuste as variáveis de ambiente
cp .env.example .env.docker
# Edite .env.docker se quiser mudar JWT_SECRET etc.

docker compose up --build
```

Aguarde o build (~2 min na primeira vez) e acesse:

| Serviço | URL |
|---------|-----|
| **Web (frontend)** | http://localhost:3002 |
| **API** | http://localhost:3000 |
| **API health** | http://localhost:3000/health |

Para parar: `docker compose down`  
Para apagar os dados também: `docker compose down -v`

---

### Opção 3 · Manual (Node + PostgreSQL + Redis locais)

Necessário: **Node 22+**, **PostgreSQL 16**, **Redis 7**

```bash
git clone https://github.com/DjoniLw/ia.git
cd ia/aesthera

# 1. Suba o banco e o redis via Docker (somente infraestrutura)
docker compose up postgres redis -d

# 2. Instale e configure a API
cd apps/api
cp ../../.env.example .env       # já tem os valores corretos para dev
npm install
npm run db:migrate               # cria as tabelas
npm run dev                      # → http://localhost:3000

# 3. Em outro terminal, inicie o frontend
cd ../web
cp .env.example .env.local
npm install
npm run dev                      # → http://localhost:3002
```

---

## Primeiro acesso

Após subir o projeto, acesse `/register` para criar sua clínica e usuário admin:

```
http://localhost:3002/register
```

Preencha:
- **Nome da clínica** — ex: `Clínica Teste`
- **Seu nome** — ex: `Admin`
- **E-mail** — seu e-mail
- **Senha** — mínimo 8 chars, com letra maiúscula, número e caractere especial  
  Ex: `Senha@123`

Após o cadastro você é redirecionado para o dashboard.

---

## Estrutura do projeto

```
aesthera/
├── apps/
│   ├── api/          # API REST (Fastify + Prisma + PostgreSQL)
│   └── web/          # Frontend (Next.js 15 + Tailwind)
├── docker-compose.yml  # Stack completa (API + Web + DB + Redis)
├── railway.toml        # Deploy automático no Railway
└── .env.example        # Variáveis de ambiente da API
```

## Variáveis opcionais (podem ficar em branco para testes)

| Variável | Para que serve |
|----------|---------------|
| `STRIPE_SECRET_KEY` | Pagamentos com cartão |
| `MP_ACCESS_TOKEN` | PIX / boleto (MercadoPago) |
| `RESEND_API_KEY` | Envio de e-mails |
| `ZAPI_*` | Notificações WhatsApp |
| `GEMINI_API_KEY` | Assistente IA (Aes) |
