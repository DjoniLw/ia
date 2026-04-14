# Aesthera — Preferências Específicas do Projeto

> Contexto específico do projeto Aesthera para agentes IA.
> Para convenções gerais de agentes e metodologia, leia primeiro: `ai-engineering/AGENT-PREFERENCES.md`
> Mantido atualizado pelo `guardiao-ecossistema`.

---

## Infraestrutura de Testes

- Vitest funciona com `vitest.config.mts` (extensão `.mts` necessária para carregar como ESM)
- `npm test` executa a suíte localmente — warnings de env ausentes (`DATABASE_URL`, `JWT_SECRET`, etc.) são esperados mas os testes passam
- `npm run db:generate` funciona normalmente após mudanças no `schema.prisma`

### Atenção — migrations e gitignore
- `aesthera/.gitignore` ignora `apps/api/prisma/migrations/`
- **Sempre usar** `git add -f <caminho_da_migration>` ao criar nova migration
- Sem isso: arquivo fica local, `prisma migrate deploy` falha no Railway na próxima build e dados somem

---

## Regras de Autoridade no Aesthera

- **Somente `aesthera-implementador`** pode escrever ou modificar código em `aesthera/`
- **Somente `test-guardian`** pode criar ou modificar arquivos de teste (`*.test.ts`, `*.spec.ts`)
- Todos os outros agentes geram **documentos de orientação** — nunca código direto

