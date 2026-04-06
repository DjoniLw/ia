# Code Review Learnings — Aesthera Implementador

> Este arquivo é mantido automaticamente pelo agente `aesthera-implementador`.  
> Cada item representa um padrão aprendido a partir de correções úteis identificadas em code reviews do Copilot.  
> **Leia este arquivo antes de qualquer implementação** e aplique todos os itens como checklist preventivo.

---

## Como usar

Antes de commitar qualquer código, percorra cada item abaixo e confirme mentalmente:  
`"Verifiquei isso no código que acabei de escrever?"`

Se a resposta for não → revise antes de prosseguir.

---

## Backend

### Segurança e Multi-tenancy

- [ ] **Nunca proteger dados sensíveis apenas ocultando a UI — a proteção DEVE existir no backend**
  - 🔴 Anti-padrão: restringir o acesso de um perfil (ex: recepcionista) simplesmente ocultando o componente React que exibe dados financeiros ou `screenPermissions`. Isso não impede chamadas diretas à API.
  - ✅ Correto: toda restrição de acesso a dados sensíveis exige um `roleGuard` (ou decorator equivalente) no endpoint correspondente da API. A UI pode *também* ocultar o componente, mas isso é camada de apresentação — nunca a única barreira.
  - 📌 Regra geral: se um usuário com permissão restrita consegue chamar `GET /financial-summary` diretamente via curl e receber dados, a proteção de UI é inútil.
  - 📅 Aprendido em: 22/03/2026 — revisão de controle de acesso por perfil (dados financeiros e screenPermissions)

- [ ] **Guards de role devem ser aplicados na menor granularidade possível, não no componente/rota inteira**
  - 🔴 Anti-padrão: colocar o guard no componente pai ou em um `early return` no nível da página inteira — isso bloqueia acesso a partes da tela que poderiam ser visíveis ao perfil restrito
  - ✅ Correto: aplicar o guard diretamente na sub-seção protegida (ex.: painel financeiro dentro de uma tela de cliente) ou no endpoint específico, permitindo que o restante da página permaneça acessível
  - 📌 Regra geral: quanto menor o escopo do guard, mais precisa e menos disruptiva é a proteção — aplicar no nível mais interno possível em que a restrição faz sentido de negócio
  - 📅 Aprendido em: 24/03/2026 — revisão de componentes com controle de acesso por perfil

### Validação e Tipagem

- [ ] **Campos obrigatórios por regra de negócio devem ser validados explicitamente no `service.create()`, não apenas no schema Zod**
  - 🔴 Anti-padrão: campo `roomId` definido como opcional no Zod (`roomId?: string`) mas exigido pela regra de negócio R10 — o Zod aceita a requisição sem o campo, e o service executa sem validar, causando dados inválidos no banco
  - ✅ Correto: quando uma regra de negócio torna um campo obrigatório, adicionar guarda explícita no service antes de persistir:
    ```ts
    if (!dto.roomId) {
      throw new BadRequestException('roomId é obrigatório para agendamentos.');
    }
    ```
  - 📌 Regra geral: o Zod valida apenas a **forma dos dados** (tipo, formato, presença de string) — **regras de negócio** (ex.: "sala é obrigatória para este tipo de agendamento") devem ser verificadas no service, onde o contexto de negócio está disponível
  - 📅 Aprendido em: 23/03/2026 — revisão de `appointments.service.create()` (roomId requerido por R10 não validado no service)

- [ ] **Campos opcionais que podem ser zerados pelo frontend devem usar `.nullable().optional()` — apenas `.optional()` rejeita `null`**
  - 🔴 Anti-padrão: definir campo como `z.string().optional()` (ou `z.number().optional()`) para um campo que pode ser limpo pelo usuário no frontend — quando o usuário apaga o valor, o frontend envia `null`, e o Zod rejeita com erro 400 porque `.optional()` aceita `undefined` mas não `null`:
    ```ts
    // ERRADO — rejeita null enviado pelo frontend quando campo é limpo
    maxUses: z.number().optional(),
    minAmount: z.number().optional(),
    validUntil: z.string().optional(),
    ```
  - ✅ Correto: para campos que podem ser zerados/limpos pelo usuário, sempre combinar `.nullable()` com `.optional()`:
    ```ts
    // CORRETO — aceita tanto undefined (campo não enviado) quanto null (campo limpo)
    maxUses: z.number().nullable().optional(),
    minAmount: z.number().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    ```
  - 📌 Regra geral: `.optional()` = o campo pode ser omitido da requisição (`undefined`). `.nullable()` = o campo pode ser enviado com valor `null`. Em formulários onde o usuário pode limpar um campo (input de número, date picker, select), o frontend envia `null` — não omite o campo. Para esses casos, sempre usar `.nullable().optional()`.
  - 📌 Aplica-se a: qualquer campo de formulário que pode ser deixado em branco após ter sido preenchido (limites de uso, valores mínimos, datas de validade, descontos, porcentagens, campos de configuração opcionais).
  - 📅 Aprendido em: 31/03/2026 — revisão de DTOs Zod para campos opcionais zeráveis (maxUses, minAmount, validUntil)

- [ ] **Campos de data em DTOs Zod devem usar `.refine(v => Number.isFinite(Date.parse(v)))` além do regex de formato**
  - 🔴 Anti-padrão: validar apenas o formato visual com regex (`/^\d{4}-\d{2}-\d{2}$/`) sem garantir que a string representa uma data real — `"2026-02-30"` passa no regex mas não é uma data válida
  - ✅ Correto: combinar regex de formato com `.refine()` para validação semântica:
    ```ts
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
      .refine(v => Number.isFinite(Date.parse(v)), 'Data inválida')
    ```
  - 📌 Regra geral: regex verifica apenas o padrão visual; `.refine()` com `Date.parse()` + `Number.isFinite()` garante que a data é semanticamente válida (mês e dia existentes)
  - 📅 Aprendido em: 24/03/2026 — revisão de DTOs de agendamento com campos de data

### Async / Promises / Error Handling

- [ ] **Catch genérico em chamadas de storage/API externo mascara falhas reais de infra — nunca usar `catch { return false }`**
  - 🔴 Anti-padrão: silenciar toda exceção em chamadas a serviços externos (S3, R2, APIs de terceiros) com `catch { return false }` ou `catch { return null }` — uma falha de credenciais inválidas, timeout de rede ou bucket inexistente fica indistinguível de um arquivo genuinamente não encontrado
  - ✅ Correto: inspecionar o erro antes de decidir o comportamento. Para SDKs AWS/Cloudflare, verificar o código de erro:
    ```ts
    try {
      await s3.send(new GetObjectCommand({ ... }));
    } catch (err: unknown) {
      if (err instanceof Error && (err as { Code?: string }).Code === 'NoSuchKey') {
        return null; // não encontrado — esperado
      }
      // erro de infra (credenciais, rede, permissão) — propagar para diagnóstico
      throw err;
    }
    ```
  - 📌 Regra geral: `catch { return false }` é aceitável **somente** quando qualquer falha é tratada como ausência de dado. Para storage e APIs externas, erros de credenciais ou rede devem ser relançados para aparecer nos logs e alertas
  - 📅 Aprendido em: 25/03/2026 — revisão de chamadas de storage R2 mascarando erros de credencial

- [ ] **Fluxo presign/confirm de upload: o `presign` deve persistir um registro de upload pendente — o `confirm` valida pelo `id`, nunca aceita `storageKey` bruto do cliente**
  - 🔴 Anti-padrão: endpoint `POST /uploads/confirm` recebe `storageKey` diretamente do cliente e o persiste sem validação — permite que um usuário malicioso aponte para qualquer chave do bucket (inclusive de outros tenants) e force o sistema a registrá-la como válida
  - ✅ Correto: o fluxo deve ter duas etapas com estado server-side:
    1. `POST /uploads/presign` → gera a URL assinada **e** persiste um registro `PendingUpload { id, storageKey, clinicId, expiresAt }` no banco
    2. `POST /uploads/confirm` → recebe apenas o `uploadId` (UUID do `PendingUpload`), busca o registro com `clinicId` do token, verifica `expiresAt`, e só então persiste o recurso final
    ```ts
    // presign
    const pending = await prisma.pendingUpload.create({
      data: { storageKey, clinicId, expiresAt: addMinutes(new Date(), 15) },
    });
    return { uploadId: pending.id, presignedUrl };

    // confirm
    const pending = await prisma.pendingUpload.findFirst({
      where: { id: uploadId, clinicId }, // multi-tenancy garantido
    });
    if (!pending || pending.expiresAt < new Date()) throw new BadRequestException('Upload inválido ou expirado');
    // persistir recurso final usando pending.storageKey (nunca do client)
    ```
  - 📌 Regra geral: o cliente **nunca** deve poder nomear ou referenciar uma chave de storage diretamente no `confirm` — o `storageKey` é determinado pelo servidor no `presign` e recuperado pelo `id` no `confirm`. Isso previne path traversal de bucket e violação de multi-tenancy
  - 📅 Aprendido em: 25/03/2026 — revisão de `POST /uploads/confirm` recebendo `storageKey` bruto sem validação de intent de presign

- [ ] **Upload de recursos de empresa (não por cliente) deve usar caminho `templates/{clinicId}/{uuid}.ext` via presign customizado no módulo — nunca o fluxo `CustomerFile`**
  - 🔴 Anti-padrão: usar o fluxo `CustomerFile` (ou qualquer entidade que exige `customerId`) para fazer upload de arquivos vinculados à clínica como um todo (ex.: templates de anamnese, logotipo, protocolos padrão) — o fluxo `CustomerFile` exige `customerId` e será rejeitado ou vai criar vínculos incorretos com um cliente inexistente
  - ✅ Correto: implementar um endpoint de presign dedicado no módulo responsável, gerando a chave de storage com o padrão:
    ```
    templates/{clinicId}/{uuid}.ext
    ```
    Exemplo de implementação:
    ```ts
    // no módulo (ex.: anamnese-templates.service.ts)
    async presignTemplateUpload(clinicId: string, ext: string) {
      const key = `templates/${clinicId}/${randomUUID()}.${ext}`;
      const presignedUrl = await this.storage.presign(key, 'PUT', 15); // 15 min
      const pending = await this.prisma.pendingUpload.create({
        data: { storageKey: key, clinicId, expiresAt: addMinutes(new Date(), 15) },
      });
      return { uploadId: pending.id, presignedUrl };
    }
    ```
    O `confirm` segue o mesmo padrão de presign/confirm: valida pelo `uploadId` server-side com `clinicId`, nunca recebe `storageKey` do cliente.
  - 📌 Regra geral: o fluxo `CustomerFile` é exclusivo para arquivos vinculados a **um cliente específico** (exige `customerId`). Qualquer recurso de empresa (template, protocolo, imagem de serviço, logotipo) deve ter seu próprio presign com chave `{contexto}/{clinicId}/{uuid}.ext`, sem depender do fluxo de customer
  - 📌 Convenção de prefixos de storage:
    - `customers/{clinicId}/{customerId}/{uuid}.ext` → arquivo de cliente (usar CustomerFile)
    - `templates/{clinicId}/{uuid}.ext` → template/recurso de empresa (presign no módulo)
    - `clinic/{clinicId}/{uuid}.ext` → recurso geral da clínica (ex.: logotipo)
  - 📅 Aprendido em: 29/03/2026 — code review identificou uso incorreto de CustomerFile para upload de templates de empresa

### Prisma / Banco de Dados

- [ ] **IDOR em updates Prisma: sempre incluir `clinicId` no `where` para evitar que um tenant altere dados de outro**
  - 🔴 Anti-padrão: `prisma.entity.update({ where: { id }, data: { ... } })` — qualquer `clinicId` que conheça o `id` do registro pode sobrescrevê-lo, mesmo que pertença a outra clínica
  - ✅ Correto: usar `updateMany` com `clinicId` no where (garante multi-tenancy) e depois `findFirst` para retornar o objeto atualizado:
    ```ts
    await this.prisma.entity.updateMany({
      where: { id, clinicId },
      data: { ... },
    });
    return this.prisma.entity.findFirst({ where: { id, clinicId } });
    ```
  - 📌 Regra geral: **toda** operação de escrita em tabelas multi-tenant (`update`, `delete`, `updateMany`) deve incluir `clinicId` no `where`. O `id` isolado não é suficiente — é uma superfície de IDOR. Se `updateMany` retornar `count === 0`, o registro não pertence ao tenant → lançar `NotFoundException`
  - 📅 Aprendido em: 25/03/2026 — revisão de repositórios Prisma sem filtro de tenant em operações de update

- [ ] **`clinicId` nunca deve ser descartado no nível do repositório — defesa em profundidade exige `clinicId` no `WHERE` em toda camada**
  - 🔴 Anti-padrão: receber `clinicId` como parâmetro no método do repositório e ignorá-lo (ex.: `_clinicId: string`) confiando que a service já faz o isolamento upstream. Se a service for chamada por outro ponto sem `clinicId`, o repositório não oferece nenhuma barreira
  - ✅ Correto: o repositório **sempre** inclui `clinicId` no `WHERE`, independentemente de a service também fazê-lo. A validação é redundante por design:
    ```ts
    // Errado — clinicId recebido mas ignorado
    async findById(_clinicId: string, id: string) {
      return this.prisma.document.findUnique({ where: { id } });
    }

    // Correto — clinicId aplicado na query
    async findById(clinicId: string, id: string) {
      return this.prisma.document.findFirst({ where: { id, clinicId } });
    }
    ```
  - 📌 Regra geral: prefixar um parâmetro com `_` significa que ele é recebido mas não usado — em repositórios multi-tenant isso é sempre um bug de segurança. Nunca usar `_clinicId` em métodos de repositórios de dados que pertencem a uma clínica.
  - 📌 Defesa em profundidade: service filtra por tenant → repositório filtra por tenant → query retorna apenas dados do tenant correto. Se qualquer camada falhar, a outra ainda protege.
  - 📅 Aprendido em: 30/03/2026 — revisão de assinatura remota por link (PR #136): repositório `remote-sign` descartava `clinicId` com `_clinicId`

- [ ] **Webhook secret deve causar falha explícita se não configurado — nunca usar condicional `if (expected && ...)` que desabilita silenciosamente a proteção**
  - 🔴 Anti-padrão: validar o webhook secret com `if (expected && received !== expected)` — quando `expected` é `undefined` (variável de ambiente não configurada), a condição inteira é `false` e **qualquer requisição passa sem autenticação**:
    ```ts
    // INSEGURO — variável não configurada desabilita proteção
    const expected = process.env.WEBHOOK_SECRET;
    if (expected && req.headers['x-signature'] !== expected) {
      throw new UnauthorizedException();
    }
    ```
  - ✅ Correto: aplicar o padrão **fail-fast** — se o secret não estiver configurado, recusar todas as requisições e registrar o erro de configuração:
    ```ts
    // SEGURO — fail-fast: secret ausente = nenhuma requisição passa
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected) {
      // Erro de configuração crítico — bloquear e logar
      throw new InternalServerErrorException('WEBHOOK_SECRET não configurado');
    }
    if (req.headers['x-signature'] !== expected) {
      throw new UnauthorizedException('Assinatura de webhook inválida');
    }
    ```
  - 📌 Regra geral: qualquer verificação de segurança que depende de uma variável de ambiente deve **falhar explicitamente** quando a variável estiver ausente — nunca tratar ausência como "skip". O sistema deve ser seguro por padrão (secure by default).
  - 📌 Aplica-se a: webhook secrets, chaves de API de terceiros (pagamentos, notificações, WhatsApp), tokens de integração, segredos de HMAC.
  - 📅 Aprendido em: 30/03/2026 — revisão de assinatura remota por link (PR #136): handler de callback de assinatura permitia requests sem secret quando `WEBHOOK_SECRET` não estava no env

- [ ] **Migration criada localmente mas não commitada — Railway não encontra a migration e banco permanece desatualizado (BLOQUEANTE)**
  - 🔴 Anti-padrão: criar o arquivo `migration.sql` localmente via `prisma migrate dev` (ou manualmente) sem forçar o commit. O arquivo existe no disco mas não no git porque o `.gitignore` do projeto contém a regra `apps/api/prisma/migrations/` — que ignora **novos** arquivos de migration (migrations mais antigas já estavam rastreadas antes dessa regra existir). Resultado: Railway executa `prisma migrate deploy` e não encontra a migration → banco permanece com schema antigo → queries falham ou dados somem silenciosamente:
    ```bash
    # ERRADO — migration existe localmente mas não no repositório
    npx prisma migrate dev --name add_payment_method
    git add .
    git commit -m "feat: add payment method"
    # ⚠️ migration.sql não foi incluída — .gitignore a ignorou
    ```
  - ✅ Correto: sempre que criar um novo arquivo em `prisma/migrations/`, usar `git add -f` para forçar o rastreamento **antes** do commit, no mesmo PR das mudanças de código:
    ```bash
    # CORRETO — forçar inclusão da migration no git
    npx prisma migrate dev --name add_payment_method
    git add -f aesthera/apps/api/prisma/migrations/<nome_da_migration>/migration.sql
    git commit -m "feat: add payment method + migration"
    ```
  - 📌 Checklist obrigatório após qualquer alteração de schema:
    1. `npx prisma generate` — regenerar o client
    2. `npx prisma migrate dev --name <descricao>` — gerar o arquivo SQL
    3. `git add -f aesthera/apps/api/prisma/migrations/<nome>/migration.sql` — forçar rastreamento
    4. Commitar migration **no mesmo PR** das mudanças de código que dependem do novo schema
  - 📌 Regra geral: o `.gitignore` ignora por padrão arquivos novos em `prisma/migrations/`. Qualquer migration nova **exige** `git add -f`. Nunca assumir que `git add .` incluiu a migration — verificar com `git status` que o arquivo está na staging area antes de commitar.
  - 📌 Sinal de alerta: se `git status` não lista nenhum arquivo de migration após um `prisma migrate dev`, é porque o `.gitignore` a ocultou — usar `git add -f` imediatamente.
  - 📅 Aprendido em: 01/04/2026 — anti-padrão identificado com `.gitignore` contendo `apps/api/prisma/migrations/` ignorando novas migrations, causando falha silenciosa no deploy Railway

- [ ] **Chamar outros services dentro de `prisma.$transaction` sem propagar o cliente `tx` — operações ficam fora da transação**
  - 🔴 Anti-padrão: dentro de um bloco `prisma.$transaction(async (tx) => { ... })`, chamar um método de outro service que internamente usa `this.prisma` em vez de `tx` — essas operações rodam fora da transação e não são revertidas em caso de erro:
    ```ts
    // ERRADO — promotionService usa this.prisma internamente, não tx
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: paymentData });
      await this.promotionService.applyPromotion(customerId, promotionId); // ← fora da tx!
    });
    ```
  - ✅ Correto: propagar o cliente `tx` para qualquer operação que deve participar da transação. Se o service externo não aceita `tx`, mover a lógica inline ou refatorar o método para aceitar um `PrismaClient | Prisma.TransactionClient` como parâmetro:
    ```ts
    // CORRETO — tx propagado
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: paymentData });
      await this.promotionService.applyPromotion(customerId, promotionId, tx); // ← dentro da tx
    });

    // No promotionService:
    async applyPromotion(
      customerId: string,
      promotionId: string,
      tx?: Prisma.TransactionClient,
    ) {
      const client = tx ?? this.prisma;
      await client.promotion.update({ ... });
    }
    ```
  - 📌 Regra geral: dentro de `$transaction`, **toda** operação de banco que deve ser atômica com o restante precisa usar o `tx` recebido como parâmetro — nunca `this.prisma`. Verificar chamadas a services externos como se fossem chamadas de banco diretas.
  - 📌 Sinal de alerta: se um service externo é chamado dentro de `$transaction` e esse service não recebe `tx` como parâmetro, há grande chance de violação de atomicidade.
  - 📅 Aprendido em: 30/03/2026 — revisão de fluxo de recebimento: `promotionService.applyPromotion` chamado dentro da `$transaction` de pagamento usava `this.prisma`, ficando fora da transação

---

- [ ] **Domain events NUNCA devem ser emitidos dentro de `prisma.$transaction()` — emitir APÓS o commit**
  - 🔴 Anti-padrão: emitir eventos de domínio (ex.: `this.eventEmitter.emit('billing.created', billingId)`) dentro do bloco `prisma.$transaction(async (tx) => { ... })` — se o evento disparar um side effect que por sua vez abre uma nova transação ou lê dados do banco, pode encontrar o estado ainda incompleto (pre-commit) do banco de dados. Em caso de rollback, o evento já foi emitido mas o dado não existe:
    ```ts
    // ERRADO — evento emitido antes do commit
    await this.prisma.$transaction(async (tx) => {
      const billing = await tx.billing.create({ data: billingData });
      this.eventEmitter.emit('billing.created', billing.id); // perigoso: tx ainda não commitou
    });
    ```
  - ✅ Correto: guardar o ID ou payload do que foi criado, sair da transação (deixar o commit acontecer), e emitir o evento **depois**:
    ```ts
    // CORRETO — evento emitido após o commit
    let createdBillingId: string;

    await this.prisma.$transaction(async (tx) => {
      const billing = await tx.billing.create({ data: billingData });
      createdBillingId = billing.id;
      // Nenhum evento emitido aqui
    });

    // Após o commit:
    this.eventEmitter.emit('billing.created', createdBillingId);
    ```
  - 📌 Regra geral: domain events são notificações de que algo **foi persistido**. Se o dado ainda está dentro de uma transação não commitada, nada "foi persistido" ainda — disparar o evento precocemente cria race conditions entre o evento e o dado no banco.
  - 📌 Aplica-se a: qualquer `eventEmitter.emit()`, `this.eventEmitter.emit()`, `EventBus.publish()` ou mecanismo equivalente chamado dentro de um bloco `$transaction`.
  - 📅 Aprendido em: 02/04/2026 — revisão de arquitetura do redesenho do fluxo de cobrança (Issue #147): domain event `billing.created` proposto dentro de `$transaction` de recebimento

---

- [ ] **Consultas de vouchers/cupons ativos devem filtrar por `expirationDate` — buscar só por `status: 'ACTIVE'` retorna itens vencidos**
  - 🔴 Anti-padrão: buscar vouchers válidos filtrando apenas `status: 'ACTIVE'` sem considerar a data de expiração — vouchers com `expirationDate` no passado continuam com `status: 'ACTIVE'` no banco se não houver job de expiração automática. Resultado: a UI exibe o voucher como disponível, o usuário seleciona, e o backend rejeita no momento do uso:
    ```ts
    // ERRADO — voucher vencido aparece na lista
    const vouchers = await prisma.voucher.findMany({
      where: { clinicId, status: 'ACTIVE' },
    });
    ```
  - ✅ Correto: sempre combinar o filtro de `status` com a verificação de `expirationDate`:
    ```ts
    // CORRETO — exclui vouchers vencidos
    const vouchers = await prisma.voucher.findMany({
      where: {
        clinicId,
        status: 'ACTIVE',
        OR: [
          { expirationDate: null },                       // sem data de expiração = nunca vence
          { expirationDate: { gte: new Date() } },        // data de expiração no futuro
        ],
      },
    });
    ```
  - 📌 Regra geral: qualquer entidade com campo de validade temporal (`expirationDate`, `validUntil`, `expiresAt`) **nunca** deve ser consultada apenas por `status`. O status persistido pode estar desatualizado — a data é a fonte de verdade da validade atual. Sempre usar `OR: [{ dateField: null }, { dateField: { gte: new Date() } }]`.
  - 📌 Aplica-se a: vouchers, cupons de desconto, tokens de convite, links de assinatura remota, sessões de pré-venda, pacotes com validade.
  - 📅 Aprendido em: 03/04/2026 — code review identificou que vouchers vencidos apareciam na UI de resgate por falta de filtro de expirationDate

---

- [ ] **`SELECT FOR UPDATE` em comentário sem `$queryRaw` não gera lock real — Prisma não adiciona `FOR UPDATE` implicitamente em `$transaction`**
  - 🔴 Anti-padrão: comentar no código que está usando "SELECT FOR UPDATE" para proteger contra race condition, mas implementar via Prisma Client normal dentro de `$transaction` — o Prisma **não** adiciona `FOR UPDATE` automaticamente, mesmo dentro de `$transaction`. A `$transaction` garante consistência de leitura (snapshot), não lock de linha:
    ```ts
    // ERRADO — sem lock real, apenas comentário enganoso
    await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE para evitar double-spend
      const voucher = await tx.voucher.findFirst({ where: { id } }); // ← NÃO tem FOR UPDATE
      if (voucher.usedCount >= voucher.maxUses) throw new BadRequestException('...');
      await tx.voucher.update({ where: { id }, data: { usedCount: { increment: 1 } } });
    });
    ```
  - ✅ Correto: para lock real de linha em PostgreSQL, usar `$queryRaw` com a cláusula `FOR UPDATE` explícita dentro da transação:
    ```ts
    // CORRETO — lock real via $queryRaw
    await prisma.$transaction(async (tx) => {
      const [voucher] = await tx.$queryRaw<Voucher[]>`
        SELECT * FROM "Voucher" WHERE id = ${id} FOR UPDATE
      `;
      if (!voucher || voucher.usedCount >= voucher.maxUses) {
        throw new BadRequestException('Voucher esgotado ou inválido');
      }
      await tx.voucher.update({
        where: { id },
        data: { usedCount: { increment: 1 } },
      });
    });
    ```
  - 📌 Alternativa sem `$queryRaw`: usar `UPDATE ... WHERE usedCount < maxUses` e checar `count` retornado — se `count === 0`, houve race condition e o update foi recusado. Essa abordagem é safer e não depende de `$queryRaw`:
    ```ts
    const result = await tx.voucher.updateMany({
      where: { id, usedCount: { lt: maxUses } }, // condição atômica no banco
      data: { usedCount: { increment: 1 } },
    });
    if (result.count === 0) throw new BadRequestException('Voucher esgotado');
    ```
  - 📌 Regra geral: nunca confiar em comentários como "SELECT FOR UPDATE" sem verificar se o código realmente gera a cláusula SQL. Dentro de `$transaction` do Prisma, o único jeito de obter `FOR UPDATE` é via `$queryRaw` ou `$executeRaw`. Para uso em produção, a alternativa com `updateMany` + verificação de `count` é preferível por ser type-safe.
  - 📌 Aplica-se a: qualquer cenário de concorrência com recursos limitados — vouchers com `maxUses`, vagas em sala, saldo de pacote, estoque de produto.
  - 📅 Aprendido em: 03/04/2026 — code review identificou `SELECT FOR UPDATE` em comentário sem implementação real via `$queryRaw` em handler de resgate de voucher

---

- [ ] **Múltiplos branches de pagamento devem estar TODOS dentro da mesma `$transaction` — atomicidade inconsistente entre caminhos é silenciosamente perigosa**
  - 🔴 Anti-padrão: quando um método tem ≥2 caminhos de pagamento (ex.: voucher, cash, cartão), apenas um dos branches é envolvido em `$transaction` — os demais executam operações de banco fora da transação, quebrando a atomicidade garantida só para um subconjunto dos casos:
    ```ts
    // ERRADO — cash e card estão fora da transação
    if (method === 'voucher') {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.create({ ... });
        await tx.voucher.update({ ... }); // consumo do voucher na tx
      });
    } else {
      // cash/card: sem $transaction — falha parcial não é revertida
      await this.prisma.payment.create({ data: paymentData });
      await this.prisma.billing.update({ where: { id }, data: { status: 'PAID' } });
    }
    ```
  - ✅ Correto: qualquer método com múltiplos caminhos que tocam o banco deve envolver **todos** os branches na mesma `$transaction`:
    ```ts
    // CORRETO — todos os caminhos com o mesmo nível de atomicidade
    await this.prisma.$transaction(async (tx) => {
      if (method === 'voucher') {
        await tx.payment.create({ ... });
        await tx.voucher.update({ ... });
      } else if (method === 'cash') {
        await tx.payment.create({ ... });
      } else {
        await tx.payment.create({ ... });
        await tx.cardTransaction.create({ ... });
      }
      // operações comuns a todos os caminhos — dentro da mesma tx
      await tx.billing.update({ where: { id }, data: { status: 'PAID' } });
    });
    ```
  - 📌 Regra geral: o nível de atomicidade de um método é determinado pelo seu pior caso — se **qualquer** branch precisa de `$transaction`, **todos** os branches precisam. Nunca misturar operações com e sem `$transaction` dentro do mesmo método.
  - 📌 Sinal de alerta: presença de `if (method === ...)` com um branch dentro de `$transaction` e outro usando `this.prisma.X` diretamente. Se `this.prisma.X` aparece fora de `$transaction` no mesmo método, a atomicidade está incompleta.
  - 📌 Aplica-se a: métodos de pagamento com múltiplas formas (voucher/cash/card/PIX), métodos de cancelamento com múltiplos caminhos de estorno, qualquer service method com branches `if/else` que tocam o banco em múltiplos pontos.
  - 📅 Aprendido em: 03/04/2026 — code review PR #148 identificou branches de pagamento (voucher/cash/card) com atomicidade inconsistente: apenas o branch de voucher estava dentro de `$transaction`

---

- [ ] **Parâmetros de exclusão declarados com `_` em métodos de verificação de conflito nunca chegam ao `WHERE` da query — operações de edição sempre retornam falso-positivo (BLOQUEANTE)**
  - 🔴 Anti-padrão: declarar parâmetros de exclusão (`excludeId`, `excludeAppointmentId`, `excludeReceiptId`) com prefixo `_` em métodos como `checkConflict`, `verifyAvailability` ou similares — o prefixo `_` indica que o parâmetro foi recebido na assinatura mas **nunca repassado** à query do repositório. Resultado: ao editar um registro existente, a verificação de conflito encontra o próprio registro e bloqueia a atualização legítima:
    ```typescript
    // ❌ Errado — _excludeId declarado mas ignorado
    async checkConflict(
      professionalId: string,
      startAt: Date,
      endAt: Date,
      _excludeId?: string, // nunca repassado à query
    ): Promise<boolean> {
      return this.repo.findConflict(professionalId, startAt, endAt);
      // excludeId nunca chegou ao WHERE da query — edição sempre conflita consigo mesma
    }
    ```
  - ✅ Correto: remover o prefixo `_` e propagar o parâmetro explicitamente ao repositório. No repositório, usar a cláusula `NOT` no `where`:
    ```typescript
    // ✅ Correto — excludeId repassado ao repositório
    async checkConflict(
      professionalId: string,
      startAt: Date,
      endAt: Date,
      excludeId?: string,
    ): Promise<boolean> {
      return this.repo.findConflict(professionalId, startAt, endAt, excludeId);
    }

    // No repositório:
    where: {
      professionalId,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId && { id: { not: excludeId } }),
    }
    ```
  - 📌 Como detectar: buscar parâmetros com prefixo `_` nos métodos `checkConflict`, `verifyAvailability` ou similares. Se o parâmetro existe com `_`, ele nunca é usado — confirmar na chamada ao repositório e no `where` da query.
  - 📌 Regra geral: todo parâmetro `excludeId` / `excludeAppointmentId` / `excludeReceiptId` recebido por um método de verificação de conflito **deve** aparecer explicitamente no `where` da query do repositório. Nenhum parâmetro de exclusão pode ter prefixo `_`.
  - 📌 Relação com anti-padrão existente: análogo ao `_clinicId` descartado em repositórios multi-tenant (documentado em 30/03/2026) — ambos são parâmetros `_` que indicam ignorância intencional, mas neste caso a consequência é quebrar operações de edição, não uma falha de segurança de tenant.
  - 📌 Aplica-se a: todos os métodos de verificação de conflito — agendamentos, recibos, cobranças, reservas de sala, qualquer entidade onde a edição deve excluir o próprio registro da checagem.
  - 📅 Aprendido em: 03/04/2026 — code review identificou `_excludeId` em `checkConflict` de agendamentos; parâmetro jamais chegava ao `WHERE` do repositório, fazendo toda edição de agendamento resultar em conflito consigo mesma

---

## Frontend

### Filtros e Pesquisa

- [ ] **`<select>` nativo para entidades cadastradas é BLOQUEANTE**
  - 🔴 Anti-padrão: qualquer `<select>/<option>` ou `<datalist>` para campos que carregam dados dinâmicos da API (clientes, serviços, profissionais, insumos, salas, equipamentos)
  - ✅ Correto: sempre usar `<ComboboxSearch>` do design system (`/components/ui/combobox-search.tsx`). O componente deve ser criado antes de qualquer tela nova que precise desse padrão.
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

- [ ] **Seleção de entidades cadastradas DEVE usar `<ComboboxSearch>` com chips removíveis — nunca pills estáticas nem `<select>` nativo (BLOQUEANTE)**
  - 🔴 Anti-padrão: exibir a seleção de uma entidade da API (cliente, serviço, profissional, sala, equipamento) como:
    - `<select>` ou `<datalist>` nativo
    - Pills/badges estáticas que não podem ser removidas individualmente (ex.: `<span className="rounded-full ...">`)
  - ✅ Correto: usar exclusivamente `<ComboboxSearch>` com chips removíveis (ícone de `×` em cada item selecionado):
    ```tsx
    import { ComboboxSearch } from '@/components/ui/combobox-search';

    <ComboboxSearch
      options={services.map(s => ({ value: s.id, label: s.name }))}
      selected={selectedIds}
      onSelect={(id) => setSelectedIds(prev => [...prev, id])}
      onRemove={(id) => setSelectedIds(prev => prev.filter(x => x !== id))}
      placeholder="Buscar serviço…"
    />
    ```
  - 📌 Regra geral: toda seleção de entidade dinamicamente carregada da API usa `<ComboboxSearch>` com chips removíveis, independentemente de ser seleção única ou múltipla. Pills estáticas são elementos de exibição de informação (read-only), não controles de seleção interativos.
  - 📌 Fonte: `docs/ui-standards.md` seção 7.1 — padrão obrigatório de seleção de entidades no design system Aesthera.
  - 📅 Aprendido em: 31/03/2026 — mapeamento/validação de telas (auditoria UX 2026-03-31)

---

- [ ] **`<select>` para status/tipo fixo deve ser corrigido**
  - 🔴 Anti-padrão: `<select>` para filtros com opções fixas (≤ 6 opções) — quebra consistência com pills já usados em outras telas
  - ✅ Correto: pills `rounded-full border px-3 py-1 text-xs font-medium` com `border-primary bg-primary text-primary-foreground` quando ativo
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

- [ ] **Toda tela com filtros deve ter legenda descritiva + botão restaurar**
  - 🔴 Anti-padrão: entregar tela com filtros sem legenda de "o que está filtrado" e sem atalho de reset
  - ✅ Correto: implementar `buildFilterLabel()` + legenda `bg-muted/50 rounded-lg` + botão "Restaurar padrão" que retorna ao estado padrão (não vazio). Referência: `/carteira/page.tsx`
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

- [ ] **Filtros de telas financeiras DEVEM ter URL sync**
  - 🔴 Anti-padrão: filtros de data/período em telas financeiras sem `useSearchParams` — usuário perde contexto ao navegar
  - ✅ Correto: `useSearchParams` + `router.replace()` para sincronizar todos os filtros ativos na URL. Referência: `/carteira/page.tsx`
  - 📅 Aprendido em: 25/03/2026 — revisão transversal de filtros (issue #124)

---

- [ ] **Filtragem client-side em telas de listagem é anti-padrão — sempre disparar requisição à API**
  - 🔴 Anti-padrão: carregar todos os registros da API e aplicar `.filter()` sobre o array local em JavaScript — ex.: `const visible = data.filter(x => x.status === selected)`. Telas afetadas historicamente: `/equipment`, `/rooms`, `/services`, `/supplies`, `/products`, `/carteira` (filtros status/tipo)
  - ✅ Correto: ao mudar qualquer filtro, enviar os parâmetros como query string para a API e deixar o banco fazer a filtragem:
    ```ts
    // Errado
    const visible = equipments.filter(e => e.status === activeStatus);

    // Correto
    const { data } = useQuery({
      queryKey: ['equipments', { status: activeStatus }],
      queryFn: () => api.get(`/equipment?status=${activeStatus}`),
    });
    ```
  - 📌 Regra geral: **nenhuma tela de listagem pode usar `.filter()` sobre array local**. Qualquer mudança de filtro deve gerar nova chamada à API com os parâmetros corretos. Com centenas ou milhares de registros, carregar o dataset completo no browser antes de filtrar é impraticável.
  - 📌 Exceção aceita: filtros de UI puramente visual que não alteram os dados buscados (ex.: alternar view de lista/grid sobre os mesmos dados já paginados) — nesses casos não há nova busca.
  - 📅 Aprendido em: 29/03/2026 — levantamento UX transversal de paginação e filtragem (15 telas de listagem analisadas)

---

- [ ] **Toda nova tela de listagem DEVE incluir `<DataPagination>` e `usePaginatedQuery` desde a primeira implementação**
  - 🔴 Anti-padrão: criar tela de listagem sem paginação, usando `limit` hardcoded (ex.: `?limit=100` ou `?limit=500`) — funciona inicialmente mas degrada com o volume real de dados da clínica
  - ✅ Correto: toda tela de listagem nova deve incluir desde o início:
    1. `usePaginatedQuery` com `page`, `pageSize` e sincronização de URL via `useSearchParams`
    2. Componente `<DataPagination>` com seletor de 20/50/100 registros por página
    3. Reset automático de `page` para 1 ao alterar qualquer filtro
    4. Parâmetros `?page=1&pageSize=20` na URL para preservar contexto ao navegar
    ```tsx
    // Padrão obrigatório para toda tela nova
    const [page, setPage] = useSearchParam('page', 1);
    const [pageSize, setPageSize] = useSearchParam('pageSize', 20);

    const { data } = usePaginatedQuery(['resource', filters, page, pageSize], () =>
      api.get('/resource', { params: { ...filters, page, limit: pageSize } })
    );

    // Na tabela:
    <DataPagination
      total={data?.total}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
    />
    ```
  - 📌 Referência visual: `aesthera/apps/web/app/(dashboard)/financial/page.tsx` linhas 396–418 — estilo `border-t px-5 py-3`, botões `<Button variant="outline" size="sm">`.
  - 📌 Referência canônica de filtros + URL sync: `aesthera/apps/web/app/(dashboard)/carteira/page.tsx`.
  - 📌 Regra geral: o backend já aceita `page` e `limit` em todos os endpoints (resposta: `{ items, total, page, limit }`). Não há alteração de backend necessária — o custo de implementar paginação é exclusivamente no frontend e deve ser feito desde a tela 0, não como retrofit posterior.
  - 📅 Aprendido em: 29/03/2026 — levantamento UX transversal: nenhuma das 15 telas de listagem possuía paginação; todas usavam limites hardcoded

---

- [ ] **Ao migrar para paginação server-side, toda busca/filtro textual também deve ser migrada — nunca aplicar `.filter()` client-side sobre `data?.items` paginados**
  - 🔴 Anti-padrão: migrar a paginação para server-side mas manter o campo de busca textual filtrando client-side sobre o array `data?.items` — o filtro só vê os registros da página atual, não o dataset completo. Com 500 registros e `pageSize=20`, uma busca retorna no máximo 20 resultados em vez de pesquisar os 500:
    ```tsx
    // ERRADO — filtra apenas os 20 da página atual
    const visible = data?.items.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
    ```
  - ✅ Correto: incluir o `search` como parâmetro da query ao servidor, junto com `page` e `pageSize`. Ao alterar o campo de busca, resetar `page` para 1:
    ```tsx
    // CORRETO — busca no servidor, sobre o dataset completo
    const { data } = useQuery({
      queryKey: ['resource', { search, page, pageSize }],
      queryFn: () => api.get('/resource', { params: { search, page, limit: pageSize } }),
    });

    // Handler do input de busca
    function handleSearchChange(value: string) {
      setSearch(value);
      setPage(1); // reset obrigatório ao alterar busca
    }
    ```
  - 📌 Regra geral: **se a lista é paginada pelo servidor, qualquer filtro ou busca que precise operar sobre o dataset completo também deve ser enviado ao servidor**. Client-side filter sobre `items` paginados é sempre incorreto — é um falso filtro que apenas restringe o subconjunto visível na página.
  - 📌 Checklist de migração para server-side: (1) paginação → server-side ✅, (2) busca textual → server-side ✅, (3) filtros de status/tipo → server-side ✅, (4) ordenação → server-side ✅. Todos ou nenhum.
  - 📅 Aprendido em: 30/03/2026 — revisão de PR #141 (paginação server-side): busca textual ficou client-side sobre `data?.items`, tornando a pesquisa ineficaz quando havia mais de uma página de resultados

---

- [ ] **`<ComboboxSearch>` em filtro deve usar estilo pill e em formulário deve usar estilo retangular — mensagem de dropdown vazio varia conforme estado**
  - 🔴 Anti-padrão: usar o mesmo estilo de `<ComboboxSearch>` para contextos de filtro de listagem e de formulário de cadastro/edição; ou exibir sempre a mesma mensagem de dropdown vazio independentemente do estado do campo de busca interna:
    ```tsx
    // ERRADO — mesmo estilo em todos os contextos
    <ComboboxSearch triggerClassName="rounded-md border ..." />  // retangular também no filtro
    // ERRADO — mensagem genérica que não orienta o usuário
    emptyMessage="Nenhum resultado"  // exibido mesmo quando o campo está completamente vazio
    ```
  - ✅ Correto: diferenciar o estilo conforme o contexto de uso e a mensagem de dropdown vazio conforme o estado da query interna:
    ```tsx
    // Em barra de filtros (pill, h-8):
    <ComboboxSearch
      triggerClassName="h-8 rounded-full border px-3 py-1 text-xs font-medium"
      emptyMessage={query === '' ? 'Digite para buscar' : 'Nenhum resultado encontrado'}
      ...
    />

    // Em formulário (retangular, h-9):
    <ComboboxSearch
      triggerClassName="h-9 w-full rounded-md border px-3 py-2 text-sm"
      emptyMessage={query === '' ? 'Digite para buscar' : 'Nenhum resultado encontrado'}
      ...
    />
    ```
  - 📌 Regra geral: o `<ComboboxSearch>` tem dois contextos visuais distintos — **filtro** (`h-8`, pill, compacto, alinhado à barra) e **formulário** (`h-9`, retangular, largura total, altura padrão de input). A mensagem de dropdown vazio deve sempre diferenciar os estados: campo sem query (`''`) → "Digite para buscar"; query com busca sem resultado → "Nenhum resultado encontrado". Exibir "Nenhum resultado encontrado" com campo vazio desorientaria o usuário, que ainda não digitou nada.
  - 📌 Aplica-se a: todo uso de `<ComboboxSearch>` — tanto nos filtros de telas de listagem quanto em formulários de cadastro, edição ou modais.
  - 📅 Aprendido em: 04/04/2026 — code review PR #148: `<ComboboxSearch>` com estilo invertido (retangular no filtro) e mensagem de dropdown vazio sem distinção entre campo vazio e busca sem resultado

---

### Textos e Internacionalização (PT-BR)

- [ ] **Arquivos `.tsx` com acentuação PT-BR devem ser salvos em UTF-8 sem BOM — verificar antes de commitar no Windows**
  - 🔴 Anti-padrão: salvar arquivos `.tsx` com BOM (`﻿`, U+FEFF) ou com double-encoding (`ÃO`, `Ã§`, `Ã£`, etc.) — ocorre ao copiar texto de terminais Windows, usar editores como Notepad, ou ao configurar incorretamente o VS Code. Resultado: todos os textos da interface são renderizados como lixo no browser (`'DigitaÃ§Ã£o'`, `'Nome obrigatÃ³rio'`)
  - ✅ Correto: garantir que o arquivo está em UTF-8 sem BOM antes de commitar:
    1. No VS Code: clicar no seletor de encoding (canto inferior direito) → `Save with Encoding` → `UTF-8`
    2. Ou via `Ctrl+Shift+P` → `Change File Encoding` → `Save with Encoding` → `UTF-8`
    3. Se houver BOM, ele aparece como `﻿'use client'` no topo do arquivo — remover o caractere U+FEFF antes de salvar
  - 📌 Mapeamento dos padrões de double-encoding mais comuns (Latin-1 interpretado como UTF-8):
    - `Ã³` → `ó` | `Ã§` → `ç` | `Ã£` → `ã` | `Ã¡` → `á`
    - `Ãª` → `ê` | `Ã©` → `é` | `â€"` → `—` | `Ã£o` → `ão`
  - 📌 Regra geral: o VS Code exibe o encoding no canto inferior direito da barra de status. Em qualquer arquivo `.tsx` com texto PT-BR, confirmar que mostra `UTF-8` (sem "BOM" na label). Se mostrar `UTF-8 with BOM`, salvar novamente como `UTF-8`
  - 📅 Aprendido em: 26/03/2026 — revisão de PR #128 (`body-measurements-tab.tsx` com BOM + double-encoding, tornando toda a tela de medidas corporais inutilizável em produção)

### Acessibilidade e Cores

- [ ] **Texto branco sobre `bg-amber-500` ou `bg-orange-400` reprova WCAG — não usar em EVENT_COLOR ou STATUS_COLOR**
  - 🔴 Anti-padrão: usar `text-white` sobre fundos de baixo contraste como `bg-amber-500` ou `bg-orange-400` em badges, tags ou eventos de calendário — contraste <3:1, reprovando WCAG AA
  - ✅ Correto: para tonalidades amber/orange intermediárias, usar `text-amber-900` ou `text-orange-900` como cor de texto; ou escolher um fundo suficientemente escuro (ex.: `bg-amber-700`, `bg-orange-700`) que suporte texto branco com contraste ≥4.5:1
  - 📌 Regra geral: antes de definir qualquer par fundo + texto, verificar o contraste — para texto normal o mínimo é 4.5:1 (WCAG AA). `bg-amber-500` (#F59E0B) com `text-white` = ~2.3:1 — reprovado
  - 📅 Aprendido em: 24/03/2026 — revisão de EVENT_COLOR no calendário (cores intermediárias com texto branco)

- [ ] **`STATUS_COLOR` e `EVENT_COLOR` devem ser definidos em um único arquivo central — nunca replicados por página**
  - 🔴 Anti-padrão: definir `const STATUS_COLOR = { pending: '...', completed: '...' }` diretamente em cada página/componente que usa — resulta em divergência de cores entre páginas e dark mode inconsistente
  - ✅ Correto: centralizar em `lib/status-colors.ts` (arquivo canônico do projeto) e importar em todos os componentes que precisam. Não criar variantes locais nem duplicar para uma "versão da tela X"
  - 📌 Arquivo canônico: `aesthera/apps/web/lib/status-colors.ts` — qualquer nova constante de cor/status pertence aqui
  - 📌 Regra geral: qualquer constante visual compartilhada entre ≥2 componentes pertence a um arquivo central — alterar uma cor de status deve ser uma mudança em 1 único lugar
  - 📅 Aprendido em: 24/03/2026 — revisão de STATUS_COLOR duplicado em múltiplas páginas sem suporte a dark mode

- [ ] **Ao adicionar dark mode em constantes de cor de uma página, verificar TODAS as outras constantes de cor da mesma página antes de concluir**
  - 🔴 Anti-padrão: implementar dark mode em `STATUS_COLOR` de uma página e considerar o trabalho concluído, sem perceber que a mesma página tem outras constantes como `TYPE_COLOR`, `CONTRACT_STATUS_CLASS`, `PAYMENT_STATUS_COLOR` também sem dark mode — entrega parcial que gera inconsistência visual na mesma tela
  - ✅ Correto: ao iniciar qualquer task de dark mode em uma página, primeiro mapear **todos os objetos de mapeamento de cor existentes** no arquivo:
    ```ts
    // Antes de implementar, buscar no arquivo por esses padrões:
    // const *COLOR* = {
    // const *CLASS* = {
    // const *STYLE* = {
    // e objetos com chaves de status/tipo → classes CSS
    ```
    Só marcar como concluído quando **todas** as constantes mapeadas tiverem variantes dark mode adicionadas.
  - 📌 Exemplo real — `customers/page.tsx` tinha múltiplas constantes simultâneas sem dark mode:
    - `STATUS_COLOR` (status de atendimento)
    - `CONTRACT_STATUS_CLASS` (status de contrato)
    - `TYPE_COLOR` (tipo de cliente)
    → Todas devem receber dark mode na mesma task, não em tasks separadas
  - 📌 Regra geral: constantes de cor são "irmãs" dentro de uma página — quando uma recebe dark mode, todas devem receber. Entregar dark mode parcial em uma tela é sempre um bug visual.
  - 📅 Aprendido em: 30/03/2026 — task de dark mode em `customers/page.tsx` entregou `STATUS_COLOR` mas deixou `CONTRACT_STATUS_CLASS` e `TYPE_COLOR` sem suporte a dark mode

- [ ] **`dark:bg-{color}-900/30` é opacidade insuficiente para dark mode — usar `/40` como mínimo**
  - 🔴 Anti-padrão: usar `/30` de opacidade em fundos de badge/status no dark mode — a discriminação visual entre estados fica comprometida porque os fundos ficam quase idênticos em tonalidade escura:
    ```tsx
    // INSUFICIENTE — /30 não gera contraste adequado
    dark:bg-green-900/30 dark:text-green-300
    dark:bg-red-900/30 dark:text-red-300
    ```
  - ✅ Correto: usar `/40` como valor mínimo de opacidade para fundos de badge em dark mode; usar `/50` quando o badge precisa de destaque maior (ex: status crítico, vencido, bloqueado):
    ```tsx
    // CORRETO — /40 garante discriminação visual adequada
    dark:bg-green-900/40 dark:text-green-300
    dark:bg-red-900/40 dark:text-red-300
    // Para status crítico:
    dark:bg-red-900/50 dark:text-red-200
    ```
  - 📌 Regra geral: em dark mode, o fundo escurecido pelo `/30` de opacidade mal se distingue do fundo da célula/linha. `/40` é o mínimo aceitável; preferir `/40` a `/50` — valores acima de `/50` começam a parecer "pesados" na tela escura.
  - 📅 Aprendido em: 30/03/2026 — revisão transversal de telas com dark mode em `customers/page.tsx`

- [ ] **Badge de status deve sempre ser exibido para TODOS os estados — nunca omitir o estado "positivo"**
  - 🔴 Anti-padrão: exibir badge apenas para o estado negativo/inativo (ex: só mostrar badge "Inativo" e não mostrar nada quando o item está "Ativo") — ao fazer scan da lista, o usuário precisa inferir por ausência que o item está ativo, criando ambiguidade:
    ```tsx
    // ERRADO — só mostra badge para inativo
    {item.status === 'inactive' && (
      <Badge variant="outline">Inativo</Badge>
    )}
    ```
  - ✅ Correto: sempre renderizar o badge para ambos os estados com cores distintas:
    ```tsx
    // CORRETO — badge para ambos os estados
    <Badge className={STATUS_COLOR[item.status]}>
      {STATUS_LABEL[item.status]}
    </Badge>
    ```
  - 📌 Regra geral: listas com itens de múltiplos estados devem tornar cada estado visualmente explícito — o usuário não deve precisar inferir por ausência de elemento visual. Todo estado tem um badge, toda badge tem uma cor.
  - 📅 Aprendido em: 30/03/2026 — revisão de listagens que omitiam badge para o estado "Ativo"

- [ ] **Usar a mesma semântica de cor para o mesmo conceito em todas as telas — `zinc` vs `muted` para "Inativo" é inaceitável**
  - 🔴 Anti-padrão: usar `zinc-100 text-zinc-600` em uma tela e `bg-muted text-muted-foreground` em outra para o mesmo status "Inativo" — ou usar `green-700` em uma tela e `green-800` em outra para "Ativo". O usuário aprende a cor do status e fica confuso quando varia entre telas:
    ```tsx
    // Tela A — "Inativo"
    className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400"
    // Tela B — "Inativo" (DIVERGENTE)
    className="bg-muted text-muted-foreground"
    ```
  - ✅ Correto: importar sempre de `lib/status-colors.ts` — a constante centralizada garante que "Inativo" tem exatamente a mesma aparência em todas as telas:
    ```tsx
    import { STATUS_COLOR } from '@/lib/status-colors';
    // Ambas as telas usam o mesmo token → mesma cor garantida
    <Badge className={STATUS_COLOR.inactive}>Inativo</Badge>
    ```
  - 📌 Regra geral: inconsistência de cor para o mesmo conceito entre telas é sempre um bug de design system. A fonte da verdade é `lib/status-colors.ts` — nunca recriar localmente.
  - 📅 Aprendido em: 30/03/2026 — auditoria transversal de status badges identificou divergência zinc vs muted e green-700 vs green-800 entre telas

- [ ] **Nunca usar a mesma cor para todos os valores de um enum — cada valor deve ter cor semântica distinta**
  - 🔴 Anti-padrão: mapear todos os métodos de pagamento (ou qualquer enum com múltiplos valores) para a mesma cor (ex: todos em azul) — o badge perde o valor semântico e o usuário não consegue distinguir os tipos visualmente:
    ```tsx
    // ERRADO — todos os métodos de pagamento em azul
    const PAYMENT_METHOD_COLOR = {
      credit_card: 'bg-blue-100 text-blue-700',
      debit_card:  'bg-blue-100 text-blue-700',
      pix:         'bg-blue-100 text-blue-700',
      cash:        'bg-blue-100 text-blue-700',
    }
    ```
  - ✅ Correto: atribuir cor com semântica distinta por valor — usar a "cor natural" do conceito quando existir (PIX = verde, dinheiro = esmeralda, cartão = azul/roxo) e garantir que nenhum par adjacente de valores use a mesma cor:
    ```tsx
    // CORRETO — cores distintas com semântica
    const PAYMENT_METHOD_COLOR = {
      credit_card: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      debit_card:  'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
      pix:         'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
      cash:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    }
    ```
  - 📌 Regra geral: se ao olhar para a lista de itens todos os badges têm a mesma cor, a constante está errada. Cada estado/tipo de um enum deve ser identificável pela cor sem precisar ler o texto do badge.
  - 📌 Aplica-se a: métodos de pagamento, tipos de serviço, categorias de produto, origens de lead, tipos de contrato — qualquer enum com ≥3 valores que apareça em listagem.
  - 📅 Aprendido em: 30/03/2026 — revisão de `PAYMENT_METHOD_COLOR` com todos os valores mapeados para azul

---

- [ ] **Labels PT-BR de enums na UI NUNCA devem ser os valores raw do enum — todo enum com renderização visual exige mapeamento centralizado**
  - 🔴 Anti-padrão: renderizar diretamente o valor do enum como texto do badge ou label na interface (ex.: `{item.sourceType}` → exibe `"APPOINTMENT"`, `"PRESALE"`, `"MANUAL"` para o usuário); ou definir o mapeamento de label diretamente inline no componente:
    ```tsx
    // ERRADO — valor raw do enum exibido
    <Badge>{billing.sourceType}</Badge>

    // ERRADO — mapeamento inline, não centralizado
    const label = billing.sourceType === 'APPOINTMENT' ? 'Agendamento' :
                  billing.sourceType === 'PRESALE' ? 'Pré-venda' : 'Manual';
    ```
  - ✅ Correto: criar um arquivo de mapeamento centralizado (padrão `*-labels.ts` no módulo, ou adicionar ao arquivo do módulo em `lib/`) e importar em todos os componentes:
    ```tsx
    // lib/billing-labels.ts (ou em lib/status-colors.ts se genérico)
    export const BILLING_SOURCE_LABELS: Record<BillingSourceType, string> = {
      APPOINTMENT: 'Agendamento',
      PRESALE: 'Pré-venda',
      PRODUCT_SALE: 'Venda de Produto',
      PACKAGE_SALE: 'Venda de Pacote',
      MANUAL: 'Manual',
    };

    // No componente:
    import { BILLING_SOURCE_LABELS } from '@/lib/billing-labels';
    <Badge>{BILLING_SOURCE_LABELS[billing.sourceType]}</Badge>
    ```
  - 📌 Regra geral: o valor do enum (ex.: `APPOINTMENT`, `COMPLETED`, `PACKAGE_SALE`) é um identificador técnico para o código e o banco — nunca texto para o usuário. A camada de apresentação sempre usa um mapeamento PT-BR centralizado. Para adicionar um novo valor ao enum, basta adicionar a entrada correspondente no arquivo de labels.
  - 📌 Aplica-se a: todo enum que aparece em badge, tabela, filtro de pills, select/combobox ou qualquer elemento de UI — independentemente de ser status, tipo, origem, categoria ou fluxo.
  - 📌 Verificação obrigatória: ao criar ou alterar qualquer enum no schema/backend, verificar imediatamente se há um arquivo `*-labels.ts` ou entrada em `status-colors.ts` correspondente no frontend. Se não existir, criar antes de implementar os componentes.
  - 📅 Aprendido em: 02/04/2026 — revisão de arquitetura do redesenho do fluxo de cobrança (Issue #147): `BillingSourceType` enum identificado sem mapeamento PT-BR no frontend

### Formulários e Validação

- [ ] **Verificar lógica `disabled` do botão salvar/gravar em todo formulário implementado**
  - 🔴 Erro: botão salvar com `disabled={isPending || !isDirty}` em formulário de **cadastro novo** — o form começa sem dirty state, deixando o botão sempre desabilitado
  - ✅ Correto: formulário de cadastro novo usa `disabled={isPending || !isValid}`; formulário de edição pode usar `disabled={isPending || !isDirty}` se realmente não deve salvar sem mudança
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **Nunca alterar lógica de formulários ou botões de telas não relacionadas à task**
  - 🔴 Erro: ao implementar uma task de adicionar máscara em campos, reimplementou a barra de filtros e alterou o `disabled` do botão em tela adjacente
  - ✅ Correto: identificar as zonas estáveis antes de implementar (via "Mapeamento de Zona Estável") e alterar SOMENTE os campos pedidos na issue
  - 📅 Aprendido em: 21/03/2026 — cadastro de cliente após task de máscaras em grades

- [ ] **Converter data para string ISO no frontend deve usar hora local — nunca `toISOString().slice(0, 10)` que opera em UTC**
  - 🔴 Anti-padrão: `new Date(value).toISOString().slice(0, 10)` — `toISOString()` converte para UTC; um agendamento às **23h no Brasil (UTC-3)** vira o dia seguinte em UTC, enviando a data errada para a API
  - ✅ Correto: usar conversão baseada em hora local:
    ```ts
    const toISODate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    ```
    Ou, se o projeto usa `date-fns`: `format(date, 'yyyy-MM-dd')` (usa hora local por padrão)
  - 📌 Regra geral: nunca usar `toISOString()` para extrair a parte de data em contextos com fuso horário local — o resultado depende do UTC offset do cliente
  - 📅 Aprendido em: 24/03/2026 — revisão de envio de datas de agendamentos com fuso horário

- [ ] **🔁 REINCIDÊNCIA (PR #144, 02/04/2026) — `<select>` nativo para forma de pagamento em formulários de venda é bloqueante — nunca substituir `<ComboboxSearch>` ou pills por `<select>` nativo**
  - ⚠️ Este padrão foi documentado em 25/03/2026 (filtros) e **reincidiu no PR #144** — o `<select>` nativo foi usado para o campo "forma de pagamento" em formulário de venda mesmo após a proibição estar catalogada nos learnings.
  - 🔴 Anti-padrão: usar `<select><option>...</option></select>` nativo para campos de seleção de forma de pagamento — mesmo com ≤ 6 opções fixas, o elemento nativo quebra a consistência visual do design system Aesthera:
    ```tsx
    // ERRADO — select nativo
    <select onChange={e => setMethod(e.target.value)}>
      <option value="credit_card">Cartão de Crédito</option>
      <option value="pix">PIX</option>
      <option value="cash">Dinheiro</option>
    </select>
    ```
  - ✅ Correto: a escolha do componente segue a regra de opções:
    - **Opções fixas ≤ 6** → **pills selecionáveis** (`rounded-full border px-3 py-1 text-xs font-medium`), mesmo padrão dos filtros de status
    - **Opções fixas > 6** → **`<Select>` do shadcn/ui** (`@/components/ui/select`)
    - **Opções dinâmicas da API** → **`<ComboboxSearch>`** (`@/components/ui/combobox-search.tsx`)
    ```tsx
    // CORRETO — pills para forma de pagamento (opções fixas ≤ 6)
    {PAYMENT_METHODS.map(method => (
      <button
        key={method.value}
        type="button"
        onClick={() => setMethod(method.value)}
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          selected === method.value
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background hover:bg-accent'
        )}
      >
        {method.label}
      </button>
    ))}

    // CORRETO — <Select> shadcn/ui para dropdown estilizado (opções fixas > 6)
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    <Select value={method} onValueChange={setMethod}>
      <SelectTrigger><SelectValue placeholder="Selecionar forma de pagamento" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
        <SelectItem value="pix">PIX</SelectItem>
      </SelectContent>
    </Select>
    ```
  - 📌 Regra geral: **nenhum `<select>` nativo é aceitável no design system Aesthera** — em nenhum contexto, seja para opções fixas ou dinâmicas. O scan dos learnings deve ocorrer ANTES de implementar qualquer campo de seleção.
  - 📌 Aplica-se a: forma de pagamento, tipo de serviço, categoria de produto, status, qualquer campo com opções enumeradas em formulários de venda ou modais.
  - 📌 Ponto de verificação obrigatório: ao implementar qualquer campo de seleção em formulário, perguntar antes de escrever código: "Este campo usa `<select>` nativo?" — se sim, parar e usar a alternativa correta acima.
  - 📅 Aprendido em: 02/04/2026 — anti-padrão de `<select>` nativo para forma de pagamento reintroduzido no PR #144 (Fluxo de Pagamento, Pacotes e Promoções) após documentação em 25/03/2026

### Componentes e Estado

- [ ] **🔁 REINCIDÊNCIA (PR #144, 30/03/2026) — Nunca criar modais manualmente com `fixed inset-0 z-50` — sempre usar o componente `<Dialog>` do shadcn/ui**
  - ⚠️ Este padrão foi documentado em 25/03/2026 e **reincidiu no PR #144** — evidência de que o `code-review-learnings.md` não estava sendo consultado ANTES de escrever código. Ler os learnings como pós-checklist não previne reincidências — o scan deve ocorrer ANTES de implementar qualquer componente de UI.
  - 🔴 Anti-padrão: implementar modal com `<div className="fixed inset-0 z-50 ...">` ou overlay customizado — não garante foco trap (acessibilidade), não respeita o `isDirty` guard, não possui animações padronizadas e viola o `ui-standards.md`
  - ✅ Correto: importar e usar o componente `<Dialog>` disponível em `@/components/ui/dialog`:
    ```tsx
    import {
      Dialog,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogFooter,
    } from '@/components/ui/dialog';

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Título do Modal</DialogTitle>
        </DialogHeader>
        {/* conteúdo */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    ```
  - 📌 Regra geral: `<Dialog>` do shadcn/ui fornece foco trap, fechamento por `Esc`, overlay acessível e animações consistentes — qualquer substituição manual perde esses comportamentos e gera inconsistência visual entre telas
  - 📅 Aprendido em: 25/03/2026 — revisão de dois componentes de modal implementados com `fixed inset-0 z-50` customizado

---

- [ ] **Toda caixa de aviso, alerta, informação ou erro contextual DEVE usar `<InfoBanner>` — nunca CSS Tailwind inline (BLOQUEANTE)**
  - 🔴 Anti-padrão: criar caixas de feedback visual manualmente com classes inline — o implementador tipicamente escolhe tons errados da paleta, gerando baixo contraste não intencional:
    ```tsx
    // ERRADO — caixa amber manual com contraste insuficiente
    <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-100 dark:bg-amber-900/40 dark:border-amber-700 p-3">
      <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800 dark:text-amber-400">Atenção: ...</p>
    </div>
    // Por que fica ruim: bg-amber-100 + text-amber-800 = tons próximos = baixo contraste
    // dark:text-amber-400 sobre dark:bg-amber-900/40 = ainda pior no dark mode

    // ERRADO — caixa azul inline
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
      <Info className="h-3 w-3 text-blue-600" />
      <span>Informação: ...</span>
    </div>
    ```
  - ✅ Correto: importar `<InfoBanner>` de `@/components/ui/info-banner.tsx` e usar a variante semântica correta:
    ```tsx
    import { InfoBanner } from '@/components/ui/info-banner'

    // Uso básico
    <InfoBanner variant="warning" title="Esta ação não pode ser desfeita"
      description="O registro será removido permanentemente do sistema." />

    // Uso com conteúdo rico (listas, valores formatados)
    <InfoBanner variant="warning" title="Créditos serão devolvidos à carteira">
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>• {item.label} — {formatCurrency(item.value)}</li>
        ))}
      </ul>
    </InfoBanner>
    ```
  - 📌 Variantes disponíveis e quando usar:
    | Variante | Quando usar |
    |----------|------------|
    | `warning` | Atenção, consequência potencial, dado sensível, ação com impacto |
    | `info` | Contexto adicional, dica, informação neutra |
    | `error` | Bloqueio, falha, ação impossível |
    | `success` | Confirmação positiva contextual |
  - 📌 Componente em: `aesthera/apps/web/components/ui/info-banner.tsx` — já importado como `@/components/ui/info-banner`
  - 📌 O `<InfoBanner>` aceita `title?`, `description?` e `children` — use `children` para conteúdo rico (listas, valores) em vez de criar wrapper inline
  - 📌 Regra geral: o componente já tem dark mode correto com combinações de contraste validado — não é necessário inventar classes de cor
  - 📌 Dívida técnica mapeada: existem ~6 caixas inline no codebase que devem ser migradas ao `<InfoBanner>` nas próximas tasks que tocarem esses arquivos: `billing/page.tsx`, `products/page.tsx`, `appointments/page.tsx` (×1), `customers/page.tsx` (×2), `sell-product-form.tsx`
  - 📅 Aprendido em: 04/04/2026 — revisão PR #148: bloco amber manual em `ReopenBillingButton` com `bg-amber-100 text-amber-800` (baixo contraste) e `dark:text-amber-400` sobre `dark:bg-amber-900/40` (contraste pior no dark mode); `InfoBanner` existia mas era usado em apenas 1 de ~7 lugares necessários
  - 🔴 Erro: barra de filtros com `flex gap-4` ou `space-x-2` ao invés do padrão — campos desalinhados
  - ✅ Correto: sempre usar `className="flex flex-wrap items-center gap-2"` para a div que contém filtros. Campo de busca: `h-8 w-48 text-sm`
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **Verificar que campos de pesquisa novos seguem as classes do padrão `ui-standards.md`**
  - 🔴 Erro: `<Input className="w-full" placeholder="Search...">` — fora do padrão em tamanho e idioma
  - ✅ Correto: `<Input placeholder="Buscar por nome…" value={search} onChange={...} className="h-8 w-48 text-sm" />`
  - 📅 Aprendido em: 21/03/2026 — tela de estoque nova

- [ ] **CTA em empty state nunca deve ser `<button>` nativo estilizado com underline — usar `<Button variant="outline">` dentro do container padronizado**
  - 🔴 Anti-padrão: renderizar o call-to-action do estado vazio como `<button className="text-primary underline">` ou `<a>` estilizado — quebra consistência visual, não segue o design system e viola `ui-standards.md` seção 2.3
  - ✅ Correto: usar sempre o container e botão padronizados:
    ```tsx
    <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
      <p className="text-sm">Nenhum registro encontrado.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
        Adicionar primeiro registro
      </Button>
    </div>
    ```
  - 📌 Regra geral: todo empty state com ação primária usa `<Button variant="outline" size="sm" className="mt-3">` — nunca elemento nativo. O container segue exatamente `rounded-lg border bg-card py-16 text-center text-muted-foreground` conforme `ui-standards.md` seção 2.3
  - 📅 Aprendido em: 25/03/2026 — revisão de empty state com `<button>` nativo e underline em tela de uploads/medidas corporais

- [ ] **Controles booleanos devem sempre usar `<Switch>` do shadcn/ui — nunca `<button>` nativo estilizado como toggle**
  - 🔴 Anti-padrão: implementar um toggle com `<button>` nativo e classes condicionais (ex.: `bg-green-500` / `bg-gray-300`) para representar um estado booleano (ativo/inativo, sim/não, habilitado/desabilitado)
  - ✅ Correto: importar e usar `<Switch>` de `@/components/ui/switch`:
    ```tsx
    import { Switch } from '@/components/ui/switch';

    <Switch
      checked={isActive}
      onCheckedChange={(val) => handleToggle(val)}
      aria-label="Ativar notificação"
    />
    ```
  - 📌 Regra geral: `<Switch>` do shadcn/ui fornece acessibilidade (`role="switch"`, `aria-checked`), animações consistentes, suporte a dark mode e estados desabilitados prontos. Qualquer `<button>` estilizado como toggle é uma reimplementação inferior que quebra a consistência visual e a acessibilidade do sistema.
  - 📌 Aplica-se a: qualquer campo que represente um valor booleano — ativo/inativo, habilitado/desabilitado, visível/oculto, notificar/não notificar.
  - 📅 Aprendido em: 30/03/2026 — revisão de PR #136 (assinatura remota): toggle de configuração implementado com `<button>` nativo

- [ ] **Nunca exibir feedback de sucesso (toast, badge, estado visual) para uma operação que não foi persistida no backend**
  - 🔴 Anti-padrão: mostrar `toast.success('Salvo!')`, alterar um badge para "Ativo" ou atualizar estado visual de confirmação **sem ter feito chamada à API** — o usuário acredita que a ação foi persistida quando na verdade nenhuma requisição foi enviada:
    ```ts
    // ERRADO — feedback sem persistência
    const handleToggle = () => {
      setIsActive(!isActive);
      toast.success('Configuração salva!'); // nenhuma chamada de API
    };
    ```
  - ✅ Correto: o feedback de sucesso só ocorre **após** a confirmação da API (`.onSuccess` da mutation):
    ```ts
    // CORRETO — feedback condicionado à resposta da API
    const mutation = useMutation({
      mutationFn: (value: boolean) => api.patch('/settings', { isActive: value }),
      onSuccess: () => toast.success('Configuração salva!'),
      onError: () => toast.error('Erro ao salvar. Tente novamente.'),
    });

    const handleToggle = (val: boolean) => mutation.mutate(val);
    ```
  - 📌 Regra geral: estado otimista (atualizar UI antes da API responder) é aceitável apenas com rollback em `onError`. Qualquer feedback de "salvo" sem API call — ou sem tratamento de erro — é um bug que erode a confiança do usuário e mascara falhas silenciosas.
  - 📌 Checklist antes de adicionar qualquer `toast.success`: existe uma `mutationFn` correspondente? O toast está dentro do `onSuccess`? Existe um `onError` com mensagem de falha?
  - 📅 Aprendido em: 30/03/2026 — revisão de PR #136 (assinatura remota): feedback visual de ativação exibido sem chamada à API

- [ ] **`idempotencyKey` gerado em `useState` de modal com `if (!open) return null` persiste entre aberturas — usar `useMemo` com dependência em `open`**
  - 🔴 Anti-padrão: gerar a `idempotencyKey` (ou qualquer valor que precisa ser único por abertura de modal) em `useState(() => uuid())` dentro de um componente modal que usa `if (!open) return null` como early return — como o `useState` é inicializado apenas na primeira montagem e o componente **não é desmontado** ao fechar (o `if` só bloqueia o render, não desmonta), a chave permanece a mesma em todas as aberturas subsequentes:
    ```tsx
    // ERRADO — key persiste entre aberturas (useState inicializa só na montagem)
    const [idempotencyKey] = useState(() => crypto.randomUUID());

    if (!open) return null; // não desmonta, só para de renderizar
    ```
  - ✅ Correto: duas opções, dependendo do contexto:
    ```tsx
    // Opção 1 — useMemo com dependência em `open`: recalcula quando o modal abre
    const idempotencyKey = useMemo(
      () => (open ? crypto.randomUUID() : ''),
      [open] // nova key a cada abertura
    );

    // Opção 2 — mover o early return para fora do componente (preferred):
    // No componente pai:
    {open && <PaymentModal open={open} onClose={...} />}
    // O componente é desmontado ao fechar → useState gera nova key na remontagem
    ```
  - 📌 Regra geral: `useState` com valor inicial calculado (`useState(() => fn())`) só executa `fn` **uma vez** — na primeira montagem. Se o componente usa `if (!open) return null`, ele não é desmontado ao fechar. Para valores que devem ser únicos por abertura (idempotency keys, seeds de formulário), usar `useMemo([open])` ou garantir desmontagem real via renderização condicional no pai (`{open && <Modal />}`).
  - 📌 Aplica-se a: qualquer modal que gera UUID, seed de formulário, token de sessão local, ou qualquer valor que precisa ser recriado a cada abertura.
  - 📅 Aprendido em: 30/03/2026 — revisão de modal de pagamento: `idempotencyKey` em `useState` com early return `if (!open) return null` enviava a mesma chave em pagamentos repetidos

---

- [ ] **Nunca usar caracteres unicode como ícones — sempre usar equivalentes Lucide React (BLOQUEANTE)**
  - 🔴 Anti-padrão: usar emoji ou símbolos unicode diretamente em JSX para representar ações ou indicadores visuais (ex.: `🏷`, `✓`, `✕`, `×`, `●`, `★`) — esses caracteres têm renderização inconsistente entre sistemas operacionais e navegadores, não respeitam o tema (dark/light), não seguem o design system e não são acessíveis:
    ```tsx
    // ERRADO — unicode como ícone
    <span>🏷 Etiqueta</span>
    <button>✕</button>
    <span>✓ Confirmado</span>
    ```
  - ✅ Correto: importar sempre o ícone equivalente do pacote `lucide-react` com tamanho e cor controlados por classes Tailwind:
    ```tsx
    import { Tag, X, Check } from 'lucide-react';

    // CORRETO — ícones Lucide
    <Tag className="h-4 w-4" />
    <button><X className="h-4 w-4" /></button>
    <Check className="h-4 w-4 text-green-600" />
    ```
  - 📌 Tabela de equivalências mais comuns:
    | Unicode | Lucide React |
    |---------|-------------|
    | 🏷      | `<Tag />`   |
    | ✓ / ✔  | `<Check />` |
    | ✕ / × / ✗ | `<X />` |
    | ●      | `<Circle />` |
    | ★      | `<Star />`  |
    | ⚠      | `<AlertTriangle />` |
    | ℹ      | `<Info />`  |
    | ✉      | `<Mail />`  |
  - 📌 Regra geral: qualquer caractere que não seja texto de conteúdo (letras, números, pontuação gramatical) deve ser substituído por um componente Lucide. Se não houver equivalente exato, escolher o ícone semanticamente mais próximo da biblioteca.
  - 📅 Aprendido em: 31/03/2026 — code review identificou uso de `🏷 ✓ ✕ ×` como ícones em componentes de UI

---

- [ ] **Banners informativos verdes devem usar `bg-green-100 text-green-700` — nunca inventar classes fora do padrão (ui-standards.md §6)**
  - 🔴 Anti-padrão: criar banners informativos de sucesso/confirmação com classes arbitrárias como `bg-emerald-50`, `bg-teal-100`, `border-green-400 text-green-900`, ou qualquer variação não especificada em `ui-standards.md`:
    ```tsx
    // ERRADO — classes fora do padrão
    <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-md p-3">
      Operação realizada com sucesso.
    </div>
    ```
  - ✅ Correto: usar exatamente `bg-green-100 text-green-700` conforme `ui-standards.md` seção 6:
    ```tsx
    // CORRETO — padrão ui-standards.md §6
    <div className="bg-green-100 text-green-700 rounded-md p-3 text-sm">
      Operação realizada com sucesso.
    </div>
    // Com dark mode:
    <div className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-md p-3 text-sm">
      Operação realizada com sucesso.
    </div>
    ```
  - 📌 Paleta de banners informativos definida em `ui-standards.md` seção 6:
    | Tipo        | Classes base                          |
    |-------------|---------------------------------------|
    | Sucesso/Info verde | `bg-green-100 text-green-700`  |
    | Atenção/Aviso  | `bg-yellow-100 text-yellow-700`    |
    | Erro/Crítico   | `bg-red-100 text-red-700`          |
    | Neutro/Info    | `bg-blue-100 text-blue-700`        |
  - 📌 Regra geral: qualquer banner informativo deve usar as classes especificadas em `ui-standards.md` — nunca inferir variações de tom (50 vs 100, emerald vs green, teal vs green) fora do que está documentado.
  - 📅 Aprendido em: 31/03/2026 — code review identificou uso de classes fora do padrão em banners informativos

---

- [ ] **Totalizadores financeiros devem ser posicionados ACIMA da tabela (ou em painel de resumo no topo) — nunca abaixo da paginação**
  - 🔴 Anti-padrão: renderizar o painel de totais (total recebido, total pendente, saldo, etc.) abaixo do componente `<DataPagination>` — o usuário precisa rolar até o final da página para ver os totalizadores, que são dado de alto valor e devem ser visíveis imediatamente:
    ```tsx
    // ERRADO — totalizadores abaixo da paginação
    <DataTable data={items} columns={columns} />
    <DataPagination ... />
    <TotalsPanel totals={totals} />  {/* invisível sem scroll */}
    ```
  - ✅ Correto: posicionar o painel de totalizadores sempre ANTES da tabela ou em área de resumo no topo da página (ex.: cards de KPI), nunca após a paginação:
    ```tsx
    // CORRETO — totalizadores visíveis sem scroll
    <TotalsPanel totals={totals} />   {/* ou cards de KPI no topo */}
    <DataTable data={items} columns={columns} />
    <DataPagination ... />
    ```
  - 📌 Regra geral: totalizadores financeiros (total recebido, pendente, saldo, receita do período) são dados de alto valor — devem estar visíveis no viewport inicial da tela, acima ou junto ao cabeçalho. Posicioná-los abaixo da paginação faz com que sejam invisíveis para qualquer usuário que não role até o final da lista.
  - 📌 Aplica-se a: toda tela financeira com totalizadores — `/billing`, `/financial`, `/carteira`, `/receipts`, ou qualquer tela de listagem que exiba totais, saldos ou KPIs numéricos.
  - 📅 Aprendido em: 04/04/2026 — code review PR #148: totalizadores financeiros renderizados abaixo do `<DataPagination>`, ficando inacessíveis sem scroll

---

## Geral

### Escopo e Disciplina de PR

- [ ] **PR de padronização de UI não deve incluir novos módulos de backend — features de alto risco exigem PR dedicado**
  - 🔴 Anti-padrão: adicionar em um único PR de padronização visual (filtros, layout, UX) um módulo de backend completo com rotas, service, repository, DTOs e migrações de banco. Ex: PR de "padronização de filtros" que incluiu todo o módulo de Contratos (backend + frontend + 3 migrações)
  - ✅ Correto: features de alto risco (integrações externas, contratos, dados jurídicos, armazenamento de arquivos, webhooks) devem ter issue e PR **independentes**, permitindo:
    - Auditoria isolada de segurança (webhook secret, multi-tenancy, presign/confirm)
    - Revisão dedicada do arquiteto e do `security-auditor`
    - Rastreabilidade de issue → PR → deploy
    - Rollback sem afetar a feature de UI que estava no mesmo PR
  - 📌 Regra geral: se um PR tem título de "padronização / refactor / UX" e inclui migrations de banco de dados ou novos módulos de API, o escopo foi extrapolado. Separar antes de colocar em review.
  - 📌 Checklist antes de abrir PR:
    1. O título do PR descreve **todo** o que há nele?
    2. Algum dos arquivos modificados está em `prisma/migrations/` sem estar previsto na issue?
    3. Algum novo módulo (`*.routes.ts`, `*.service.ts`, `*.repository.ts`) foi criado além do escopo?
    → Se sim a qualquer resposta: separar em PRs distintos
  - 📅 Aprendido em: 29/03/2026 — revisão de PR #130 (filtros + módulo completo de contratos)

---

### Testes

- [ ] **Ao injetar nova dependência de serviço em um módulo existente, adicionar `vi.mock()` correspondente no arquivo de teste**
  - 🔴 Anti-padrão: adicionar `private accountsPayable = new AccountsPayableService()` (ou qualquer outro serviço) no service, sem atualizar o teste correspondente — os testes quebram com erros de `prisma não mockado` ou `método undefined`
  - ✅ Correto: sempre que um novo serviço for injetado em um módulo que já possui testes, adicionar imediatamente o mock no arquivo `.test.ts` antes de rodar qualquer suite:
    ```ts
    vi.mock('../accounts-payable/accounts-payable.service');
    ```
    E, se necessário, configurar o comportamento esperado no `beforeEach` com `vi.mocked(AccountsPayableService.prototype.metodo).mockResolvedValue(...)`.
  - 📌 Regra geral: toda nova dependência de serviço introduzida em um módulo testado é um **breaking change nos testes** — o mock é obrigatório e deve ser adicionado no mesmo commit/PR que introduz a dependência.
  - 📅 Aprendido em: 23/03/2026 — revisão de `supply-purchases.service.test.ts` (AccountsPayableService não mockado após injeção)

- [ ] **Todo PR que adicione ou modifique arquivos `*.test.ts` / `*.spec.ts` exige a seção `## Test Change Justification` no corpo do PR — incluir no momento de abrir o PR, não como pós-fix**
  - 🔴 Anti-padrão 1: abrir um PR com alterações de testes sem a seção obrigatória — o workflow `test-guardian.yml` bloqueia o CI automaticamente
  - 🔴 Anti-padrão 2 (crítico): editar a descrição do PR depois e clicar "Re-run" **não resolve** — o GitHub Actions usa o `body` do **evento original** (`pull_request` ou `pull_request_target`), não o body atual do PR. Clicar em "Re-run" reexecuta o workflow com o payload original, sem a seção adicionada posteriormente
  - ✅ Correto: incluir a seção no corpo do PR **desde o momento da criação**:
    ```markdown
    ## Test Change Justification
    Motivo: {descrever por que os testes foram adicionados/alterados}
    Referência: {issue ou decisão técnica}
    Impacto: {o que muda no comportamento — ex: cobertura aumentada, regra de negócio atualizada}
    ```
  - 🔧 Única solução quando a seção foi esquecida: fazer um novo commit (pode ser vazio) para disparar um novo evento `pull_request` com o body atualizado:
    ```bash
    git commit --allow-empty -m "chore: trigger CI with Test Change Justification"
    git push
    ```
  - 📌 Boa prática: incluir esta seção no template de PR do repositório (`.github/pull_request_template.md`) para que apareça automaticamente em todo PR novo
  - 📅 Aprendido em: 24/03/2026 (atualizado 24/03/2026) — revisão de workflow `test-guardian.yml`; comportamento do GitHub Actions com evento original confirmado

- [ ] **Teste existente quebrando após sua implementação = NUNCA alterar o teste — classificar o tipo e acionar o `test-guardian`**
  - 🔴 Anti-padrão (crítico): implementador modifica assertions, mocks ou remove `it()` blocks de testes existentes para o CI passar — pode estar silenciando proteção de regras de negócio críticas que a implementação violou sem perceber
  - 📌 Dois tipos de quebra — tratamentos distintos:
    - **Tipo 1 — Estrutural** (pode ser adaptado): o teste quebrou porque a estrutura mudou (novo campo obrigatório, assinatura alterada), mas a regra de negócio continua válida. Ex: adicionou `roomId` como obrigatório e o teste antigo não passa o campo. → test-guardian adapta o teste sem relaxar assertions.
    - **Tipo 2 — Regra de Negócio** (NUNCA adaptar — corrigir o código): o comportamento do sistema mudou de forma que viola uma regra estabelecida. Ex: teste `não permitir dois agendamentos para o mesmo profissional no mesmo horário` quebra porque a implementação removeu a verificação de conflito. → o código está errado. O teste só pode ser alterado se o PO documentar e aprovar explicitamente a mudança de regra.
  - ✅ Correto: ao detectar quebra, classificar e reportar ao usuário:
    ```
    ⚠️ Testes existentes quebraram após esta implementação:
    - {arquivo}.test.ts: "{nome do teste}" — {erro resumido}
      Tipo: [Estrutural | Regra de Negócio] — {justificativa}

    Não alterei os testes. Acione o test-guardian.
    ```
  - 📅 Aprendido em: 25/03/2026 (atualizado 25/03/2026) — CI bloqueado após implementador alterar teste para contornar falha; distinção Tipo 1/Tipo 2 adicionada após análise de impacto de regra de negócio

- [ ] **Após abrir qualquer PR, adicionar o roteiro de testes manuais como comentário — nunca no corpo do PR**
  - 🔴 Anti-padrão: abrir o PR sem o comentário de roteiro; colocar os cenários no corpo do PR (onde ficam misturados com a descrição técnica e não são atualizáveis sem risco de disparar CI)
  - ✅ Correto: imediatamente após criar o PR, executar `mcp_github_add_issue_comment` com o formato padrão já definido no prompt:
    ```markdown
    ## 🧪 Roteiro de Testes Manuais

    **Pré-requisitos:**
    - {ex.: clínica com pelo menos 1 profissional cadastrado}

    **Cenários:**
    - [ ] **{cenário principal}** — {o que fazer e o que esperar}
    - [ ] **{validação / erro esperado}** — {o que fazer e o que deve acontecer}

    **Fluxo base:**
    1. {passo mínimo para chegar à feature}
    2. {passo 2}
    ```
  - 📌 Máximo de 5 cenários: caso feliz, validação principal, erro esperado e edge case relevante — sem descrever cada clique
  - 📌 Se a feature for exclusivamente backend/API, substituir o fluxo de UI pelo endpoint + payload de teste
  - 📅 Aprendido em: 25/03/2026 — padrão definido após ausência recorrente de roteiro de teste manual em PRs

- [ ] **Nunca usar `if (instance)` + `?.mock.results[0]?.value` em torno de `expect()` — asserções condicionais criam testes que passam verde sem executar**
  - 🔴 Anti-padrão: usar `?.mock.results[0]?.value` para obter a instância de um mock e envolvê-la em `if (instance)` antes do `expect()` — se o mock não foi chamado ou o acesso opcional retorna `undefined`, o `if` nunca executa e o teste passa verde silenciosamente sem ter feito nenhuma asserção:
    ```ts
    // ERRADO — teste passa verde mesmo sem instância (instance = undefined → if skipped)
    const instance = MockedService.mock.results[0]?.value;
    if (instance) {
      expect(instance.someMethod).toHaveBeenCalledWith(expectedPayload);
    }
    // Se MockedService nunca foi instanciado: mock.results[0] = undefined,
    // instance = undefined, o if é falso → expect NÃO executa → teste PASSA
    ```
  - ✅ Correto: usar `vi.hoisted()` para capturar a referência ao mock de forma segura e determinista, sem depender de acesso opcional a `mock.results`:
    ```ts
    // CORRETO — vi.hoisted() garante referência disponível antes da resolução do módulo
    const { mockSomeMethod } = vi.hoisted(() => ({
      mockSomeMethod: vi.fn(),
    }));

    vi.mock('../some.service', () => ({
      SomeService: vi.fn().mockImplementation(() => ({
        someMethod: mockSomeMethod,
      })),
    }));

    it('chama someMethod com o payload correto', async () => {
      await sut.execute(input);
      // expect sempre executa — não depende de condição
      expect(mockSomeMethod).toHaveBeenCalledWith(expectedPayload);
    });
    ```
  - 📌 Regra geral: nenhum `expect()` deve estar dentro de um bloco `if` — se a condição não for satisfeita, o teste passa sem testar coisa alguma. Em Vitest, `vi.hoisted()` é o padrão correto para capturar referências de mock antes da resolução do módulo; nunca usar `?.mock.results[0]?.value` com guarda condicional.
  - 📌 Sinal de alerta no code review: qualquer `if (variable) { expect(...) }` em arquivo de teste é um falso positivo em potencial — a asserção pode nunca ter executado em nenhuma run do CI. Reportar como bloqueante.
  - 📌 Aplica-se a: testes que verificam chamadas a serviços mockados, repositórios, clientes HTTP, processadores de fila — qualquer mock de classe onde a instância é acessada via `mock.results`.
  - 📅 Aprendido em: 03/04/2026 — code review PR #148 identificou `if (instance)` em torno de `expect()` usando `?.mock.results[0]?.value`, criando asserções silenciosas que passariam verde mesmo sem execução

- [ ] **Spec que inverte comportamento coberto por testes quebrará os testes por design — delegar ao `test-guardian`, nunca usar workarounds na implementação**
  - 🔴 Anti-padrão: quando uma spec/issue deliberadamente inverte ou substitui um comportamento que já estava coberto por testes, o implementador tenta preservar as premissas antigas com adaptações no código (condicionais extras, flags de compatibilidade, lógica duplicada) para fazer o teste antigo passar junto com o novo comportamento — isso mascara a regressão intencional e gera código de duas cabeças:
    ```ts
    // ERRADO — workaround para não quebrar teste antigo enquanto implementa spec nova
    async createBilling(dto: CreateBillingDto) {
      if (dto.legacy) {
        // lógica antiga para o teste passar
        return this.legacyFlow(dto);
      }
      // novo fluxo da spec
      return this.newFlow(dto);
    }
    ```
  - ✅ Correto: implementar exatamente o que a spec define, sem branches de compatibilidade. Se testes existentes quebrarem, classificar como **Tipo 2 — Regressão por design** e reportar ao usuário antes de abrir o PR:
    ```
    ⚠️ Testes existentes quebraram porque a spec inverte deliberadamente o comportamento anterior:
    - billing.service.test.ts: "deve criar cobrança vinculada ao agendamento" — FALHOU
      Tipo: Regressão por design (spec #147 remove vínculo direto Billing→Appointment)

    Não alterei os testes. Delegando ao test-guardian para reescrever com as novas premissas.
    ```
  - 📌 Distinção crítica em relação ao item anterior (Tipo 1/Tipo 2):
    - **Tipo 1 — Estrutural**: regra de negócio não mudou, apenas a assinatura/contrato mudou → test-guardian adapta o teste
    - **Tipo 2 — Regra de negócio violada involuntariamente**: implementação errou → corrigir o código
    - **Tipo 3 — Regressão por design (este item)**: a spec intencionalmente inverte o comportamento → test-guardian reescreve o teste com as NOVAS premissas da spec; nenhum código de workaround é adicionado
  - 📌 Como identificar: se a issue/spec descreve explicitamente que um comportamento anterior deve ser substituído (ex.: "cobrança deixa de ser gerada automaticamente pelo agendamento e passa a ser criada manualmente"), qualquer teste que valide o comportamento antigo é candidato a regressão por design.
  - 📌 Regra geral: o implementador não tem autoridade para decidir que um teste antigo "já não faz sentido" e removê-lo ou adaptá-lo sozinho. Essa decisão pertence ao `test-guardian` (que valida se a regressão é realmente intencional) em conjunto com o PO (que documenta a mudança de regra). O implementador apenas entrega o código com a spec nova e reporta as quebras.
  - 📌 Aplica-se a: qualquer spec que contenha linguagem como "em vez de", "substitui", "remove o vínculo", "deixa de ser automático", "passa a ser manual", "não deve mais" — sinais de que o novo comportamento é incompatível com premissas existentes.
  - 📅 Aprendido em: 04/04/2026 — revisão de fluxo pós-atendimento (spec redesenho billing #147): spec inverte geração automática de cobranças, quebrando testes por design

### Arquitetura e Padrões do Projeto

- [ ] **Task de formatação/máscara = alterar somente o campo alvo, nada mais**
  - 🔴 Erro: ao adicionar máscara de CPF/telefone/CNPJ em um campo, foi alterado o layout do wrapper, a barra de filtros e outros inputs do mesmo formulário
  - ✅ Correto: identificar o `<FormField>` ou `<Input>` específico e aplicar a máscara nele. Se o arquivo precisar de qualquer outra mudança fora do campo, parar e perguntar ao usuário
  - 📅 Aprendido em: 21/03/2026 — task de máscaras nas grades

- [ ] **Leitura obrigatória do arquivo completo antes de qualquer edição em tela existente**
  - 🔴 Erro: editar apenas os trechos relevantes sem ler o arquivo completo, causando alteração acidental de padrões que estavam corretos
  - ✅ Correto: ler o arquivo inteiro, mapear as zonas estáveis e confirmar que o diff final afeta exclusivamente o que a issue pede
  - 📅 Aprendido em: 21/03/2026 — cadastro de cliente após task de grades

---

## Histórico de Atualizações

| Data | PR | Itens adicionados |
|------|----|-------------------|
| — | — | Arquivo criado (vazio) |
| 21/03/2026 | — | 5 padrões adicionados pelo treinador-agent: lógica disabled do botão salvar, barra de filtros desalinhada, campos de pesquisa fora do padrão, task de máscara alterando escopo indevido, leitura obrigatória de arquivo antes de edição |
| 22/03/2026 | — | 1 padrão adicionado pelo treinador-agent: anti-padrão "ocultar UI mas deixar API aberta" — proteção de dados sensíveis deve existir no backend via roleGuard |
| 23/03/2026 | — | 1 padrão adicionado pelo treinador-agent: campos obrigatórios por regra de negócio devem ter validação explícita no `service.create()`, além do schema Zod |
| 24/03/2026 | — | 6 padrões adicionados pelo treinador-agent: (1) contraste WCAG para texto branco sobre amber/orange em EVENT_COLOR; (2) STATUS_COLOR centralizado em arquivo único; (3) guards de role na menor granularidade possível; (4) safe parse de data em DTOs Zod com `.refine(Number.isFinite(Date.parse(v)))`; (5) toISODate em frontend usando hora local, não `toISOString()`; (6) seção `## Test Change Justification` obrigatória em PRs com arquivos de teste |
| 25/03/2026 | — | 2 padrões adicionados pelo treinador-agent: (1) IDOR em updates Prisma — `update({ where: { id } })` sem `clinicId` permite alteração cross-tenant; padrão correto é `updateMany` + `findFirst` com `clinicId`; (2) catch genérico mascarando erros de infra em storage/API externo — inspecionar código de erro antes de silenciar |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: modal manual com `fixed inset-0 z-50` é anti-padrão — sempre usar `<Dialog>` do shadcn/ui (`@/components/ui/dialog`) para foco trap, animações e consistência visual |
| 31/03/2026 | PR #144 | 🔁 Reincidência do anti-padrão `fixed inset-0 z-50` (já documentado em 25/03) — confirmado que `code-review-learnings.md` estava sendo usado como checklist pós-implementação, não como pré-requisito pré-código. Prompt do implementador atualizado: scan pré-código dos learnings agora é passo 3 explícito do Fluxo de Trabalho (ANTES do passo Implementar) |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: fluxo presign/confirm de upload — `presign` deve persistir `PendingUpload` no banco; `confirm` valida pelo `id` server-side com `clinicId`, nunca aceita `storageKey` bruto do cliente |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: CTA em empty state nunca usa `<button>` nativo com underline — padrão correto é `<Button variant="outline" size="sm" className="mt-3">` dentro de container `rounded-lg border bg-card py-16 text-center text-muted-foreground` (ui-standards.md §2.3) |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: teste existente quebrando = nunca alterar o teste, acionar test-guardian; assumir que o código está errado por padrão |
| 26/03/2026 | PR #128 | 1 padrão adicionado pelo treinador-agent: arquivos `.tsx` com acentuação PT-BR devem ser salvos em UTF-8 sem BOM no Windows — BOM (U+FEFF) e double-encoding causam corrupção total de texto na interface; correção via VS Code → `Save with Encoding` → UTF-8 |
| 25/03/2026 | — | 4 padrões adicionados pelo treinador-agent (issue #124 — revisão transversal de filtros): (1) `<select>` para entidades cadastradas é BLOQUEANTE — usar `<ComboboxSearch>`; (2) `<select>` para status fixo → corrigir para pills; (3) legenda descritiva + botão "Restaurar padrão" obrigatórios em toda tela com filtros; (4) URL sync via `useSearchParams` em filtros de telas financeiras |
| 25/03/2026 | — | 1 padrão adicionado pelo treinador-agent: após abrir qualquer PR, adicionar cenários de teste manual como comentário (não no corpo) via `mcp_github_add_issue_comment` — tabela Markdown por área (Settings, Ficha do Cliente, API/Multi-tenancy, Scripts) com colunas #, Cenário, Resultado esperado; cobrir fluxo feliz, casos de borda, permissões por papel e estados vazios/negativos |
| 29/03/2026 | — | 1 padrão adicionado pelo treinador-agent: upload de recursos de empresa (não por cliente) usa caminho `templates/{clinicId}/{uuid}.ext` via presign customizado no módulo — nunca usar o fluxo `CustomerFile` que exige `customerId`; convenção de prefixos de storage: `customers/` para arquivos de cliente, `templates/` para templates de empresa, `clinic/` para recursos gerais da clínica |
| 29/03/2026 | — | 2 padrões adicionados pelo treinador-agent (levantamento UX transversal — 15 telas de listagem): (1) filtragem client-side com `.filter()` sobre array local é anti-padrão — qualquer mudança de filtro deve disparar nova requisição à API com parâmetros de query; (2) toda nova tela de listagem deve incluir `<DataPagination>` e `usePaginatedQuery` com URL sync desde a primeira implementação — nunca usar `limit` hardcoded |
| 30/03/2026 | PR #136 | 2 padrões adicionados pelo treinador-agent (revisão de assinatura remota por link): (1) `_clinicId` em repositório multi-tenant é bug de segurança — `clinicId` deve sempre estar no `WHERE`, defesa em profundidade exige isolamento em toda camada; (2) webhook secret condicional com `if (expected && ...)` desabilita proteção silenciosamente quando env não configurado — usar fail-fast: lançar erro se secret ausente, nunca skip |
| 30/03/2026 | PR #136 | 2 padrões adicionados pelo treinador-agent (revisão de assinatura remota por link — UX/componentes): (1) controles booleanos devem sempre usar `<Switch>` do shadcn/ui — `<button>` nativo como toggle quebra acessibilidade e consistência visual; (2) feedback de sucesso (toast, badge, estado visual) só pode ser exibido após confirmação da API em `onSuccess` — nunca antes ou sem chamada de API |
| 31/03/2026 | — | 2 padrões adicionados pelo treinador-agent: (1) nunca usar caracteres unicode como ícones (`🏷 ✓ ✕ ×`) — sempre usar equivalentes Lucide React com classes Tailwind para controle de tamanho e cor; (2) banners informativos verdes devem usar `bg-green-100 text-green-700` conforme `ui-standards.md` seção 6 — nunca inventar variações de tom (emerald, teal, green-50) fora do padrão documentado |
| 01/04/2026 | — | 1 padrão adicionado pelo treinador-agent: migration não commitada — `.gitignore` contém `apps/api/prisma/migrations/` e ignora novos arquivos de migration; sempre usar `git add -f` para forçar rastreamento da migration.sql no mesmo PR das mudanças de código; checklist obrigatório: `prisma generate` + `prisma migrate dev` + `git add -f` + commit da migration junto com o código |
| 02/04/2026 | PR #144 | 🔁 Reincidência do anti-padrão `<select>` nativo para campos de seleção (já documentado em 25/03/2026) — `<select>` nativo usado para forma de pagamento em formulário de venda mesmo após proibição catalogada. Regra de componentes adicionada: opções fixas ≤6 → pills; opções fixas >6 → `<Select>` shadcn/ui; opções dinâmicas da API → `<ComboboxSearch>`. Nenhum `<select>` nativo é aceitável no design system Aesthera. |
| 02/04/2026 | Issue #147 | 2 padrões adicionados pelo treinador-agent (revisão de arquitetura do redesenho do fluxo de cobrança): (1) domain events NUNCA devem ser emitidos dentro de `prisma.$transaction()` — guardar o ID criado, deixar o commit ocorrer, emitir o evento APÓS; (2) labels PT-BR de enums na UI devem ser definidas em arquivo centralizado `*-labels.ts` — nunca exibir o valor raw do enum (ex: `APPOINTMENT`, `PRESALE`) como texto para o usuário; verificação obrigatória ao criar/alterar qualquer enum. |
| 03/04/2026 | PR #148 | 2 padrões adicionados pelo treinador-agent: (1) múltiplos branches de pagamento (voucher/cash/card) devem ter TODOS o mesmo nível de atomicidade — se qualquer branch precisa de `$transaction`, todos precisam; misturar `this.prisma.X` fora de `$transaction` com branches dentro é atomicidade incompleta; (2) assertivas condicionais com `if (instance)` + `?.mock.results[0]?.value` criam testes falso-positivos que passam verde sem executar a asserção — usar sempre `vi.hoisted()` para capturar referências de mock; nenhum `expect()` deve ser envolvido em `if`. |
| 03/04/2026 | — | 1 padrão adicionado pelo treinador-agent: parâmetros de exclusão (`excludeId`, `excludeAppointmentId`, `excludeReceiptId`) com prefixo `_` em métodos de verificação de conflito nunca chegam ao `WHERE` da query — o prefixo `_` indica ignorância intencional; resultado é falso-positivo em toda operação de edição, bloqueando atualizações legítimas de registros existentes; solução: remover o `_` e propagar o parâmetro explicitamente ao repositório com cláusula `id: { not: excludeId }`. |
| 04/04/2026 | — | 1 padrão adicionado pelo treinador-agent: spec que inverte deliberadamente comportamento coberto por testes gera regressão por design (Tipo 3) — implementador não adapta nem remove testes, implementa exatamente a spec nova, classifica as quebras como "Regressão por design" e delega ao `test-guardian` para reescrever com as novas premissas; nenhum workaround de compatibilidade é adicionado ao código de produção. |
| 04/04/2026 | PR #148 | 2 padrões adicionados pelo treinador-agent: (1) `<ComboboxSearch>` em filtro deve usar estilo pill (`h-8 rounded-full`); em formulário, estilo retangular (`h-9 rounded-md`) — estilos e alturas são contextuais e não intercambiáveis; mensagem de dropdown vazio contextual: campo vazio (`''`) → "Digite para buscar"; busca sem resultado → "Nenhum resultado encontrado"; (2) totalizadores financeiros devem ser posicionados ACIMA da tabela (ou em painel de resumo no topo) — nunca abaixo do `<DataPagination>`; dado de alto valor deve ser visível no viewport inicial sem necessidade de scroll. |
| 04/04/2026 | PR #148 | 1 padrão adicionado pelo treinador-agent: `<InfoBanner>` de `@/components/ui/info-banner.tsx` é OBRIGATÓRIO para toda caixa de aviso/alerta/info/erro contextual — nunca recriar inline com classes Tailwind (bloco amber, azul, vermelho ou verde manual). Componente estendido com `children?: React.ReactNode` e `title?` opcional para suportar conteúdo rico. Dívida técnica: ~6 caixas inline no codebase ainda precisam ser migradas (`billing/page.tsx`, `products/page.tsx`, `appointments/page.tsx`, `customers/page.tsx` ×2, `sell-product-form.tsx`). |
