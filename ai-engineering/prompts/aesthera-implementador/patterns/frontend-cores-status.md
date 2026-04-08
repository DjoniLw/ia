# Padrões — Frontend: Cores, Status e Design System

> Carregue este arquivo quando for implementar: badges de status, constantes de cor, mapeamentos de label PT-BR, dark mode, ou qualquer elemento que use a cor primária da marca.

---

- [ ] **🔁 REINCIDÊNCIA — STATUS_LABEL/STATUS_COLOR definidos localmente são BLOQUEANTES — inclusive dentro de callbacks `.map()`**
  - 🔴 Anti-padrão: definir mapeamentos de label ou cor localmente no arquivo, **independentemente de onde**:
    ```tsx
    // ERRADO — no topo do arquivo
    const STATUS_COLOR = { scheduled: 'bg-blue-100 text-blue-700', ... };
    // MAIS INSIDIOSO — dentro de .map()
    items.map(item => {
      const color = item.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'; // local!
    })
    ```
  - ✅ Correto: importar SEMPRE de `lib/status-colors.ts`:
    ```tsx
    import { STATUS_LABEL, STATUS_COLOR } from '@/lib/status-colors';
    items.map(item => <Badge className={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Badge>)
    ```
  - 📌 Sinal de alerta: qualquer `const *LABEL*` ou `const *COLOR*` fora de `lib/status-colors.ts` em arquivo `.tsx` = BLOQUEANTE.
  - 📅 08/04/2026 (base: 24/03/2026)

---

- [ ] **Cores de brand/design system usam tokens CSS — nunca `bg-violet-*` ou `bg-purple-*` hardcoded (BLOQUEANTE)**
  - 🔴 Anti-padrão: `<Button className="bg-violet-600 hover:bg-violet-700 text-white">` — quando a cor da marca mudar, precisa trocar em dezenas de arquivos.
  - ✅ Correto: tokens do design system:
    ```tsx
    <Button>Salvar</Button>               // bg-primary via variant default
    <span className="bg-primary/10 text-primary">Tag ativa</span>
    ```
  - 📌 Tokens disponíveis: `bg-primary`, `text-primary`, `border-primary`, `bg-primary/10`, `bg-primary/20`, `text-primary-foreground`.
  - 📌 `bg-violet-*` para cores temáticas de CONTEÚDO (ex.: categoria de serviço) é aceitável — apenas a cor da marca da clínica usa `primary`.
  - 📅 08/04/2026

---

- [ ] **`dark:bg-{color}-900/30` é insuficiente — mínimo é `/40`, crítico usa `/50`**
  - 🔴 Anti-padrão: `/30` de opacidade em fundos de badge no dark mode — quase idêntico ao fundo da célula, impossível distinguir estados.
  - ✅ Correto: `/40` como mínimo; `/50` para status críticos (vencido, bloqueado, cancelado).
  - 📌 Teste: se o badge quase desaparece no fundo da linha em dark mode, a opacidade está baixa demais.
  - 📅 30/03/2026

---

- [ ] **Badge de status deve ser exibido para TODOS os estados — nunca omitir o estado positivo**
  - 🔴 Anti-padrão: exibir badge apenas para "Inativo" — usuário precisa inferir por ausência que o item está ativo.
  - ✅ Correto: badge sempre presente para todos os estados com cores distintas:
    ```tsx
    <Badge className={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Badge>
    ```
  - 📌 Teste de scanning: cada item da lista deve comunicar seu estado sem depender de leitura ou inferência por ausência.
  - 📅 30/03/2026

---

- [ ] **Mesmo conceito = mesma cor em todas as telas — única fonte de verdade: `lib/status-colors.ts`**
  - 🔴 Anti-padrão: "Inativo" com `bg-zinc-100 text-zinc-600` em uma tela e `bg-muted text-muted-foreground` em outra.
  - ✅ Correto: importar sempre de `lib/status-colors.ts` — a constante centralizada garante aparência idêntica em todas as telas.
  - 📌 Ao revisar qualquer tela com badges, conferir se as cores batem com as demais telas do sistema.
  - 📅 30/03/2026

---

- [ ] **Enum com múltiplos valores deve ter cor semanticamente distinta por valor — nunca todos iguais**
  - 🔴 Anti-padrão: todos os métodos de pagamento mapeados para a mesma cor azul — badge não agrega valor informacional.
  - ✅ Correto: cor distinta por valor com semântica (PIX → verde, dinheiro → esmeralda, cartão crédito → roxo, débito → azul), com dark mode:
    ```tsx
    pix: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    cash: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ```
  - 📌 Teste rápido: cobrir o texto dos badges — ainda dá para distinguir os tipos pela cor?
  - 📅 30/03/2026

---

- [ ] **Labels PT-BR de enums NUNCA são os valores raw — sempre mapeamento centralizado**
  - 🔴 Anti-padrão: `<Badge>{billing.sourceType}</Badge>` → exibe `"APPOINTMENT"`, `"PRESALE"`, `"MANUAL"` para o usuário.
  - ✅ Correto: arquivo de labels centralizado:
    ```tsx
    // lib/billing-labels.ts
    export const BILLING_SOURCE_LABELS: Record<BillingSourceType, string> = {
      APPOINTMENT: 'Agendamento',
      PRESALE: 'Pré-venda',
      MANUAL: 'Manual',
    };
    // No componente:
    <Badge>{BILLING_SOURCE_LABELS[billing.sourceType]}</Badge>
    ```
  - 📌 Verificação obrigatória: ao criar/alterar qualquer enum, verificar se existe arquivo de labels frontend correspondente. Se não existir, criar antes dos componentes.
  - 📅 02/04/2026

---

- [ ] **Texto branco sobre fundos amber/orange intermediários reprova WCAG — contraste < 4.5:1**
  - 🔴 Anti-padrão: `text-white` sobre `bg-amber-500` ou `bg-orange-400` — contraste ~2.3:1.
  - ✅ Correto: `text-amber-900` / `text-orange-900`; ou fundo escurecido (`bg-amber-700`) para suportar texto branco.
  - 📌 Arquivo canônico de constantes de cor: `aesthera/apps/web/lib/status-colors.ts`.
  - 📅 24/03/2026

---

- [ ] **Ao adicionar dark mode em constantes de cor, verificar TODAS as outras constantes de cor do mesmo arquivo**
  - 🔴 Anti-padrão: adicionar dark mode em `STATUS_COLOR` e considerar concluído sem perceber que `TYPE_COLOR` e `CONTRACT_STATUS_CLASS` no mesmo arquivo também precisam.
  - ✅ Correto: ao iniciar task de dark mode, mapear todos os objetos de mapeamento de cor no arquivo (`const *COLOR*`, `const *CLASS*`, `const *STYLE*`) e tratar todos na mesma task.
  - 📌 Constantes de cor são "irmãs" dentro de uma página — quando uma recebe dark mode, todas devem receber.
  - 📅 30/03/2026
