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
docker-compose up -d
npm run dev
```
Ver [`apps/api/QUICKSTART.md`](apps/api/QUICKSTART.md) para instruções detalhadas.

### Web (Frontend)
```bash
cd apps/web
npm install
npm run dev
```
A aplicação estará disponível em `http://localhost:3003`.

## Documentação e contexto do projeto

Ver [`ai-engineering/projects/fluxa/START.md`](../ai-engineering/projects/fluxa/START.md) para instruções de desenvolvimento com IA.
