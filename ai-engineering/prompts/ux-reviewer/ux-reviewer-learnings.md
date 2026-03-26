# UX Reviewer Learnings — Aesthera

> Este arquivo é mantido automaticamente pelo `treinador-agent`.
> Cada item representa um padrão confirmado por revisões reais de UX no Aesthera.
> **Leia este arquivo antes de qualquer revisão Aesthera** e use cada item como filtro ativo durante a inspeção.

---

## Como usar

Antes de concluir qualquer revisão de tela, componente ou PR do Aesthera, percorra cada item abaixo e verifique:
`"Esse padrão foi respeitado no que estou revisando?"`

Se não → sinalize como quebra de padrão no relatório de UX.

---

## Componentes e Padrões Visuais

### Estados Vazios (Empty States)

- [ ] **CTA em empty state nunca deve ser `<button>` nativo estilizado com underline — usar sempre `<Button variant="outline">` dentro do container padronizado**
  - 🔴 Anti-padrão: `<button className="text-primary underline">Adicionar primeiro item</button>` ou `<a>` estilizado como link — rompe consistência visual, não segue o design system e viola `ui-standards.md` seção 2.3
  - ✅ Correto: container e botão seguindo o padrão estabelecido em todas as telas do sistema (Serviços, Profissionais, Equipamentos, Salas, Promoções):
    ```tsx
    <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
      <p className="text-sm">Nenhum registro encontrado.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
        Adicionar primeiro registro
      </Button>
    </div>
    ```
  - 📌 Padrão confirmado em: `ui-standards.md` seção 2.3 + telas de Serviços, Profissionais, Equipamentos, Salas e Promoções
  - 📅 Registrado em: 25/03/2026 — revisão de uploads e medidas corporais (PR #121)

---

## Modais e Overlays

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Formulários

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Listagens e Tabelas

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Textos e Idioma (PT-BR)

<!-- Itens serão adicionados automaticamente após revisões -->

---

## Histórico de Atualizações

| Data | Itens adicionados |
|------|-------------------|
| 25/03/2026 | Arquivo criado pelo treinador-agent. 1 padrão registrado: empty state CTA com `<Button variant="outline">` dentro de container padronizado |
