# Lithium — Plano de Implementação, Backlog & Roadmap

Este documento centraliza as dívidas técnicas, correções de bugs, oportunidades de melhoria de UX/UI, evoluções do Motor Cognitivo e propostas de novas funcionalidades e integrações para o **Lithium**.

> **Diretriz para Agentes de IA (`AGENTS.md`):**
> 1. Consulte este documento no início de qualquer nova tarefa para alinhar o trabalho ao roadmap oficial.
> 2. Ao implementar ou corrigir qualquer item aqui listado, marque a caixa correspondente (`[x]`), registre a data e o commit/resumo da mudança na tabela de histórico.
> 3. Ao identificar novos bugs, atritos de UX ou oportunidades durante auditorias e desenvolvimento, adicione-os na seção apropriada mantendo a convenção de IDs (`BUG-XX`, `UX-XX`, `COG-XX`, `FEAT-XX`).
> 4. Nunca remova regras de negócio consolidadas sem alinhamento prévio (cascata, D+1/D+7/D+21, vínculo prova↔leitura, fuso `America/Sao_Paulo`).
> 5. Respeite as propostas listadas na Seção 5 como **Rejeitadas da Forma Atual**: não tente reintroduzi-las sem aprovação expressa do usuário.

---

## 1. Bugs e Inconsistências Identificados

### Pendentes
- [ ] **`BUG-07` — Limite de 1.000 Registros sem Paginação no Histórico (`/history`)**
  - **Contexto:** `getAllReadingSessions()` no backend aplica `warnIfTruncated` quando o total de sessões atinge 1.000 linhas, exibindo um aviso estático na tela. Estudantes com uso diário intenso ao longo dos meses não conseguem carregar sessões antigas além desse limite.
  - **Ação:** Adicionar suporte a paginação paginada (cursor ou página com botão "Carregar mais sessões") na Server Action e na view.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/components/history/history-view.tsx`.

- [ ] **`BUG-08` — Incompatibilidade entre Páginas Relativas (Trecho) e Absolutas (Livro) no Modal de Sessão e Marcos**
  - **Contexto:** Quando uma leitura é cadastrada como trecho (`read_full_book = false`, ex: 30 páginas selecionadas de um livro com numeração original 150 a 180), o modal de sessão exige que o usuário digite a página onde parou (`endPage`), validando contra `target_pages`. Se o usuário digitar "165", a validação bloqueia ("A página final não pode passar da última página (30)"). Além disso, marcos (`milestones`) extraídos do sumário usam numeração absoluta do livro, enquanto `pages_read` conta o delta a partir de zero.
  - **Ação:** Adicionar suporte explícito a dois modos de input no registro da sessão:
    1. *Por quantidade de páginas lidas (delta direto)*: ex: "Li 15 páginas".
    2. *Pela página onde parou*: considerando a página inicial do trecho quando informada.
  - **Arquivos-chave:** `src/components/reading-session-modal.tsx`, `src/lib/session-pages.ts`, `src/lib/toc-parser.ts`, `src/types/database.ts`.

### Concluídos
- [x] **`BUG-01` — Conclusão de Leitura Destrutiva sem Toast de "Desfazer" no Dashboard**
  - *Resolução:* Implementado `addToast` com temporizador e ação `[Desfazer]` acionando `markReadingAsUnread(id)` em `reading-tier-card.tsx` e `tier1-card.tsx`.
- [x] **`BUG-02` — Projeção Incorreta em Leituras Concluídas (`/library/[id]`)**
  - *Resolução:* Atualizado `computeRemaining` em `src/lib/progress.ts` e `computeProjection` em `src/lib/projection.ts`: se `isRead === true`, zera horas restantes, dias restantes e fixa progresso em 100%.
- [x] **`BUG-03` — Impossibilidade de Excluir ou Estornar Sessões Incorretas no Histórico**
  - *Resolução:* Criada Server Action `deleteReadingSession` e `updateReadingSession` com recálculo atômico da velocidade média em `src/app/actions.ts`, acionadas por diálogos de confirmação (`ConfirmDialog`) em `history-view.tsx` e `reading-detail-view.tsx`.
- [x] **`BUG-04` — Tabela Extensa de 8 Colunas no Mobile (`/history`)**
  - *Resolução:* Adicionada lista de cards compactos para viewports abaixo de `sm`, mantendo a tabela completa a partir de `sm`, com os mesmos dados e ações de edição e exclusão em `src/components/history/history-view.tsx`.
- [x] **`BUG-05` — Desconexão entre as Duas Trilhas de Revisão Espaçada (Dashboard vs. Agenda)**
  - *Resolução:* Agenda agora agrega `scheduled_reviews` e `spaced_reviews`; o Tier 1 do Dashboard reúne revisões de leitura e de marcos pendentes até hoje, com ação de conclusão apropriada para cada fluxo.
- [x] **`BUG-06` — Falta de Toast com "Desfazer" ao Concluir Leitura na Biblioteca (`book-card.tsx`)**
  - *Resolução:* `handleMarkAsRead` em `book-card.tsx` passa a emitir `addToast` com `actionLabel: "Desfazer"` via helper `readingCompletedUndoToast`, espelhando o card da cascata.
- [x] **`BUG-09` — Disparo Incorreto do Resumo de Marco (Active Recall Solicita o Próximo Marco em Vez do Recém-Concluído)**
  - *Resolução:* `getCrossedMilestones` agora associa cada transição ao marco anterior e inclui o último marco quando `nextPage` alcança `target_pages`; `createReadingSession` consulta a meta para aplicar essa regra.

---

## 2. Pontos de Melhora no UX/UI (Flat Design & Usabilidade)

### Pendentes
- [ ] **`UX-03` — Alinhamento Ergonômico dos Botões de Dias da Semana (`/setup`)**
  - **Contexto:** Na inserção de disciplinas, os botões dos dias quebram em duas linhas desalinhadas ("Seg, Ter, Qua, Qui, Sex" e "Sáb" isolado abaixo).
  - **Ação:** Reorganizar para grade de 6 colunas (`grid grid-cols-6 gap-1.5`) consistente em qualquer resolução.
  - **Arquivos-chave:** `src/components/setup/subjects-table.tsx`.

- [ ] **`UX-07` — Alerta Sonoro / Feedback Sensorial no Término do Cronômetro**
  - **Contexto:** Ao esgotar o tempo do sprint de leitura (`remainingSprintSeconds === 0`), a barra emite apenas um toast e atualiza o título do documento. Se o estudante estiver focado no livro físico, não percebe o término.
  - **Ação:** Tocar um sinal sonoro sutil sintetizado via Web Audio API (senoide pura de curta duração, sem dependências de áudio externas ou arquivos pesados) quando o sprint zerar.
  - **Arquivos-chave:** `src/components/reading-timer-bar.tsx`.

- [ ] **`UX-09` — Notificação Graciosa de Sessão Expirada no Fluxo de Ações**
  - **Contexto:** Quando o token de autenticação do Supabase expira durante o uso contínuo, algumas Server Actions que exigem usuário autenticado lançam exceção genérica ("Authentication required") em vez de emitir aviso explicativo ao usuário.
  - **Ação:** Capturar erro de autenticação e emitir toast com aviso claro ("Sua sessão expirou. Redirecionando para login...") preservando a rota de retorno segura.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/lib/auth-redirect.ts`.

- [ ] **`UX-10` — Remoção do Scroll Interno no Painel de Heatmap de Consistência**
  - **Contexto:** O card `ConsistencyHeatmap` em `src/components/consistency-heatmap.tsx` possui a classe `overflow-x-auto` no container do grid das semanas (`<div className="flex gap-2 overflow-x-auto">`). Como a janela fixa é de 28 dias (~4 a 5 colunas de 7 dias com largura total inferior a 100px), essa barra de rolagem horizontal interna é supérflua e surge involuntariamente em alguns navegadores e tamanhos de viewport, quebrando o visual limpo do Flat Design estrito.
  - **Ação:** Remover a classe de rolagem horizontal desnecessária (`overflow-x-auto`), e vertical, e assegurar que a grade, rótulos e legenda se ajustem fluidamente dentro do card sem barras de rolagem internas no Dashboard e na tela de Histórico.
  - **Arquivos-chave:** `src/components/consistency-heatmap.tsx`, `src/components/dashboard/dashboard-view.tsx`, `src/components/history/history-view.tsx`.

- [ ] **`UX-11` — Refinamento do Card de Recomendação Diária no Dashboard**
  - **Contexto:** O card `RecommendationCard` em `src/components/dashboard/recommendation-card.tsx` (~120 linhas) exibe a leitura sugerida pelo algoritmo de `src/lib/recommendation.ts` (`getSuggestedReading`). O algoritmo funciona bem (pontuação por proximidade de prova, inatividade e cota), mas o card apresenta limitações de UX: (1) o estado vazio aponta o usuário para `/setup` (L49: "adicione textos na aba Setup") quando o cadastro de leituras será migrado para `/library` (cf. `UX-12`); (2) exibe uma única sugestão sem alternativa visível — o estudante não tem contexto sobre *por que* aquela leitura foi escolhida nem pode trocar rapidamente sem ir à biblioteca; (3) não mostra a posição da leitura em relação ao prazo (dias restantes, proximidade da prova vinculada).
  - **Ação:**
    1. Atualizar o link do estado vazio para `/library` (alinhado com `UX-12`).
    2. Adicionar indicador contextual de urgência (ex: "5 dias até a Prova 1 · 38 pág. restantes") derivado dos dados já disponíveis em `getDashboardData`.
    3. Avaliar a inclusão de uma ação secundária "Trocar sugestão" que exiba a segunda melhor opção do ranking sem recarregar a página.
  - **Arquivos-chave:** `src/components/dashboard/recommendation-card.tsx`, `src/components/dashboard/dashboard-view.tsx`, `src/lib/recommendation.ts`.

- [ ] **`UX-12` — Reestruturação da Navegação: Leituras na Biblioteca, Entregas na Agenda, Setup Vira Disciplinas**
  - **Contexto:** Hoje o Setup (`/setup`) concentra 3 abas independentes: *Leituras* (`readings-table.tsx`, ~600 linhas), *Entregas* (`deliverables-table.tsx`) e *Disciplinas* (`subjects-table.tsx`). O formulário de criação de leituras já foi extraído e integrado à Biblioteca em `UX-14`, mas a listagem e edição continuam no Setup; Entregas também continuam fora da Agenda. A proposta conclui a reorganização:
    - **Leituras → Biblioteca:** Formulário de criação já integrado; mover listagem e gerenciamento das leituras para a própria `/library`, onde o estudante visualiza e atualiza seus livros.
    - **Entregas → Agenda:** Entregas/provas são eventos com data fixa e pertencem ao contexto de calendário (`/agenda`), já existente.
    - **Setup → Disciplinas:** A aba `/setup` passa a conter apenas o CRUD de disciplinas, simplificando a navegação e o propósito da rota.
  - **Ação (faseada):**
    1. **Concluído em `UX-14`:** Extrair o formulário de criação de leitura para `src/components/library/reading-form.tsx`, com estado gerenciado por `useReducer`.
    2. **Concluído em `UX-14`:** Integrar o componente na `LibraryView` em seção recolhível com botão "Adicionar leitura".
    3. Mover `DeliverablesTable` para `src/components/agenda/` e renderizá-la como seção na rota `/agenda`.
    4. Renomear/simplificar `/setup` para conter exclusivamente `SubjectsTable`, removendo o wrapper `Tabs`.
    5. Atualizar todos os links e textos que referenciam "Setup" para o novo destino (library-view.tsx L187, recommendation-card.tsx L49, setup-view.tsx).
    6. Revalidar caminhos em Server Actions (`revalidatePath`).
  - **Progresso:** Formulário reutilizável e botão “Adicionar leitura” integrado à Biblioteca em `UX-14`; mover Entregas para a Agenda e simplificar o restante do Setup continuam pendentes.
  - **Arquivos-chave:** `src/components/setup/readings-table.tsx`, `src/components/library/library-view.tsx`, `src/components/setup/deliverables-table.tsx`, `src/components/setup/setup-view.tsx`, `src/components/agenda/`, `src/app/setup/page.tsx`, `src/app/library/page.tsx`, `src/app/agenda/page.tsx`, `src/components/dashboard/recommendation-card.tsx`.
  - **Dependências:** A extração e a integração do formulário estão concluídas em `UX-14`; as demais mudanças de navegação continuam pendentes, alinhadas com `UX-11`.

- [ ] **`UX-13` — Formatação Automática de Títulos e Autores em Title Case**
  - **Contexto:** Não existe nenhuma transformação de casing no fluxo de criação de leituras. O campo `title` e `author` são armazenados exatamente como digitados pelo usuário ou retornados pela API (ISBN via Google Books / DOI via CrossRef). Isso produz inconsistências visuais frequentes: Google Books pode retornar títulos em CAIXA ALTA; CrossRef retorna autores em "SOBRENOME, Nome"; e o próprio usuário pode digitar em minúsculas corridas. Na Biblioteca e no Dashboard, leituras com casing inconsistente quebram a harmonia visual do Flat Design.
  - **Ação:**
    1. Criar função utilitária `toTitleCaseBR(text: string): string` em `src/lib/text.ts` que aplique Title Case com tratamento para preposições, artigos e conjunções em pt-BR (de, da, do, das, dos, e, ou, para, em, com, a, o, as, os, à, às, ao, aos, na, no, nas, nos, num, numa, uns, umas, por, pelo, pela — mantidos em minúscula exceto quando iniciais).
    2. Aplicar a transformação no `handleCreate` do formulário de leituras (atualmente em `readings-table.tsx` L260–265; futuro `reading-form.tsx` pós-`UX-12`) como sugestão visual com preview — não impositiva, permitindo override manual.
    3. Aplicar igualmente nos callbacks de auto-fill por ISBN/DOI (`handleIsbnBlur`, `handleDoiBlur`) para normalizar dados de APIs externas.
    4. Cobrir com testes unitários em `src/lib/text.test.ts`: palavras simples, preposições internas, siglas (ISBN, DOI), nomes próprios compostos, strings já corretas.
  - **Arquivos-chave:** `src/lib/text.ts` (novo), `src/lib/text.test.ts` (novo), `src/components/setup/readings-table.tsx` (ou futuro `reading-form.tsx`).

### Concluídos
- [x] **`UX-01` — Seletor de Leitura na "Sessão Rápida" (Dashboard)**
  - *Resolução:* Criado o componente `QuickSessionDialog` com agrupamento por tiers, ordenação por urgência, histórico da última sessão e recomendação diária.
- [x] **`UX-02` — Eliminação Total de Alertas e Diálogos Nativos (`alert()` e `confirm()`)**
  - *Resolução:* Exclusões migradas para `ConfirmDialog`; erros de formulário/ações passam a `addToast` ou banner inline. Teste de regressão garantido em `no-native-dialogs.test.ts`.
- [x] **`UX-04` — Reposicionamento de Badges Flutuantes sobre as Capas (`/library`)**
  - *Resolução:* Badges de tipo e disciplina movidos para o corpo de conteúdo dos cards, preservando a visibilidade da capa do livro.
- [x] **`UX-05` — Espessura e Contraste das Barras de Progresso na Cascata**
  - *Resolução:* Barras de progresso ajustadas para `h-2` com fundo neutro contrastante em `reading-tier-card.tsx`.
- [x] **`UX-06` — Grid Responsivo na Biblioteca (`/library`)**
  - *Resolução:* Grid ajustado para `grid-cols-1 min-[480px]:grid-cols-2 ...`, prevenindo esmagamento em smartphones de 390px.
- [x] **`UX-14` — Refatoração e Melhoria do Formulário de Adição de Leituras**
  - *Resolução:* Extraído para `ReadingForm` com estado em `useReducer`, fluxo guiado em três etapas e uma quarta etapa opcional para sumário colado; inclui validação inline e no servidor, busca bibliográfica preservada e layout responsivo. Integrado à Biblioteca em seção recolhível; no Setup, a ação de cadastro aponta para a Biblioteca.

---

## 3. Evolução do Motor Cognitivo & Ciência da Aprendizagem

### Pendentes
- [ ] **`COG-04` — Previsão Preditiva de Término de Livros**
  - **Conceito:** Em vez de apenas estimar "faltam 8 horas", calcular com base no ritmo real e no tempo diário médio dedicado a data provável em que a leitura será concluída.
  - **Exemplo de UI:** `"No seu ritmo atual (28 p/h, 45 min/dia), término previsto para: 04 de Novembro (5 dias antes da Prova 1)"`.
  - **Arquivos-chave:** `src/lib/projection.ts`, `src/components/library/reading-detail-view.tsx`.

- [ ] **`COG-05` — Ponderação de Dificuldade por Disciplina (Peso Cognitivo)**
  - **Conceito:** Leituras densas (ex: artigos filosóficos ou manuais técnicos) têm velocidade intrínseca inferior a obras introdutórias.
  - **Funcionalidade:** Campo opcional de densidade/dificuldade no cadastro de disciplina (ex: *Densidade Alta / Média / Leve*) aplicando um fator multiplicador no ritmo de projeção.
  - **Arquivos-chave:** `src/types/database.ts`, `src/lib/speed.ts`, `src/lib/projection.ts`.

- [ ] **`COG-06` — Suavização de Velocidade Calibrada nas Primeiras Sessões**
  - **Conceito:** Uma primeira sessão atípica (ex: 5 páginas em 10 minutos = 30 p/h ou 2 páginas em 20 min = 6 p/h) pode distorcer drasticamente o ritmo de uma leitura inteira.
  - **Funcionalidade:** Aplicar média ponderada amortecida entre a velocidade de referência da disciplina e as primeiras medições até que se acumulem ao menos 45 minutos de leitura.
  - **Arquivos-chave:** `src/lib/speed.ts`, `src/app/actions.ts` (`recalculateReadingSpeed`).

### Concluídos
- [x] **`COG-01` — Orçamento Diário de Carga Cognitiva (Daily Cognitive Budget)**
  - *Resolução:* Meta diária (`daily_goal_minutes`) passa a atuar como orçamento cognitivo. `computeCognitiveBudget` soma Tier 1 (15 min/revisão) + cotas Tier 2; o Dashboard exibe alerta de *Sobrecarga cognitiva* e `calculateBudgetAwareSuggestedPages` limita a meta recomendada.
- [x] **`COG-02` — Active Recall por Marco de Leitura (`milestone_summaries`)**
  - *Resolução:* Implementada a tabela `milestone_summaries` (v1.9) e `scheduled_reviews` (v1.10), disparando criação atômica de revisões D+1, D+7 e D+21 ao preencher o resumo de marco, com integração no Dashboard e na Agenda.
- [x] **`COG-RECOM` — Recomendação Diária Inteligente de Leitura**
  - *Resolução:* Implementado o algoritmo em `src/lib/recommendation.ts` que sugere a leitura ideal do dia com base em proximidade da prova, meta diária atingida e cota de páginas necessária.

---

## 4. Novas Funcionalidades e Integrações

### Pendentes
- [ ] **`FEAT-04` — Modo Foco em Tela Cheia (Distraction-Free Focus)**
  - **Conceito:** Ao iniciar o cronômetro para uma leitura, opção de expandir para uma interface limpa com fundo escuro, mostrando apenas o título do texto, a meta de páginas da sessão, o relógio em fonte `Geist Mono` grande e os controles essenciais.
  - **Arquivos-chave:** `src/components/reading-timer-bar.tsx`, `src/components/reading-session-modal.tsx`.

- [ ] **`FEAT-05` — Visualização de Sequência de Dias (Streak de Estudos)**
  - **Conceito:** Complemento motivacional ao heatmap de 28 dias (`FEAT-03`), exibindo a contagem de dias consecutivos com sessões registradas no fuso `America/Sao_Paulo`.
  - **Arquivos-chave:** `src/lib/consistency-heatmap.ts`, `src/components/consistency-heatmap.tsx`.

- [ ] **`FEAT-06` — Painel Resumo Semanal no Dashboard**
  - **Conceito:** Visão compacta da semana corrente (segunda a domingo) no Dashboard, mostrando provas/entregas da semana e o total de horas lidas vs. carga prevista.
  - **Arquivos-chave:** `src/components/dashboard/dashboard-view.tsx`, `src/lib/agenda.ts`.

### Concluídos
- [x] **`FEAT-03` — Heatmap Minimalista de Consistência (Últimos 28 Dias)**
  - *Resolução:* Grade monocromática Flat (estilo commits) via `consistency-heatmap.ts` + `ConsistencyHeatmap`, no topo do Dashboard e do Histórico; intensidade por minutos de sessão (níveis 0–4).
- [x] **`FEAT-AGENDA` — Calendário Mensal e Linha do Tempo (`/agenda`)**
  - *Resolução:* Implementado módulo com `react-day-picker` estilizado em Flat Design, agrupamento diário de eventos e revisão inline de marcos agendados.
- [x] **`FEAT-TIMER` — Cronômetro Global Flutuante com Sprints Baseados na Cota**
  - *Resolução:* Implementada a barra `ReadingTimerBar` com contagem regressiva/progressiva, persistência local e sincronização de término.
- [x] **`FEAT-AUTH` — Proteção por Autenticação Supabase para Deploy em Produção (Vercel)**
  - *Resolução:* Implementado proxy de rota e tela de login protegida por cookie de sessão Supabase (`src/proxy.ts`, `src/app/login/`).

---

## 5. Propostas Rejeitadas da Forma Atual (Decisão de Produto)

As propostas abaixo foram analisadas e **rejeitadas da forma em que foram formuladas**, em consonância com os princípios de utilitarismo pessoal, baixa fricção e Flat Design estrito do Lithium:

- ❌ **`UX-08` — Alternador Manual de Tema Claro / Escuro**
  - **Motivo da Rejeição:** A aplicação utiliza tokens Flat Design calibrados e respeita automaticamente o tema do sistema operacional via media query `@custom-variant dark`. Um alternador manual em tela adiciona poluição visual e complexidade desnecessária para uma ferramenta de uso pessoal.

- ❌ **`COG-03` — Níveis de Retenção nas Revisões Espaçadas (Fácil / Médio / Difícil estilo Anki)**
  - **Motivo da Rejeição:** Foge da filosofia utilitária e de baixo atrito do Lithium. O ciclo de repetição espaçada D+1, D+7, D+21 deve permanecer simples, objetivo e determinístico. Forçar o estudante a classificar esforço cognitivo subjetivo gera fadiga de decisão e desvia o foco do estudo real.

- ❌ **`FEAT-01` — Exportação e Backup Soberano em JSON na Aplicação**
  - **Motivo da Rejeição:** O Lithium é sustentado pelo Supabase PostgreSQL. A gestão de integridade, dumps SQL (`pg_dump`) e backups é responsabilidade direta do banco e do painel do Supabase. Implementar pipeline de exportação/importação JSON bidirecional no cliente traz risco de corrupção de chaves estrangeiras e complexidade desnecessária.

- ❌ **`FEAT-02` — Importador Bibliográfico Acadêmico (BibTeX / Zotero / RIS / DOI em Lote)**
  - **Motivo da Rejeição:** A consulta automatizada individual por ISBN (Google Books / BrasilAPI) e DOI (Crossref), somada ao parser de sumários por texto puro (`parseRawTocToMilestones`), já cobre as necessidades de cadastro com alta fidelidade sem introduzir dependências pesadas de parsing bibliográfico.

---

## 6. Histórico Consolidado de Entregas

| Data | ID | Descrição Resumida | Arquivos / Migração |
| :--- | :--- | :--- | :--- |
| 2026-10-23 | `BASE-01` | Modelagem inicial do Supabase (subjects, deliverables, readings, sessions, spaced_reviews) | `migration-v1.0.sql` a `v1.2.sql` |
| 2026-10-24 | `DATES-01` | Utilitários de fuso horário fixo `America/Sao_Paulo` e motor de datas puras | `src/lib/dates.ts` |
| 2026-10-25 | `FLAT-01` | Refatoração global para Flat Design estrito e remoção de sombras residuais | `src/components/` |
| 2026-10-25 | `REFACTOR-01` | Eliminação de props congeladas (`useState(prop)`) em componentes clientes | `src/components/` |
| 2026-10-25 | `TEST-01` | Cobertura de testes unitários para 100% dos utilitários de `src/lib/` | `src/lib/*.test.ts` |
| 2026-10-26 | `TOAST-01` | Sistema global de Toasts com ação "Desfazer" na conclusão de leituras e revisões | `src/lib/toast-store.ts`, `src/components/toaster.tsx` |
| 2026-10-27 | `AUTH-01` | Autenticação por Supabase Auth para implantação em produção / Vercel | `src/proxy.ts`, `src/app/login/` |
| 2026-10-27 | `RECALL-01` | Resumos de Active Recall por marco de leitura e disparos de revisão | `migration-v1.9.sql`, `milestone-summary.ts` |
| 2026-10-27 | `AGENDA-01` | Módulo de Agenda (`/agenda`) com visão mensal e conclusão transacional de revisões | `src/app/agenda/`, `migration-v1.10.sql` |
| 2026-10-27 | `TIMER-01` | Barra global de cronômetro com duração dinâmica baseada na cota | `src/components/reading-timer-bar.tsx` |
| 2026-10-27 | `SESSION-01` | CRUD completo de sessões no histórico e detalhe com recálculo em cascata | `src/app/actions.ts`, `history-view.tsx` |
| 2026-10-27 | `BUG-04` | Cards compactos no histórico mobile; tabela preservada em telas maiores | `src/components/history/history-view.tsx`, `history-view.test.ts` |
| 2026-10-27 | `BUG-05` | Agenda e Tier 1 unificados para revisões de leituras e de marcos | `src/app/actions.ts`, `agenda.ts`, componentes de Agenda e Dashboard |
| 2026-10-28 | `BUG-06` | Toast com Desfazer ao concluir leitura na Biblioteca | `book-card.tsx`, `reading-completion-toast.ts` |
| 2026-10-28 | `UX-02` | Remoção de `alert()`/`confirm()` nativos no setup e dashboard | tabelas setup, cards dashboard, `no-native-dialogs.test.ts` |
| 2026-10-28 | `COG-01` | Orçamento cognitivo diário com alerta de sobrecarga e meta de páginas limitada | `cognitive-budget.ts`, `recommendation.ts`, dashboard |
| 2026-10-28 | `FEAT-03` | Heatmap de consistência dos últimos 28 dias (Dashboard + Histórico) | `consistency-heatmap.ts`, `consistency-heatmap.tsx` |
| 2026-10-28 | `DOC-02` | Revisão do backlog, adição de BUG-08, UX-09, COG-06, FEAT-05, FEAT-06 e isolamento das propostas rejeitadas (UX-08, COG-03, FEAT-01, FEAT-02) | `plano-de-implementacao.md` |
| 2026-10-28 | `DOC-03` | Adição ao backlog de BUG-09 (Active Recall solicitando marco anterior lido) e UX-10 (remoção de scroll interno no heatmap) | `plano-de-implementacao.md` |
| 2026-10-28 | `DOC-04` | Formalização das ideias prematuras (Seção 0) em itens estruturados: UX-11 (card de recomendação), UX-12 (reestruturação de navegação Setup→Biblioteca/Agenda), UX-13 (Title Case automático) e UX-14 (refatoração do formulário de leituras) | `plano-de-implementacao.md` |
| 2026-10-28 | `BUG-09` | Active Recall gerado para o marco recém-concluído nas transições e ao atingir a meta | `milestone-crossing.ts`, `actions.ts` |
| 2026-10-28 | `UX-14` | Formulário de leituras extraído, integrado à Biblioteca, guiado por etapas, validado e responsivo | `reading-form.tsx`, `library-view.tsx`, `readings-table.tsx`, `reading-validation.ts` |
