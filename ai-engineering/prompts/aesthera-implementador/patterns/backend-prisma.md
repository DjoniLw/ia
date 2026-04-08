# Padrões — Backend: Prisma, Transações e Banco de Dados

> Carregue este arquivo quando for implementar: queries Prisma, transações `$transaction`, migrations, domain events, ou verificações de conflito.

---

- [ ] **Chamar outros services dentro de `$transaction` sem propagar `tx` — operações ficam fora da transação**
  - 🔴 Anti-padrão: service externo chamado dentro de `$transaction` usa `this.prisma` internamente — não é revertido em caso de rollback.
  - ✅ Correto: propagar `tx` como parâmetro opcional:
    ```ts
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({ ... });
      await this.promotionService.applyPromotion(customerId, promotionId, tx);
    });
    // No promotionService:
    async applyPromotion(customerId: string, promotionId: string, tx?: Prisma.TransactionClient) {
      const client = tx ?? this.prisma;
      await client.promotion.update({ ... });
    }
    ```
  - 📌 Sinal de alerta: service externo chamado dentro de `$transaction` sem receber `tx` como parâmetro.
  - 📅 30/03/2026

---

- [ ] **Domain events NUNCA emitidos dentro de `$transaction` — emitir APÓS o commit**
  - 🔴 Anti-padrão: `this.eventEmitter.emit('billing.created', id)` dentro do bloco `$transaction` — dados podem estar pré-commit; on rollback, evento já foi emitido.
  - ✅ Correto:
    ```ts
    let createdId: string;
    await this.prisma.$transaction(async (tx) => {
      const billing = await tx.billing.create({ data });
      createdId = billing.id;
    });
    this.eventEmitter.emit('billing.created', createdId); // após o commit
    ```
  - 📌 Aplica-se a: qualquer `eventEmitter.emit()`, `EventBus.publish()` ou mecanismo equivalente.
  - 📅 02/04/2026

---

- [ ] **`SELECT FOR UPDATE` em comentário sem `$queryRaw` não gera lock real**
  - 🔴 Anti-padrão: comentar "SELECT FOR UPDATE" mas usar Prisma Client normal — o Prisma **não** adiciona `FOR UPDATE` automaticamente, nem dentro de `$transaction`.
  - ✅ Opção 1 — `$queryRaw` explícito:
    ```ts
    const [voucher] = await tx.$queryRaw<Voucher[]>`SELECT * FROM "Voucher" WHERE id = ${id} FOR UPDATE`;
    ```
  - ✅ Opção 2 (preferida) — `updateMany` com condição atômica:
    ```ts
    const result = await tx.voucher.updateMany({
      where: { id, usedCount: { lt: maxUses } },
      data: { usedCount: { increment: 1 } },
    });
    if (result.count === 0) throw new BadRequestException('Voucher esgotado');
    ```
  - 📌 Aplica-se a: vouchers com `maxUses`, vagas em sala, saldo de pacote, qualquer recurso com limite de uso concorrente.
  - 📅 03/04/2026

---

- [ ] **Múltiplos branches de pagamento devem estar TODOS dentro da mesma `$transaction`**
  - 🔴 Anti-padrão: apenas o branch `voucher` dentro de `$transaction`; branches `cash` e `card` usando `this.prisma.X` diretamente.
  - ✅ Correto: todos os branches com o mesmo nível de atomicidade:
    ```ts
    await this.prisma.$transaction(async (tx) => {
      if (method === 'voucher') { await tx.voucher.update({ ... }); }
      else if (method === 'cash') { /* ... */ }
      await tx.billing.update({ where: { id }, data: { status: 'PAID' } }); // comum a todos
    });
    ```
  - 📌 Regra: se **qualquer** branch precisa de `$transaction`, **todos** precisam. `this.prisma.X` fora de `$transaction` no mesmo método = atomicidade incompleta.
  - 📅 03/04/2026

---

- [ ] **Migration criada localmente mas não commitada — `.gitignore` bloqueia silenciosamente**
  - 🔴 Anti-padrão: `git add .` depois de `prisma migrate dev` — o `.gitignore` contém `apps/api/prisma/migrations/` e ignora novos arquivos. Railway não encontra a migration → banco desatualizado.
  - ✅ Correto — checklist obrigatório após qualquer alteração de schema:
    ```bash
    npx prisma generate
    npx prisma migrate dev --name <descricao>
    git add -f aesthera/apps/api/prisma/migrations/<nome>/migration.sql
    git commit -m "feat: ... + migration"
    ```
  - 📌 Sinal de alerta: `git status` não lista migration após `prisma migrate dev` → `.gitignore` ocultou.
  - 📅 01/04/2026

---

- [ ] **Consultas de vouchers/cupons ativos devem filtrar por `expirationDate` além do `status`**
  - 🔴 Anti-padrão: `where: { clinicId, status: 'ACTIVE' }` — voucher vencido continua com `status: 'ACTIVE'` sem job de expiração automática.
  - ✅ Correto:
    ```ts
    where: {
      clinicId, status: 'ACTIVE',
      OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
    }
    ```
  - 📌 Aplica-se a: vouchers, cupons, tokens de convite, links de assinatura remota, pacotes com validade.
  - 📅 03/04/2026

---

- [ ] **Parâmetros `_excludeId` em verificações de conflito nunca chegam ao `WHERE` — remover o `_`**
  - 🔴 Anti-padrão: `_excludeId?: string` recebido mas jamais repassado à query do repositório → ao editar, o próprio registro conflita consigo mesmo, bloqueando toda atualização.
  - ✅ Correto:
    ```ts
    async checkConflict(profId: string, start: Date, end: Date, excludeId?: string): Promise<boolean> {
      return this.repo.findConflict(profId, start, end, excludeId);
    }
    // No repositório:
    where: {
      professionalId,
      startAt: { lt: endAt }, endAt: { gt: startAt },
      ...(excludeId && { id: { not: excludeId } }),
    }
    ```
  - 📌 Nunca usar `_excludeId` em métodos de verificação de conflito. Detectar: buscar `_excludeId` ou `_excludeAppointmentId` nos arquivos.
  - 📅 03/04/2026
