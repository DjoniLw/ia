# Padrões — Geral: Testes

> Carregue este arquivo quando for implementar ou modificar arquivos `*.test.ts` / `*.spec.ts`, ou ao criar testes para código novo.

---

- [ ] **`vi.hoisted()` para referências de mock — nunca `?.mock.results[0]?.value` com condicional**
  - 🔴 Anti-padrão: `const instance = MockedService.mock.results[0]?.value; if (instance) { expect(...) }` — se o mock não foi chamado, `if` nunca executa e o teste PASSA verde silenciosamente.
  - ✅ Correto:
    ```ts
    const { mockSomeMethod } = vi.hoisted(() => ({ mockSomeMethod: vi.fn() }));
    vi.mock('../some.service', () => ({
      SomeService: vi.fn().mockImplementation(() => ({ someMethod: mockSomeMethod })),
    }));
    it('chama someMethod', async () => {
      await sut.execute(input);
      expect(mockSomeMethod).toHaveBeenCalledWith(expectedPayload); // sempre executa
    });
    ```
  - 📌 Regra: nenhum `expect()` deve estar dentro de um bloco `if`. `vi.hoisted()` é o padrão para capturar referências de mock em Vitest.
  - 📌 Sinal de alerta na revisão: qualquer `if (variable) { expect(...) }` em arquivo de teste é falso positivo em potencial.
  - 📅 03/04/2026

---

- [ ] **`## Test Change Justification` no corpo do PR desde a criação — não como pós-fix**
  - 🔴 Anti-padrão 1: abrir PR com alterações de testes sem a seção — workflow `test-guardian.yml` bloqueia o CI.
  - 🔴 Anti-padrão 2 (crítico): editar a descrição depois e clicar "Re-run" — GitHub Actions usa o payload do **evento original**, não o body atual.
  - ✅ Correto: incluir desde a criação:
    ```markdown
    ## Test Change Justification
    Motivo: {por que os testes foram adicionados/alterados}
    Referência: {issue ou decisão técnica}
    Impacto: {o que os testes cobrem}
    ```
  - 🔧 Única solução quando esquecido: commit vazio para re-disparar o evento:
    ```bash
    git commit --allow-empty -m "chore: trigger CI with Test Change Justification"
    git push
    ```
  - 📅 24/03/2026

---

- [ ] **Teste existente quebrando = NUNCA alterar — classificar o tipo e acionar `test-guardian`**
  - 🔴 Anti-padrão: modificar assertions, mocks ou remover `it()` para o CI passar — pode silenciar proteção de regra de negócio.
  - ✅ Correto: classificar e reportar:
    ```
    ⚠️ Testes existentes quebraram após esta implementação:
    - {arquivo}.test.ts: "{nome do teste}" — {erro resumido}
      Tipo: [Estrutural | Regra de Negócio | Regressão por Design] — {justificativa}
    Não alterei os testes. Acione o test-guardian.
    ```
  - 📌 Tipos de quebra:
    - **Tipo 1 — Estrutural**: estrutura mudou, regra de negócio intacta → test-guardian adapta o teste
    - **Tipo 2 — Regra de Negócio**: código violou uma regra → corrigir o código, não o teste
    - **Tipo 3 — Regressão por Design**: spec inverte intencionalmente o comportamento anterior → test-guardian reescreve com novas premissas; zero workarounds no código
  - 📅 25/03/2026, 04/04/2026

---

- [ ] **Ao injetar nova dependência de serviço em módulo existente, adicionar `vi.mock()` no arquivo de teste**
  - 🔴 Anti-padrão: adicionar `private accountsPayable = new AccountsPayableService()` sem atualizar o teste — quebra com "método undefined".
  - ✅ Correto: no mesmo commit, adicionar ao arquivo de teste:
    ```ts
    vi.mock('../accounts-payable/accounts-payable.service');
    ```
  - 📌 Toda nova dependência em módulo testado é um **breaking change nos testes** — o mock é obrigatório no mesmo PR.
  - 📅 23/03/2026

---

- [ ] **Roteiro de testes manuais como comentário no PR — nunca no corpo**
  - 🔴 Anti-padrão: colocar os cenários no corpo do PR (misturado com descrição técnica; não atualizável sem risco de re-disparar CI).
  - ✅ Correto: imediatamente após criar o PR, comentar com:
    ```markdown
    ## 🧪 Roteiro de Testes Manuais
    **Pré-requisitos:** {dados/perfil necessários}
    **Cenários:**
    - [ ] **{cenário principal}** — {o que fazer e o que esperar}
    - [ ] **{erro esperado}** — {o que fazer e o que deve acontecer}
    **Fluxo base:**
    1. {passo mínimo para chegar à feature}
    ```
  - 📌 Máximo 5 cenários: caso feliz, validação principal, erro esperado, edge case.
  - 📌 Para features exclusivamente backend/API: substituir fluxo de UI pelo endpoint + payload de teste.
  - 📅 25/03/2026

---

- [ ] **Testes de `$transaction` devem incluir cenário de falha do último step — nunca só happy path**
  - 🔴 Anti-padrão: `mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx))` apenas — o callback executa sem erro; nunca verifica que a transação propaga o erro quando um step intermediário falha.
  - ✅ Correto — para cada `$transaction` implementado, adicionar:
    ```ts
    it('deve propagar erro se o último step da transação falhar (atomicidade)', async () => {
      // Mock dos steps anteriores como sucesso
      mockTx.entity.update.mockResolvedValue({ id: ENTITY_ID, status: 'updated' });
      // Mock do último step como falha
      mockTx.auditLog.create.mockRejectedValue(new Error('DB constraint'));

      await expect(service.execute(input)).rejects.toThrow('DB constraint');
      // Em produção, o Prisma reverte todos os steps anteriores
    });
    ```
  - 📌 Regra: "testar atomicidade" sem simular falha não testa atomicidade — apenas testa o happy path dentro de um callback.
  - 📌 O que verificar: existe pelo menos 1 teste onde o **último step** (`auditLog.create`, `billing.update`, etc.) lança e o service propaga o erro? Se não → a garantia de rollback está sem cobertura.
  - 📅 08/04/2026 — issue #152 (`resolveDiff` com `$transaction` testado apenas em sucesso; falha de `auditLog.create` não coberta)
