# Lithium — Plano de Implementação, Backlog & Roadmap

Este documento centraliza as dívidas técnicas, correções de bugs, oportunidades de melhoria de UX/UI, evoluções do Motor Cognitivo e propostas de novas funcionalidades e integrações para o **Lithium**.

> **Diretriz para Agentes de IA (`AGENTS.md`):**
> 1. Consulte este documento no início de qualquer nova tarefa para alinhar o trabalho ao roadmap oficial.
> 2. Ao implementar ou corrigir qualquer item aqui listado, marque a caixa correspondente (`[x]`), registre a data e o commit/resumo da mudança na tabela de histórico.
> 3. Ao identificar novos bugs, atritos de UX ou oportunidades durante auditorias e desenvolvimento, adicione-os na seção apropriada mantendo a convenção de IDs (`BUG-XX`, `UX-XX`, `COG-XX`, `FEAT-XX`).
> 4. Nunca remova regras de negócio consolidadas sem alinhamento prévio (cascata, D+1/D+7/D+21, vínculo prova↔leitura, fuso `America/Sao_Paulo`).

---

## 1. Bugs e Inconsistências Identificados

### Pendentes
- [ ] **`BUG-07` — Limite de 1.000 Registros sem Paginação no Histórico (`/history`)**
  - **Contexto:** `getAllReadingSessions()` no backend aplica `warnIfTruncated` quando o total de sessões atinge 1.000 linhas, exibindo um aviso estático na tela. Estudantes com uso diário intenso ao longo dos meses não conseguem carregar sessões antigas além desse limite.
  - **Ação:** Adicionar suporte a paginação paginada (cursor ou página com botão "Carregar mais sessões") na Server Action e na view.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/components/history/history-view.tsx`.

### Concluídos
- [x] **`BUG-06` — Falta de Toast com "Desfazer" ao Concluir Leitura na Biblioteca (`book-card.tsx`)**
  - *Resolução:* `handleMarkAsRead` em `book-card.tsx` passa a emitir `addToast` com `actionLabel: "Desfazer"` via helper `readingCompletedUndoToast`, espelhando o card da cascata.
- [x] **`BUG-01` — Conclusão de Leitura Destrutiva sem Toast de "Desfazer" no Dashboard**
  - *Resolução:* Implementado `addToast` com temporizador e ação `[Desfazer]` acionando `markReadingAsUnread(id)` em `reading-tier-card.tsx` e `tier1-card.tsx`.
- [x] **`BUG-02` — Projeção Incorreta em Leituras Concluídas (`/library/[id]`)**
  - *Resolução:* Atualizado `computeRemaining` em `src/lib/progress.ts` e `computeProjection` em `src/lib/projection.ts`: se `isRead === true`, zera horas restantes, dias restantes e fixa progresso em 100%.
- [x] **`BUG-03` — Impossibilidade de Excluir ou Estornar Sessões Incorretas no Histórico**
  - *Resolução:* Criada Server Action `deleteReadingSession` e `updateReadingSession` com recálculo atômico da velocidade média em `src/app/actions.ts`, acionadas por diálogos de confirmação (`ConfirmDialog`) em `history-view.tsx` e `reading-detail-view.tsx`.
- [x] **`BUG-04` — Tabela Extensa de 8 Colunas no Mobile (`/history`)**
  - *Resolução:* Adicionada uma lista de cards compactos para viewports abaixo de `sm`, mantendo a tabela completa a partir de `sm`, com os mesmos dados e ações de edição e exclusão em `src/components/history/history-view.tsx`.
- [x] **`BUG-05` — Desconexão entre as Duas Trilhas de Revisão Espaçada (Dashboard vs. Agenda)**
  - *Resolução:* Agenda agora agrega `scheduled_reviews` e `spaced_reviews`; o Tier 1 do Dashboard reúne revisões de leitura e revisões de marcos pendentes até hoje, com ação de conclusão apropriada para cada fluxo.

---

## 2. Pontos de Melhora no UX/UI (Flat Design & Usabilidade)

### Pendentes
- [ ] **`UX-03` — Alinhamento Ergonômico dos Botões de Dias da Semana (`/setup`)**
  - **Contexto:** Na inserção de disciplinas, os botões dos dias quebram em duas linhas desalinhadas ("Seg, Ter, Qua, Qui, Sex" e "Sáb" isolado abaixo).
  - **Ação:** Reorganizar para grade 6 colunas (`grid grid-cols-6 gap-1.5`) ou 3x2 consistente em qualquer resolução.
  - **Arquivos-chave:** `src/components/setup/subjects-table.tsx`.

- [ ] **`UX-07` — Alerta Sonoro / Feedback Sensorial no Término do Cronômetro**
  - **Contexto:** Ao esgotar o tempo do sprint de leitura (`remainingSprintSeconds === 0`), a barra emite apenas um toast e atualiza o título do documento. Se o estudante estiver focado no livro físico, não percebe o término.
  - **Ação:** Tocar um sinal sonoro sutil sintetizado via Web Audio API (senoide pura de curta duração, sem dependências de áudio externas ou arquivos pesados) quando o sprint zerar.
  - **Arquivos-chave:** `src/components/reading-timer-bar.tsx`.

- [ ] **`UX-08` — Alternador Manual de Tema Claro / Escuro**
  - **Contexto:** A aplicação responde à classe `.dark`, mas atualmente depende do tema do sistema operacional.
  - **Ação:** Incluir botão minimalista de alternância manual (Sol/Lua) no rodapé ou cabeçalho que armazene a preferência em `localStorage`.
  - **Arquivos-chave:** `src/components/navbar.tsx` ou `src/components/app-footer.tsx`.

### Concluídos
- [x] **`UX-02` — Eliminação Total de Alertas e Diálogos Nativos (`alert()` e `confirm()`)**
  - *Resolução:* Exclusões migradas para `ConfirmDialog`; erros de formulário/ações passam a `addToast` ou banner inline. Regressão em `no-native-dialogs.test.ts`.
- [x] **`UX-01` — Seletor de Leitura na "Sessão Rápida" (Dashboard)**
  - *Resolução:* Criado o componente `QuickSessionDialog` com agrupamento por tiers, ordenação por urgência, histórico da última sessão e recomendação diária.
- [x] **`UX-04` — Reposicionamento de Badges Flutuantes sobre as Capas (`/library`)**
  - *Resolução:* Badges de tipo e disciplina movidos para o corpo de conteúdo dos cards, preservando a visibilidade da capa do livro.
- [x] **`UX-05` — Espessura e Contraste das Barras de Progresso na Cascata**
  - *Resolução:* Barras de progresso ajustadas para `h-2` com fundo neutro contrastante em `reading-tier-card.tsx`.
- [x] **`UX-06` — Grid Responsivo na Biblioteca (`/library`)**
  - *Resolução:* Grid ajustado para `grid-cols-1 min-[480px]:grid-cols-2 ...`, prevenindo esmagamento em smartphones de 390px.

---

## 3. Evolução do Motor Cognitivo & Ciência da Aprendizagem

### Pendentes
- [ ] **`COG-01` — Orçamento Diário de Carga Cognitiva (Daily Cognitive Budget)**
  - **Conceito:** Baseado na Teoria da Carga Cognitiva (Sweller). O usuário define sua capacidade diária de foco sustentável (ex: 90 ou 120 minutos).
  - **Funcionalidade:** O motor soma as horas estimadas de Tier 1 (revisões ativas) + Tier 2 (entregas em zona de perigo). Se o tempo exigido ultrapassar o orçamento diário, exibe um alerta visual de *Sobrecarga Cognitiva* e sugere a meta de páginas recomendada para não exceder o limite cognitivo do dia.
  - **Arquivos-chave:** `src/lib/recommendation.ts`, `src/lib/projection.ts`, `src/components/dashboard/dashboard-view.tsx`.

- [ ] **`COG-03` — Níveis de Retenção nas Revisões Espaçadas (Fácil / Médio / Difícil)**
  - **Conceito:** Algoritmos de repetição espaçada (como SuperMemo / Anki) ajustam o intervalo baseado no esforço de recuperação.
  - **Funcionalidade:** Ao marcar uma revisão na Agenda (`/agenda`) ou no Tier 1, o usuário escolhe:
    - *Fácil:* Segue o fluxo padrão (D+1 -> D+7 -> D+21).
    - *Médio:* Mantém os prazos originais.
    - *Difícil:* O motor agenda automaticamente uma revisão de reforço intermediária em D+3.
  - **Banco:** Coluna `retention_level TEXT NULL` em `scheduled_reviews` e `spaced_reviews` (via migração).
  - **Arquivos-chave:** `src/components/agenda/agenda-review-dialog.tsx`, `src/app/actions.ts`.

- [ ] **`COG-04` — Previsão Preditiva de Término de Livros**
  - **Conceito:** Em vez de apenas estimar "faltam 8 horas", calcular com base no ritmo real e no tempo diário médio dedicado a data provável em que a leitura será concluída.
  - **Exemplo de UI:** `"No seu ritmo atual (28 p/h, 45 min/dia), término previsto para: 04 de Novembro (5 dias antes da Prova 1)"`.
  - **Arquivos-chave:** `src/lib/projection.ts`, `src/components/library/reading-detail-view.tsx`.

- [ ] **`COG-05` — Ponderação de Dificuldade por Disciplina (Peso Cognitivo)**
  - **Conceito:** Leituras densas (ex: artigos filosóficos ou manuais técnicos) têm velocidade intrínseca inferior a obras introdutórias.
  - **Funcionalidade:** Campo opcional de densidade/dificuldade no cadastro de disciplina (ex: *Densidade Alta / Média / Leve*) aplicando um fator multiplicador no ritmo de projeção.
  - **Arquivos-chave:** `src/types/database.ts`, `src/lib/speed.ts`, `src/lib/projection.ts`.

### Concluídos
- [x] **`COG-02` — Active Recall por Marco de Leitura (`milestone_summaries`)**
  - *Resolução:* Implementada a tabela `milestone_summaries` (v1.9) e `scheduled_reviews` (v1.10), disparando criação atômica de revisões D+1, D+7 e D+21 ao preencher o resumo de marco, com integração no Dashboard e na Agenda.
- [x] **`COG-RECOM` — Recomendação Diária Inteligente de Leitura**
  - *Resolução:* Implementado o algoritmo em `src/lib/recommendation.ts` que sugere a leitura ideal do dia com base em proximidade da prova, meta diária atingida e cota de páginas necessária.

---

## 4. Novas Funcionalidades e Integrações

### Pendentes
- [ ] **`FEAT-01` — Exportação e Backup Soberano em JSON**
  - **Conceito:** Garantir posse e portabilidade dos dados de estudo sem lock-in.
  - **Funcionalidade:** Rota ou botão em `/setup` para download de um arquivo JSON estruturado contendo todas as disciplinas, entregas, leituras, sessões e resumos, além de importador com validação de integridade.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/components/setup/setup-view.tsx`.

- [ ] **`FEAT-02` — Importador Bibliográfico Acadêmico (BibTeX / Zotero / RIS / DOI em Lote)**
  - **Conceito:** Estudantes universitários frequentemente recebem ementas ou possuem bibliotecas no Zotero/Mendeley.
  - **Funcionalidade:** Área de texto no Setup onde o estudante cola uma lista de DOIs, ISBNs ou código BibTeX; o backend enfileira as consultas na Crossref/Google Books e pré-cadastra os textos na disciplina selecionada.
  - **Arquivos-chave:** `src/lib/book-metadata.ts`, `src/components/setup/readings-table.tsx`.

- [ ] **`FEAT-03` — Heatmap Minimalista de Consistência (Últimos 28 Dias)**
  - **Conceito:** Visualização gráfica sóbria e plana (estilo GitHub commits, monocromático em Flat Design) no topo do `/history` ou Dashboard, mostrando dias com sessões realizadas.
  - **Benefício:** Reforço do hábito e visualização imediata da regularidade dos blocos de estudo.
  - **Arquivos-chave:** `src/components/history/history-view.tsx`.

- [ ] **`FEAT-04` — Modo Foco em Tela Cheia (Distraction-Free Focus)**
  - **Conceito:** Ao iniciar o cronômetro para uma leitura, opção de expandir para uma interface limpa com fundo escuro, mostrando apenas o título do texto, a meta de páginas da sessão, o relógio em fonte `Geist Mono` grande e os controles essenciais.
  - **Arquivos-chave:** `src/components/reading-timer-bar.tsx`, `src/components/reading-session-modal.tsx`.

### Concluídos
- [x] **`FEAT-AGENDA` — Calendário Mensal e Linha do Tempo (`/agenda`)**
  - *Resolução:* Implementado módulo com `react-day-picker` estilizado em Flat Design, agrupamento diário de eventos e revisão inline de marcos agendados.
- [x] **`FEAT-TIMER` — Cronômetro Global Flutuante com Sprints Baseados na Cota**
  - *Resolução:* Implementada a barra `ReadingTimerBar` com contagem regressiva/progressiva, persistência local e sincronização de término.
- [x] **`FEAT-AUTH` — Proteção por Senha para Deploy em Produção (Vercel)**
  - *Resolução:* Implementado proxy de rota e tela de login protegida por cookie assinado (`src/proxy.ts`, `src/app/login/`).

---

## 5. Histórico Consolidado de Entregas

| Data | ID | Descrição Resumida | Arquivos / Migração |
| :--- | :--- | :--- | :--- |
| 2026-10-23 | `BASE-01` | Modelagem inicial do Supabase (subjects, deliverables, readings, sessions, spaced_reviews) | `migration-v1.0.sql` a `v1.2.sql` |
| 2026-10-24 | `DATES-01` | Utilitários de fuso horário fixo `America/Sao_Paulo` e motor de datas puras | `src/lib/dates.ts` |
| 2026-10-25 | `FLAT-01` | Refatoração global para Flat Design estrito e remoção de sombras residuais | `src/components/` |
| 2026-10-25 | `REFACTOR-01` | Eliminação de props congeladas (`useState(prop)`) em componentes clientes | `src/components/` |
| 2026-10-25 | `TEST-01` | Cobertura de testes unitários para 100% dos utilitários de `src/lib/` | `src/lib/*.test.ts` |
| 2026-10-26 | `TOAST-01` | Sistema global de Toasts com ação "Desfazer" na conclusão de leituras e revisões | `src/lib/toast-store.ts`, `src/components/toaster.tsx` |
| 2026-10-27 | `AUTH-01` | Autenticação simples por senha para implantação em produção / Vercel | `src/proxy.ts`, `src/app/login/` |
| 2026-10-27 | `RECALL-01` | Resumos de Active Recall por marco de leitura e disparos de revisão | `migration-v1.9.sql`, `milestone-summary.ts` |
| 2026-10-27 | `AGENDA-01` | Módulo de Agenda (`/agenda`) com visão mensal e conclusão transacional de revisões | `src/app/agenda/`, `migration-v1.10.sql` |
| 2026-10-27 | `TIMER-01` | Barra global de cronômetro com duração dinâmica baseada na cota | `src/components/reading-timer-bar.tsx` |
| 2026-10-27 | `SESSION-01` | CRUD completo de sessões no histórico e detalhe com recálculo em cascata | `src/app/actions.ts`, `history-view.tsx` |
| 2026-10-27 | `DOC-01` | Criação e auditoria profunda do backlog vivo `plano-de-implementacao.md` | `plano-de-implementacao.md`, `AGENTS.md` |
| 2026-10-27 | `BUG-04` | Cards compactos no histórico mobile; tabela preservada em telas maiores | `src/components/history/history-view.tsx`, `history-view.test.ts` |
| 2026-10-27 | `BUG-05` | Agenda e Tier 1 unificados para revisões de leituras e de marcos | `src/app/actions.ts`, `agenda.ts`, componentes de Agenda e Dashboard |
| 2026-10-28 | `BUG-06` | Toast com Desfazer ao concluir leitura na Biblioteca | `book-card.tsx`, `reading-completion-toast.ts` |
| 2026-10-28 | `UX-02` | Remoção de `alert()`/`confirm()` nativos no setup e dashboard | tabelas setup, cards dashboard, `no-native-dialogs.test.ts` |
