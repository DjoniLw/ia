# Fluxo de Desenvolvimento — Aesthera

> Documento de referência para todos os agentes do projeto Aesthera.
> Define quando usar o fluxo completo (complexo) vs. o fluxo direto (simples).

---

## ⚡ Ponto de Entrada — `aesthera-discovery`

O agente **`aesthera-discovery`** é o ponto de entrada único para qualquer nova feature.
Você passa a ideia, ele classifica o trilho, executa todos os agentes em sequência e entrega a issue pronta.

```
Você: "Quero um módulo de fidelidade com pontuação por atendimento"
  ↓
aesthera-discovery → classifica → executa o fluxo correto → entrega issue #XYZ
```

Use os agentes individuais apenas quando precisar de uma etapa específica isolada.

---

## Fluxo Complexo — Features novas, módulos relevantes, decisões impactantes

```
1. aesthera-product-owner
   └─ Recebe ideia → gera doc.md completo
      (fluxo, regras de negócio, usuários, exceções, estrutura de implementação)

2. Em paralelo (todos revisam o mesmo doc.md):
   ├─ ux-reviewer        → revisão de UX da spec
   ├─ security-auditor   → revisão de segurança da spec
   └─ aesthera-system-architect → revisão técnica/arquitetural da spec

3. aesthera-consolidador
   └─ Recebe doc.md + 3 revisões → gera spec_final.md
      (resolve conflitos, incorpora bloqueantes, documenta decisões)

4. aesthera-issue-writer
   └─ Recebe spec_final.md → cria issue no GitHub com critérios de aceite

5. aesthera-implementador
   └─ Recebe #issue → implementa backend + frontend
```

### Quando usar o fluxo complexo

Usar quando a feature envolver **qualquer um** destes critérios:
- Novo módulo ou entidade no banco de dados
- Lógica de negócio crítica (agendamento, pagamento, autenticação, permissões)
- Dados sensíveis (financeiro, histórico clínico, dados pessoais)
- Novo fluxo de usuário (tela nova, modal novo, wizard novo)
- Mudança de arquitetura ou integração externa nova
- Feature que afeta múltiplos módulos existentes

---

## Fluxo Simples — Bugs, ajustes, melhorias pontuais, features triviais

```
1. aesthera-product-owner
   └─ Refina a solicitação (modo resumido — sem spec completa)

2. aesthera-issue-writer
   └─ Cria issue com critérios de aceite

3. aesthera-implementador
   └─ Recebe #issue → implementa
```

### Quando usar o fluxo simples

Usar quando a tarefa for:
- Correção de bug sem impacto em regras de negócio
- Ajuste de texto, label ou tradução
- Melhoria visual pontual (cor, espaçamento, ícone)
- Adição de campo simples em formulário existente
- Ajuste de máscara, validação ou formatação
- Refatoração interna sem mudança de comportamento visível

---

## Tabela de Decisão Rápida

| Situação | Fluxo |
|----------|-------|
| Feature nova com tela nova | Complexo |
| Novo módulo no backend | Complexo |
| Integração com serviço externo | Complexo |
| Dados financeiros ou clínicos envolvidos | Complexo |
| Novo perfil de usuário ou permissão | Complexo |
| Bug de comportamento | Simples |
| Ajuste de UI (sem lógica nova) | Simples |
| Tradução / texto | Simples |
| Campo novo em formulário existente | Simples |
| Máscara / formatação | Simples |
| Refatoração sem mudança de comportamento | Simples |

---

## Arquivos produzidos por fluxo

| Etapa | Arquivo gerado | Local |
|-------|---------------|-------|
| Product Owner (fluxo complexo) | `{feature}-doc.md` | `ai-engineering/projects/aesthera/features/` |
| Consolidador | `{feature}-spec-final.md` | `ai-engineering/projects/aesthera/features/` |
| Issue Writer | Issue no GitHub | GitHub |
| Implementador | Código | `aesthera/apps/api/` e `aesthera/apps/web/` |
