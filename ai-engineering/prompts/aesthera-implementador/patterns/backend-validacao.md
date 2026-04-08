# Padrões — Backend: Validação e Tipagem (Zod + Service)

> Carregue este arquivo quando for implementar: schemas Zod, DTOs, ou validações de regra de negócio em services.

---

- [ ] **Campos obrigatórios por regra de negócio devem ser validados explicitamente no `service.create()`, não apenas no schema Zod**
  - 🔴 Anti-padrão: `roomId?: string` no Zod (opcional) mas exigido pela regra de negócio — o Zod aceita a requisição sem o campo e o service executa sem validar.
  - ✅ Correto:
    ```ts
    if (!dto.roomId) {
      throw new BadRequestException('roomId é obrigatório para agendamentos.');
    }
    ```
  - 📌 Regra: o Zod valida a **forma** dos dados (tipo, formato). Regras de negócio (ex.: "sala é obrigatória para este tipo") devem ser verificadas no service.
  - 📅 23/03/2026

---

- [ ] **Campos opcionais que podem ser zerados pelo frontend devem usar `.nullable().optional()`**
  - 🔴 Anti-padrão: `z.number().optional()` — quando o usuário apaga o valor, o frontend envia `null`, mas `.optional()` aceita apenas `undefined`, rejeitando com erro 400.
  - ✅ Correto:
    ```ts
    // Aceita undefined (campo não enviado) E null (campo limpo pelo usuário)
    maxUses: z.number().nullable().optional(),
    minAmount: z.number().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    ```
  - 📌 Aplica-se a: limites de uso, valores mínimos, datas de validade, descontos — qualquer campo de formulário que pode ser deixado em branco após ter sido preenchido.
  - 📅 31/03/2026

---

- [ ] **Campos de data em DTOs Zod devem usar `.refine(v => Number.isFinite(Date.parse(v)))` além do regex**
  - 🔴 Anti-padrão: validar apenas com regex `/^\d{4}-\d{2}-\d{2}$/` — `"2026-02-30"` passa no regex mas não é uma data real.
  - ✅ Correto:
    ```ts
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
      .refine(v => Number.isFinite(Date.parse(v)), 'Data inválida')
    ```
  - 📌 Regex verifica o padrão visual; `.refine()` com `Date.parse()` garante que a data é semanticamente válida.
  - 📅 24/03/2026
