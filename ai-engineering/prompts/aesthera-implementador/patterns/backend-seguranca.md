# Padrões — Backend: Segurança e Multi-tenancy

> Carregue este arquivo quando for implementar: endpoints, guards de acesso, webhooks, ou fluxos de upload/storage.

---

- [ ] **Nunca proteger dados sensíveis apenas ocultando a UI — a proteção DEVE existir no backend**
  - 🔴 Anti-padrão: restringir acesso de um perfil (ex: recepcionista) apenas ocultando o componente React. Isso não impede chamadas diretas à API.
  - ✅ Correto: toda restrição de acesso a dados sensíveis exige `roleGuard` no endpoint. A UI pode também ocultar, mas nunca é a única barreira.
  - 📌 Regra: se o usuário consegue chamar `GET /financial-summary` via curl e receber dados, a proteção de UI é inútil.
  - 📅 22/03/2026

---

- [ ] **Guards de role na menor granularidade possível — não no componente pai inteiro**
  - 🔴 Anti-padrão: guard no componente pai ou `early return` no nível da página inteira — bloqueia partes que deveriam ser visíveis ao perfil restrito.
  - ✅ Correto: aplicar o guard diretamente na sub-seção protegida (ex.: painel financeiro dentro de uma tela de cliente).
  - 📌 Regra: quanto menor o escopo do guard, mais precisa e menos disruptiva é a proteção.
  - 📅 24/03/2026

---

- [ ] **IDOR em updates Prisma: sempre incluir `clinicId` no `where`**
  - 🔴 Anti-padrão: `prisma.entity.update({ where: { id }, data: { ... } })` — qualquer `clinicId` que conheça o `id` pode sobrescrever dados de outro tenant.
  - ✅ Correto: usar `updateMany` com `clinicId` no where + `findFirst` para retornar o objeto:
    ```ts
    await this.prisma.entity.updateMany({ where: { id, clinicId }, data: { ... } });
    return this.prisma.entity.findFirst({ where: { id, clinicId } });
    ```
  - 📌 Se `updateMany` retornar `count === 0`, lançar `NotFoundException`.
  - 📅 25/03/2026

---

- [ ] **`clinicId` nunca deve ser descartado no repositório — defesa em profundidade**
  - 🔴 Anti-padrão: `async findById(_clinicId: string, id: string)` — prefixo `_` indica que o parâmetro é recebido mas ignorado.
  - ✅ Correto: o repositório **sempre** inclui `clinicId` no `WHERE`:
    ```ts
    async findById(clinicId: string, id: string) {
      return this.prisma.document.findFirst({ where: { id, clinicId } });
    }
    ```
  - 📌 Nunca usar `_clinicId` em repositórios de dados de tenant. Service filtra → repositório filtra → defesa dupla.
  - 📅 30/03/2026

---

- [ ] **Webhook secret deve causar falha explícita se não configurado (fail-fast)**
  - 🔴 Anti-padrão: `if (expected && received !== expected)` — quando `expected` é `undefined`, a condição inteira é `false` e qualquer requisição passa.
  - ✅ Correto:
    ```ts
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected) throw new InternalServerErrorException('WEBHOOK_SECRET não configurado');
    if (req.headers['x-signature'] !== expected) throw new UnauthorizedException('Assinatura inválida');
    ```
  - 📌 Aplica-se a: webhook secrets, chaves de API de terceiros, tokens de integração, segredos de HMAC.
  - 📅 30/03/2026

---

- [ ] **Catch genérico mascarando erros de infra — nunca `catch { return false }`**
  - 🔴 Anti-padrão: silenciar toda exceção em chamadas a serviços externos com `catch { return false }` — falha de credencial fica indistinguível de "arquivo não encontrado".
  - ✅ Correto: inspecionar o código de erro antes de decidir:
    ```ts
    try {
      await s3.send(new GetObjectCommand({ ... }));
    } catch (err: unknown) {
      if (err instanceof Error && (err as { Code?: string }).Code === 'NoSuchKey') return null;
      throw err; // erro de infra — propagar
    }
    ```
  - 📌 `catch { return false }` é aceitável **somente** quando qualquer falha é tratada como ausência de dado.
  - 📅 25/03/2026

---

- [ ] **Fluxo presign/confirm de upload: `presign` persiste PendingUpload; `confirm` valida pelo `id` — nunca aceita `storageKey` do cliente**
  - 🔴 Anti-padrão: `POST /uploads/confirm` recebe `storageKey` do cliente diretamente — permite apontar para qualquer chave do bucket.
  - ✅ Correto:
    1. `POST /uploads/presign` → gera URL assinada + persiste `PendingUpload { id, storageKey, clinicId, expiresAt }`
    2. `POST /uploads/confirm` → recebe apenas `uploadId`, busca `PendingUpload` com `clinicId` do token, verifica `expiresAt`, persiste recurso usando `pending.storageKey`
  - 📌 O cliente **nunca** nomeia ou referencia uma chave de storage diretamente no `confirm`.
  - 📅 25/03/2026

---

- [ ] **Upload de recursos de empresa usa caminho `templates/{clinicId}/{uuid}.ext` — nunca o fluxo `CustomerFile`**
  - 🔴 Anti-padrão: usar `CustomerFile` (que exige `customerId`) para arquivos vinculados à clínica como um todo (templates, logotipo, protocolos).
  - ✅ Correto: endpoint de presign dedicado no módulo:
    ```ts
    const key = `templates/${clinicId}/${randomUUID()}.${ext}`;
    ```
  - 📌 Convenção de prefixos de storage:
    - `customers/{clinicId}/{customerId}/{uuid}.ext` → arquivo de cliente (usar CustomerFile)
    - `templates/{clinicId}/{uuid}.ext` → template/recurso de empresa
    - `clinic/{clinicId}/{uuid}.ext` → recurso geral da clínica
  - 📅 29/03/2026
