# Fluxa — Monorepo Root

Plataforma de billing e cobrança API-first.

## Estrutura
```
fluxa/
├── apps/
│   ├── api/     ← Backend: Node.js + Fastify + TypeScript
│   └── web/     ← Frontend: Next.js 15 + Tailwind CSS 4
└── README.md
```

## Como iniciar

### API (Backend)
```bash
cd apps/api
cp .env.example .env    # preencha as chaves no .env
docker-compose up -d
npm install
npm run db:migrate
npm run dev
```
Ver [`apps/api/QUICKSTART.md`](apps/api/QUICKSTART.md) para instruções detalhadas.

### Web (Frontend)
```bash
cd apps/web
cp .env.example .env.local   # por padrão já funciona para dev local
npm install
npm run dev
```
A aplicação estará disponível em `http://localhost:3003`.

## Documentação e contexto do projeto

Ver [`ai-engineering/projects/fluxa/START.md`](../ai-engineering/projects/fluxa/START.md) para instruções de desenvolvimento com IA.
