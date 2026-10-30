# Lithium — Plano de Implementação, Backlog & Roadmap

Este documento centraliza as dívidas técnicas, correções de bugs, oportunidades de melhoria de UX/UI, evoluções do Motor Cognitivo e propostas de novas funcionalidades e integrações para o **Lithium**.

> **Diretriz para Agentes de IA (`AGENTS.md`):**
> 1. Consulte este documento no início de qualquer nova tarefa para alinhar o trabalho ao roadmap oficial.
> 2. Ao implementar ou corrigir qualquer item aqui listado, marque a caixa correspondente (`[x]`), registre a data e o commit/resumo da mudança na tabela de histórico.
> 3. Ao identificar novos bugs, atritos de UX ou oportunidades durante auditorias e desenvolvimento, adicione-os na seção apropriada mantendo a convenção de IDs (`BUG-XX`, `UX-XX`, `COG-XX`, `FEAT-XX`).
> 4. Nunca remova regras de negócio consolidadas sem alinhamento prévio (cascata, D+1/D+7/D+21, vínculo prova↔leitura, fuso `America/Sao_Paulo`).
> 5. Respeite as propostas listadas na Seção 5 como **Rejeitadas da Forma Atual**: não tente reintroduzi-las sem aprovação expressa do usuário.

---

## Ideias prematuras

Registre aqui ideias acionáveis identificadas durante o trabalho que ainda precisem de contexto, validação ou refinamento. Quando estiverem maduras, mova-as para a seção apropriada (BUG, UX/UI, COG ou FEAT), sem perder o histórico da decisão.

### Exploração de produto — 2026-10-29

> **Decisão:** Nenhuma das propostas abaixo foi aprovada. Permanecem apenas como ideias prematuras; não implementar nem promover para o backlog categorizado sem aprovação expressa.

- **Bilhete de retomada da leitura:** Ao encerrar uma sessão, permitir salvar uma frase opcional sobre onde parou, uma dúvida ou o próximo passo. Mostrar o bilhete ao iniciar a leitura novamente, sem transformá-lo em marco nem em revisão obrigatória. **Validar:** isso ajuda a retomar o raciocínio ou vira mais um campo para preencher?
- **Alerta de colisão de prazos:** Detectar quando várias entregas se aproximam enquanto leituras vinculadas ainda exigem uma carga diária alta. Em vez de só destacar cada prazo isolado, indicar que a semana pode estar inviável e mostrar quais premissas formaram o alerta. **Validar:** qual janela de dias e qual sinal de capacidade seriam úteis sem alarmes falsos?
- **Pausa com contexto no cronômetro:** Diferenciar uma interrupção temporária de uma sessão finalizada, preservando o ponto de retomada e permitindo uma anotação curta como “atendimento” ou “intervalo”. **Validar:** estudantes precisam consultar esse contexto depois ou basta preservar a duração real da sessão?
- **Glossário pessoal por leitura:** Deixar o estudante registrar termos e explicações próprias associados a uma página ou marco, com acesso rápido ao voltar à leitura. Seria uma camada leve de conhecimento pessoal, sem importação automática nem classificação de dificuldade. **Validar:** os termos seriam reutilizados em revisões ou apenas úteis como consulta?
- **Janela de estudo protegida:** Permitir indicar períodos indisponíveis ou dias excepcionalmente ocupados e comparar essa disponibilidade com a carga prevista, sem criar um calendário obrigatório de sessões. **Validar:** uma visão semanal simples resolve o problema ou isso duplicaria a Agenda e o resumo semanal planejado?

## 1. Bugs e Inconsistências Identificados

### Pendentes
- [x] **`BUG-07` — Limite de 1.000 Registros sem Paginação no Histórico (`/history`)**
  - **Contexto:** `getAllReadingSessions()` no backend aplica `warnIfTruncated` quando o total de sessões atinge 1.000 linhas, exibindo um aviso estático na tela. Estudantes com uso diário intenso ao longo dos meses não conseguem carregar sessões antigas além desse limite.
  - **Ação:** Adicionar suporte a paginação paginada (cursor ou página com botão "Carregar mais sessões") na Server Action e na view.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/components/history/history-view.tsx`.
  - *Resolução:* Histórico carrega sessões em páginas de 50 com “Carregar mais sessões”; resumo agregado e heatmap dos últimos 28 dias são independentes da página carregada.

- [x] **`BUG-10` — Divergência de Dia em Sessões Próximas à Virada do Fuso**
  - **Contexto:** Sessões iniciadas perto da meia-noite podem ser agrupadas em dias diferentes caso algum fluxo use UTC enquanto o restante da aplicação usa `America/Sao_Paulo`.
  - **Ação:** Reproduzir a virada do dia em registros manuais e cronometrados; centralizar a conversão nos utilitários de data e garantir que Dashboard, Histórico e heatmap atribuam a sessão ao mesmo dia.
  - **Arquivos-chave:** `src/lib/dates.ts`, `src/app/actions.ts`, `src/lib/consistency-heatmap.ts`.
  - *Resolução:* Dashboard e heatmap usam intervalos de calendário em `America/Sao_Paulo`; sessões com timestamps válidos são rateadas por dia e registros legados mantêm fallback pela data local.

- [x] **`BUG-11` — Criação Duplicada por Submissões Repetidas de Sessão**
  - **Contexto:** Cliques repetidos durante uma resposta lenta podem enviar mais de uma vez o mesmo registro manual ou a conclusão do cronômetro.
  - **Ação:** Verificar os fluxos de criação e, se reproduzido, bloquear submissões concorrentes na interface e proteger a ação contra duplicidade sem impedir sessões legítimas consecutivas.
  - **Arquivos-chave:** `src/components/reading-session-modal.tsx`, `src/components/reading-timer-bar.tsx`, `src/app/actions.ts`.
  - *Resolução:* Modal bloqueia envio concorrente e mantém UUID da tentativa para retry; índice único e RPC idempotente impedem duplicação no banco.

- [x] **`BUG-12` — Progresso Inconsistente Após Redução da Meta de Páginas**
  - **Contexto:** Ao editar `target_pages` para um valor inferior ao progresso atual, os dados podem ficar acima de 100% ou divergir entre cards, detalhes e cálculos de conclusão.
  - **Ação:** Reproduzir a edição em leituras abertas e concluídas; definir uma validação coerente para a meta e o progresso, cobrindo o comportamento com testes antes de alterar dados persistidos.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/lib/progress.ts`, `src/components/library/reading-form.tsx`.
  - *Resolução:* A Server Action valida a meta contra páginas lidas e trigger no banco impede que atualizações concorrentes persistam meta inferior ao progresso.

- [x] **`BUG-13` — Referências Inválidas ao Excluir Disciplina ou Leitura**
  - **Contexto:** A exclusão de registros que possuem leituras, sessões, marcos ou entregas associados pode falhar parcialmente ou deixar conteúdo órfão visível.
  - **Ação:** Auditar as relações e reproduzir exclusões com dependências; garantir transação ou mensagem de erro explícita, preservando o vínculo prova↔leitura e sem apagar histórico inesperadamente.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/lib/cascade.ts`, `src/types/database.ts`.
  - *Resolução:* Ações bloqueiam exclusões com dependências e FKs restritivas preservam sessões, revisões, marcos e entregas contra exclusão concorrente ou direta.

- [x] **`BUG-14` — Recálculo de Velocidade com Sessões Inválidas ou de Duração Zero**
  - **Contexto:** Sessões importadas ou editadas com duração ausente, zero ou páginas negativas podem distorcer a velocidade média se forem aceitas pelos fluxos de persistência.
  - **Ação:** Conferir validação no servidor e no recálculo após criação, edição e exclusão; rejeitar entradas inválidas com retorno claro e cobrir os limites em testes.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/lib/session-time.ts`, `src/lib/speed.ts`.
  - *Resolução:* Validação de entrada rejeita páginas/duração inválidas; RPCs recalculam velocidade dentro da mesma transação de criação, edição ou exclusão.

- [x] **`BUG-15` — Políticas RLS Permitem Acesso Anônimo às Tabelas Centrais**
  - **Contexto:** O schema habilita RLS, mas cria políticas `"Allow all"` para `subjects`, `deliverables`, `readings`, `reading_sessions`, `spaced_reviews` e `app_settings`. A aplicação usa uma chave anon no cliente Supabase compartilhado; a proteção visual por login não substitui autorização no banco.
  - **Ação:** Definir o modelo de propriedade dos dados e substituir as políticas abertas por políticas restritas, migrando as chamadas de leitura e escrita para clientes autenticados. Validar o comportamento com usuários autenticados e anônimos antes de aplicar a migração.
  - **Arquivos-chave:** `supabase/schema.sql`, novas migrações em `supabase/`, `src/lib/supabase.ts`, `src/app/actions.ts`.
  - *Resolução:* Migração v1.12 restringe RLS ao proprietário autenticado, revoga acesso anônimo e exige um único usuário proprietário; ações usam cliente autenticado. A migração precisa ser aplicada pelo responsável no Supabase.

- [x] **`BUG-16` — Sessões que Cruzam a Meia-Noite Distorcem Totais Diários**
  - **Contexto:** `getTodayTotalReadingTime` soma a duração inteira quando o início ou o fim da sessão cai hoje. Uma sessão que atravesse a meia-noite pode, portanto, ter a duração integral contabilizada em dois dias; o heatmap, por outro lado, atribui a sessão inteira à data de início.
  - **Ação:** Definir uma regra única de atribuição ou rateio por intervalo de tempo, aplicar ao orçamento diário e ao heatmap e cobrir sessões iniciadas/encerradas em dias diferentes no fuso `America/Sao_Paulo`.
  - **Arquivos-chave:** `src/lib/session-time.ts`, `src/lib/consistency-heatmap.ts`, `src/app/actions.ts`.
  - *Resolução:* Duração e páginas são rateadas pela fração de tempo em cada data local; heatmap e meta diária compartilham o mesmo cálculo com testes de virada.

- [x] **`BUG-17` — Falhas em Consultas de Métricas São Exibidas como Dados Zerados**
  - **Contexto:** `getReadingProgressMap` retorna mapa vazio quando a consulta falha, e `getTodayReadingSummary` retorna zero minutos e nenhuma página; o Dashboard pode apresentar valores plausíveis como se fossem reais, sem sinalizar que a consulta falhou.
  - **Ação:** Diferenciar erro de consulta de resultado vazio e propagar um estado degradado até a interface, preservando a disponibilidade do restante do Dashboard sem mascarar métricas ausentes.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/app/page.tsx`, componentes do Dashboard.
  - *Resolução:* Consultas com falha propagam estado indisponível e avisos para o Dashboard; recomendações que dependem de métricas ausentes deixam de ser calculadas como se fossem zero.

- [x] **`BUG-18` — Operações de Sessão e Conclusão Podem Persistir Parcialmente**
  - **Contexto:** `createReadingSession` grava a sessão antes de criar resumos de marcos e recalcular velocidade; `markReadingAsRead` altera a leitura antes de criar revisões espaçadas. Uma falha numa etapa posterior deixa dados parcialmente atualizados.
  - **Ação:** Mover cada sequência que exige consistência para uma transação/RPC idempotente e informar falhas sem sugerir que a operação inteira foi revertida quando não foi.
  - **Arquivos-chave:** `src/app/actions.ts`, `supabase/schema.sql`, novas migrações em `supabase/`.
  - *Resolução:* RPCs transacionais para criação/edição/exclusão de sessão e conclusão/estorno de leitura agrupam as alterações dependentes; criação de sessão também é idempotente.

- [x] **`BUG-19` — Listas de Leituras e Disciplinas Podem Ser Truncadas sem Aviso na Interface**
  - **Contexto:** Consultas como `getReadings`, `getSubjects` e as leituras usadas por `getSubjectStats` não paginam os resultados do Supabase. `getReadings` apenas registra um aviso no servidor ao atingir 1.000 linhas, sem informar a tela nem carregar o restante.
  - **Ação:** Implementar paginação ou consultas agregadas conforme o uso e comunicar truncamento quando a lista não puder ser carregada integralmente; testar acima do limite padrão do Supabase.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/components/library/library-view.tsx`, `src/components/setup/subjects-table.tsx`.
  - *Resolução:* Leituras, disciplinas, sessões e dados usados pelas métricas são buscados em páginas completas; a validação de dias de aula também pagina a lista de disciplinas.

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
- [x] **`BUG-08` — Incompatibilidade entre Páginas Relativas (Trecho) e Absolutas (Livro) no Modal de Sessão e Marcos**
  - *Resolução:* Modal passou a oferecer registro por quantidade ou página final. A página inicial opcional do trecho é persistida; sessões manuais, cronometradas e editadas convertem a página impressa em progresso relativo, e marcos do sumário são normalizados para o trecho mantendo sua página original nos resumos.
- [x] **`BUG-09` — Disparo Incorreto do Resumo de Marco (Active Recall Solicita o Próximo Marco em Vez do Recém-Concluído)**
  - *Resolução:* `getCrossedMilestones` agora associa cada transição ao marco anterior e inclui o último marco quando `nextPage` alcança `target_pages`; `createReadingSession` consulta a meta para aplicar essa regra.

---

## 2. Pontos de Melhora no UX/UI (Flat Design & Usabilidade)

### Pendentes
- [x] **`UX-03` — Alinhamento Ergonômico dos Botões de Dias da Semana (`/setup`)**
  - **Contexto:** Na inserção de disciplinas, os botões dos dias quebram em duas linhas desalinhadas ("Seg, Ter, Qua, Qui, Sex" e "Sáb" isolado abaixo).
  - **Ação:** Reorganizar para grade de 6 colunas (`grid grid-cols-6 gap-1.5`) consistente em qualquer resolução.
  - **Arquivos-chave:** `src/components/setup/subjects-table.tsx`.

- [x] **`UX-07` — Alerta Sonoro / Feedback Sensorial no Término do Cronômetro**
  - **Contexto:** Ao esgotar o tempo do sprint de leitura (`remainingSprintSeconds === 0`), a barra emite apenas um toast e atualiza o título do documento. Se o estudante estiver focado no livro físico, não percebe o término.
  - **Ação:** Tocar um sinal sonoro sutil sintetizado via Web Audio API (senoide pura de curta duração, sem dependências de áudio externas ou arquivos pesados) quando o sprint zerar.
  - **Arquivos-chave:** `src/components/reading-timer-bar.tsx`.

- [x] **`UX-09` — Notificação Graciosa de Sessão Expirada no Fluxo de Ações**
  - **Contexto:** Quando o token de autenticação do Supabase expira durante o uso contínuo, algumas Server Actions que exigem usuário autenticado lançam exceção genérica ("Authentication required") em vez de emitir aviso explicativo ao usuário.
  - **Ação:** Capturar erro de autenticação e emitir toast com aviso claro ("Sua sessão expirou. Redirecionando para login...") preservando a rota de retorno segura.
  - **Arquivos-chave:** `src/app/actions.ts`, `src/lib/auth-redirect.ts`.

- [x] **`UX-10` — Remoção do Scroll Interno no Painel de Heatmap de Consistência**
  - **Contexto:** O card `ConsistencyHeatmap` em `src/components/consistency-heatmap.tsx` possui a classe `overflow-x-auto` no container do grid das semanas (`<div className="flex gap-2 overflow-x-auto">`). Como a janela fixa é de 28 dias (~4 a 5 colunas de 7 dias com largura total inferior a 100px), essa barra de rolagem horizontal interna é supérflua e surge involuntariamente em alguns navegadores e tamanhos de viewport, quebrando o visual limpo do Flat Design estrito.
  - **Ação:** Remover a classe de rolagem horizontal desnecessária (`overflow-x-auto`), e vertical, e assegurar que a grade, rótulos e legenda se ajustem fluidamente dentro do card sem barras de rolagem internas no Dashboard e na tela de Histórico.
  - **Arquivos-chave:** `src/components/consistency-heatmap.tsx`, `src/components/dashboard/dashboard-view.tsx`, `src/components/history/history-view.tsx`.

- [x] **`UX-12` — Reestruturação da Navegação: Leituras na Biblioteca, Entregas na Agenda, Setup Vira Disciplinas**
  - **Contexto:** Hoje o Setup (`/setup`) concentra 3 abas independentes: *Leituras* (`readings-table.tsx`, ~600 linhas), *Entregas* (`deliverables-table.tsx`) e *Disciplinas* (`subjects-table.tsx`). O formulário de criação de leituras já foi extraído e integrado à Biblioteca em `UX-14`, mas a listagem e edição continuam no Setup; Entregas também continuam fora da Agenda. A proposta conclui a reorganização:
    - **Leituras → Biblioteca:** Formulário de criação já integrado; mover listagem e gerenciamento das leituras para a própria `/library`, onde o estudante visualiza e atualiza seus livros.
    - **Entregas → Agenda:** Entregas/provas são eventos com data fixa e pertencem ao contexto de calendário (`/agenda`), já existente.
    - **Setup → Disciplinas:** A aba `/setup` passa a conter apenas o CRUD de disciplinas, simplificando a navegação e o propósito da rota.
  - **Ação (faseada):**
    1. **Concluído em `UX-14`:** Extrair o formulário de criação de leitura para `src/components/library/reading-form.tsx`, com estado gerenciado por `useReducer`.
    2. **Concluído em `UX-14`:** Integrar o componente na `LibraryView` em seção recolhível com botão "Adicionar leitura".
    3. **Concluído:** Mover `DeliverablesTable` para `src/components/agenda/` e renderizá-la como seção de gerenciamento na rota `/agenda`.
    4. **Concluído:** Simplificar `/setup` para conter exclusivamente `SubjectsTable`, removendo o wrapper `Tabs`.
    5. **Concluído:** Atualizar a navegação para apresentar `/setup` como “Disciplinas” e direcionar os atalhos de cadastro de leituras à Biblioteca.
    6. **Concluído:** Revalidar `/agenda`, `/library` e `/setup` nas Server Actions correspondentes.
  - **Progresso:** Reestruturação concluída; a listagem em cards foi preservada na Biblioteca e a tabela de gerenciamento de leituras fica disponível por alternância, sem duplicar conteúdo na tela.
  - **Arquivos-chave:** `src/components/library/readings-table.tsx`, `src/components/library/library-view.tsx`, `src/components/agenda/deliverables-table.tsx`, `src/components/agenda/agenda-view.tsx`, `src/components/setup/setup-view.tsx`, `src/app/setup/page.tsx`, `src/app/library/page.tsx`, `src/app/agenda/page.tsx`, `src/components/navbar.tsx`, `src/app/actions.ts`.
  - **Dependências:** Formulário de leituras integrado à Biblioteca em `UX-14`; destino do estado vazio do card de recomendação alinhado em `UX-11`. Todas as etapas restantes foram concluídas.

- [x] **`UX-13` — Formatação Automática de Títulos e Autores em Title Case**
  - **Contexto:** Não existe nenhuma transformação de casing no fluxo de criação de leituras. O campo `title` e `author` são armazenados exatamente como digitados pelo usuário ou retornados pela API (ISBN via Google Books / DOI via CrossRef). Isso produz inconsistências visuais frequentes: Google Books pode retornar títulos em CAIXA ALTA; CrossRef retorna autores em "SOBRENOME, Nome"; e o próprio usuário pode digitar em minúsculas corridas. Na Biblioteca e no Dashboard, leituras com casing inconsistente quebram a harmonia visual do Flat Design.
  - **Ação:**
    1. Criar função utilitária `toTitleCaseBR(text: string): string` em `src/lib/text.ts` que aplique Title Case com tratamento para preposições, artigos e conjunções em pt-BR (de, da, do, das, dos, e, ou, para, em, com, a, o, as, os, à, às, ao, aos, na, no, nas, nos, num, numa, uns, umas, por, pelo, pela — mantidos em minúscula exceto quando iniciais).
    2. **Concluído:** Exibir preview acionável de Title Case nos campos de título e autor; o usuário mantém controle e pode cadastrar sua grafia original.
    3. **Concluído:** Normalizar com `toTitleCaseBR` os dados importados nos callbacks de auto-fill por ISBN/DOI (`handleIsbnBlur`, `handleDoiBlur`).
    4. **Concluído:** Cobrir palavras simples, partículas internas, siglas (ISBN/DOI), nomes compostos e textos já formatados em `src/lib/text.test.ts`.
  - **Arquivos-chave:** `src/lib/text.ts` (novo), `src/lib/text.test.ts` (novo), `src/components/library/reading-form.tsx`.

- [x] **`UX-15` — Refinamento da Interface do Card de Leitura na Biblioteca**
  - **Contexto:** O `BookCard` reúne capa, tipo, disciplina, título, autor, métricas de progresso, prazo e ações. A ideia original pede um ajuste visual, mas ainda não identifica um atrito específico.
  - **Ação:** Revisar hierarquia visual, legibilidade e comportamento responsivo do card; definir os ajustes a partir dos problemas encontrados, preservando o Flat Design e sem alterar regras funcionais da leitura.
  - **Arquivos-chave:** `src/components/library/book-card.tsx`, `src/components/library/library-view.tsx`, `src/components/library/reading-cover.tsx`.

- [ ] **`UX-16` — Busca e Filtros Combináveis na Biblioteca**
  - **Contexto:** Conforme a coleção cresce, localizar uma leitura por título, autor, disciplina ou estado exige percorrer vários cards ou alternar a tabela de gerenciamento.
  - **Ação:** Adicionar busca textual e filtros combináveis com contagem de resultados, estado vazio específico e controles utilizáveis por teclado; manter filtros na URL apenas se isso seguir o padrão já adotado nas rotas.
  - **Arquivos-chave:** `src/components/library/library-view.tsx`, `src/components/library/book-card.tsx`, `src/components/library/readings-table.tsx`.

- [ ] **`UX-17` — Preservação do Contexto ao Voltar de um Detalhe**
  - **Contexto:** Ao abrir uma leitura e retornar à Biblioteca, filtros, ordenação e posição da lista podem se perder e obrigar o estudante a refazer a busca.
  - **Ação:** Validar o comportamento nos modos de cards e tabela; preservar o contexto de navegação sem manter estado obsoleto quando a coleção for atualizada.
  - **Arquivos-chave:** `src/components/library/library-view.tsx`, `src/app/library/[id]/page.tsx`.

- [ ] **`UX-18` — Foco e Navegação por Teclado em Diálogos**
  - **Contexto:** Fluxos de sessão, confirmação e edição podem ser difíceis de concluir sem mouse caso o foco inicial, a ordem de tabulação ou o retorno do foco ao fechar não sejam consistentes.
  - **Ação:** Auditar os diálogos principais com teclado e leitor de tela; corrigir foco inicial, contenção, tecla Escape e retorno ao acionador seguindo o componente de diálogo existente.
  - **Arquivos-chave:** `src/components/ui/dialog.tsx`, `src/components/reading-session-modal.tsx`, `src/components/confirm-dialog.tsx`.

- [ ] **`UX-19` — Feedback de Carregamento em Ações Assíncronas**
  - **Contexto:** Em conexões lentas, botões de salvar, concluir ou excluir podem parecer inativos e permitir tentativas repetidas antes de a ação responder.
  - **Ação:** Padronizar estados de carregamento e prevenção de duplo envio nos formulários e ações mais usadas, mantendo mensagens de erro e sucesso acessíveis.
  - **Arquivos-chave:** `src/components/library/reading-form.tsx`, `src/components/agenda/deliverables-table.tsx`, `src/components/reading-session-modal.tsx`.

- [ ] **`UX-20` — Densidade e Legibilidade das Tabelas em Telas Estreitas**
  - **Contexto:** As telas de disciplinas, entregas e gerenciamento de leituras têm campos e ações diferentes; em larguras intermediárias, colunas podem comprimir conteúdo antes de a versão móvel ficar disponível. Na inspeção autenticada em 390 px, a tabela de disciplinas manteve a largura de desktop e exibiu rolagem horizontal; a coluna de professor ficou parcialmente cortada.
  - **Ação:** Verificar pontos de quebra e hierarquia em larguras de 320 a 768 px; priorizar dados essenciais e disponibilizar ações sem rolagem horizontal desnecessária.
  - **Arquivos-chave:** `src/components/setup/subjects-table.tsx`, `src/components/agenda/deliverables-table.tsx`, `src/components/library/readings-table.tsx`.

- [ ] **`UX-21` — Informar Falha ao Marcar Leitura como Concluída**
  - **Contexto:** Em `ReadingDetailView`, a ação otimista de marcar como lida reverte o estado em caso de erro, mas o `catch` não exibe aviso; a pessoa pode não entender por que a leitura continua pendente.
  - **Ação:** Exibir feedback acessível de falha e manter o estado visual sincronizado com o servidor, sem ocultar o erro nem duplicar notificações.
  - **Arquivos-chave:** `src/components/library/reading-detail-view.tsx`, `src/lib/toast-store.ts`.

- [ ] **`UX-22` — Editar os Dados da Leitura na Página de Detalhes**
  - **Contexto:** A ideia de editar uma leitura diretamente na própria página de detalhes foi registrada como prematura, mas ainda não especificava quais campos ou como preservar as validações já existentes.
  - **Ação:** Permitir editar os dados cadastrais relevantes sem sair do detalhe, reutilizando validações e fluxos existentes da Biblioteca; definir quais campos podem ser alterados e garantir que edições não sobrescrevam progresso, sessões ou marcos inadvertidamente.
  - **Arquivos-chave:** `src/components/library/reading-detail-view.tsx`, `src/components/library/reading-form.tsx`, `src/app/actions.ts`.

- [ ] **`UX-23` — Posicionamento Vertical do Formulário de Login**
  - **Contexto:** Na inspeção visual da rota `/login` em 1365×900 e 390×844, o formulário fica próximo ao topo (padding de 16/24 unidades) e sobra uma grande área vazia abaixo, especialmente no celular.
  - **Ação:** Revisar o alinhamento vertical em telas baixas e altas, equilibrando o espaço ao redor do formulário sem prejudicar a visualização quando o teclado virtual está aberto ou houver mensagens de erro.
  - **Arquivos-chave:** `src/app/login/page.tsx`.

- [ ] **`UX-24` — Espaço Vertical Excessivo no Card de Recomendação do Dashboard**
  - **Contexto:** Na inspeção autenticada em 390×844, o card de próxima leitura recomendada reservou uma área vazia alta acima do título e das ações, que ficaram concentrados perto da parte inferior do card.
  - **Ação:** Ajustar a distribuição vertical do conteúdo em telas estreitas para reduzir espaço sem função e manter recomendação, progresso e ações visíveis com hierarquia clara.
  - **Arquivos-chave:** `src/components/dashboard/recommendation-card.tsx`, `src/components/dashboard/dashboard-view.tsx`.

- [ ] **`UX-25` — Capas Altas Demais nos Cards da Biblioteca Mobile**
  - **Contexto:** Na rota `/library` em 390×844, a capa dos cards ocupa grande parte da altura disponível; em cards com capa de fallback, título e controles ficam abaixo de uma área sólida extensa, aumentando a rolagem necessária para comparar leituras.
  - **Ação:** Rever a proporção ou apresentação das capas em telas estreitas para equilibrar reconhecimento visual e densidade da lista, sem prejudicar a leitura dos metadados nem a apresentação em telas maiores.
  - **Arquivos-chave:** `src/components/library/book-card.tsx`, `src/components/library/reading-cover.tsx`.

### Concluídos
- [x] **`UX-03` — Alinhamento Ergonômico dos Botões de Dias da Semana (`/setup`)**
  - *Resolução:* Seletores de dias de cadastro e edição agora usam grade de seis colunas, botões com altura uniforme e estado acessível `aria-pressed`.
- [x] **`UX-07` — Alerta Sonoro / Feedback Sensorial no Término do Cronômetro**
  - *Resolução:* Cronômetro toca um tom senoidal curto e suave uma única vez ao fim de cada sprint; o contexto de áudio é desbloqueado após interação e o toast existente continua como alternativa visual.
- [x] **`UX-09` — Notificação Graciosa de Sessão Expirada no Fluxo de Ações**
  - *Resolução:* Falhas de autenticação redirecionam ao login com rota de retorno local sanitizada; cookies de sessão inválidos são reconhecidos pelo proxy e um toast explica a expiração. Redirecionamentos do Next são preservados nos carregamentos envolvidos.
- [x] **`UX-10` — Remoção do Scroll Interno no Painel de Heatmap de Consistência**
  - *Resolução:* Grade do heatmap passou a se ajustar em layout de duas colunas sem overflow/rolagem interna; legenda quebra em linhas quando necessário no Dashboard e no Histórico.
- [x] **`UX-13` — Formatação Automática de Títulos e Autores em Title Case**
  - *Resolução:* `toTitleCaseBR` trata partículas em pt-BR e preserva ISBN/DOI; campos mostram preview aplicável sem impor mudanças manuais, e metadados importados são normalizados. Testes unitários adicionados.
- [x] **`UX-15` — Refinamento da Interface do Card de Leitura na Biblioteca**
  - *Resolução:* Card ganhou hierarquia tipográfica mais legível, progresso visual acessível, métricas organizadas e botões de ação uniformes; fallback da capa permanece em cor sólida Flat.
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
- [x] **`UX-11` — Refinamento do Card de Recomendação Diária no Dashboard**
  - *Resolução:* Estado vazio direciona à Biblioteca; urgência contextual exibe prazo vinculado e páginas restantes; ação para alternar entre a recomendação principal e a próxima opção elegível, mantendo o cálculo de cota pelo orçamento cognitivo.
- [x] **`UX-12` — Reestruturação da Navegação: Leituras na Biblioteca, Entregas na Agenda, Setup Vira Disciplinas**
  - *Resolução:* A Biblioteca preserva os cards e incorpora a tabela de gerenciamento de leituras; a Agenda recebe a tabela CRUD de entregas; `/setup` fica dedicado às disciplinas, com navegação renomeada e revalidação dos caminhos ajustada.

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

- [ ] **`COG-08` — Faixa de Confiança para Previsões de Conclusão**
  - **Conceito:** Uma data única de término pode transmitir precisão excessiva quando há poucas sessões ou grande variação no ritmo.
  - **Funcionalidade:** Após validar amostra mínima e dispersão das sessões, exibir uma faixa de previsão ou sinalizar baixa confiança em vez de apresentar uma estimativa pontual como certeza.
  - **Arquivos-chave:** `src/lib/projection.ts`, `src/lib/speed.ts`, `src/components/library/reading-detail-view.tsx`.

- [ ] **`COG-09` — Comparativo entre Ritmo Recente e Ritmo de Referência**
  - **Conceito:** A média acumulada pode esconder mudanças sustentadas de ritmo; o estudante não tem uma forma simples de perceber se o progresso recente está acelerando ou desacelerando.
  - **Funcionalidade:** Comparar períodos recentes com o histórico da própria leitura usando uma janela mínima de sessões e indicar a tendência sem transformar variações pequenas em alertas.
  - **Arquivos-chave:** `src/lib/speed.ts`, `src/lib/projection.ts`, `src/components/library/reading-detail-view.tsx`.

- [ ] **`COG-10` — Revisão do Orçamento Cognitivo com Duração Real**
  - **Conceito:** O orçamento diário usa estimativas de duração para revisões e cotas; dados reais de tempo podem revelar que a carga prevista está sistematicamente acima ou abaixo do esforço observado.
  - **Funcionalidade:** Comparar previsão e duração registrada por tipo de atividade, apresentar a diferença de forma informativa e permitir avaliar calibração sem alterar automaticamente a meta diária.
  - **Arquivos-chave:** `src/lib/cognitive-budget.ts`, `src/lib/session-time.ts`, `src/components/dashboard/`.

- [ ] **`COG-11` — Detecção de Desvio Persistente entre Plano e Execução**
  - **Conceito:** Uma leitura pode acumular dias de diferença entre a carga recomendada e o ritmo efetivo sem que uma sessão isolada seja suficiente para indicar um problema.
  - **Funcionalidade:** Definir uma janela de observação e um limiar explicável para destacar desvios persistentes, distinguindo atraso recuperável de dados insuficientes e sem reordenar a recomendação automaticamente.
  - **Arquivos-chave:** `src/lib/recommendation.ts`, `src/lib/projection.ts`, `src/components/dashboard/recommendation-card.tsx`.

- [ ] **`COG-12` — Sinalização de Revisões Acumuladas sem Sobrecarga de Alertas**
  - **Conceito:** Revisões D+1, D+7 e D+21 vencidas em sequência podem se acumular e competir com novas leituras dentro do orçamento cognitivo diário.
  - **Funcionalidade:** Medir o acúmulo e indicar uma prioridade de recuperação transparente, respeitando o ciclo espaçado existente e sem descartar nem reagendar revisões silenciosamente.
  - **Arquivos-chave:** `src/lib/cognitive-budget.ts`, `src/lib/agenda.ts`, `src/components/dashboard/`.

### Concluídos
- [x] **`COG-01` — Orçamento Diário de Carga Cognitiva (Daily Cognitive Budget)**
  - *Resolução:* Meta diária (`daily_goal_minutes`) passa a atuar como orçamento cognitivo. `computeCognitiveBudget` soma Tier 1 (15 min/revisão) + cotas Tier 2; o Dashboard exibe alerta de *Sobrecarga cognitiva* e `calculateBudgetAwareSuggestedPages` limita a meta recomendada.
- [x] **`COG-02` — Active Recall por Marco de Leitura (`milestone_summaries`)**
  - *Resolução:* Implementada a tabela `milestone_summaries` (v1.9) e `scheduled_reviews` (v1.10), disparando criação atômica de revisões D+1, D+7 e D+21 ao preencher o resumo de marco, com integração no Dashboard e na Agenda.
- [x] **`COG-RECOM` — Recomendação Diária Inteligente de Leitura**
  - *Resolução:* Implementado o algoritmo em `src/lib/recommendation.ts` que sugere a leitura ideal do dia com base em proximidade da prova, meta diária atingida e cota de páginas necessária.
- [x] **`COG-07` — Refinamento dos Critérios da Próxima Leitura Recomendada**
  - *Resolução:* Prazos vencidos têm prioridade sobre o prazo de hoje, e prazos mais próximos passam à frente de leituras com maior carga diária mas vencimento distante. Para a mesma data, a carga diária necessária desempata; fila, inatividade, filtro de cota diária e limite do orçamento cognitivo foram preservados.

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

- [ ] **`FEAT-07` — Instalação como Aplicativo Web (PWA)**
  - **Conceito:** Permitir instalar o Lithium em dispositivos compatíveis, com ícone, nome e janela próprios, mantendo a experiência autenticada e sem prometer disponibilidade offline antes de ela existir.
  - **Arquivos-chave:** `src/app/`, configuração de metadados e recursos estáticos.

- [ ] **`FEAT-08` — Assinatura ICS de Eventos da Agenda**
  - **Conceito:** Disponibilizar provas, entregas e revisões em um arquivo ou feed ICS para consulta em calendários externos, sem substituir a Agenda do Lithium.
  - **Arquivos-chave:** `src/app/agenda/`, `src/lib/agenda.ts`, `src/app/actions.ts`.

- [ ] **`FEAT-09` — Notificações Web Configuráveis para Prazos e Revisões**
  - **Conceito:** Oferecer lembretes opcionais no navegador para eventos próximos, com controle explícito de permissão, frequência e tipos de notificação.
  - **Arquivos-chave:** `src/components/agenda/`, `src/app/agenda/`, service worker e infraestrutura de notificações.

- [ ] **`FEAT-10` — Notas Pessoais Associadas a uma Leitura**
  - **Conceito:** Permitir guardar observações livres sobre uma obra, separadas dos resumos estruturados de Active Recall e sem exigir associação a uma página ou marco.
  - **Arquivos-chave:** `src/components/library/reading-detail-view.tsx`, `src/app/actions.ts`, `src/types/database.ts`, migração Supabase.

- [ ] **`FEAT-11` — Relatório Pessoal de Evolução de Estudos**
  - **Conceito:** Reunir em uma tela de consulta os minutos estudados, páginas avançadas, sessões e leituras concluídas em períodos selecionáveis, sem gamificação ou ranking.
  - **Arquivos-chave:** `src/app/history/`, `src/lib/consistency-heatmap.ts`, componentes de Histórico e Dashboard.

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
| 2026-10-29 | `DOC-05` | Ideias prematuras classificadas como UX-15 (card da Biblioteca) e COG-07 (critérios de recomendação) | `plano-de-implementacao.md` |
| 2026-10-29 | `COG-07` | Recomendação desempata primeiro por urgência do prazo e depois por carga diária necessária, com cenários cobertos por testes | `src/lib/recommendation.ts`, `src/lib/recommendation.test.ts` |
| 2026-10-29 | `DOC-06` | Regra para registrar ideias acionáveis na seção Ideias prematuras, antes de categorizá-las | `AGENTS.md`, `plano-de-implementacao.md` |
| 2026-10-29 | `BUG-08` | Registro de sessões por quantidade ou página impressa, com conversão de marcos absolutos para o trecho | `migration-v1.11.sql`, `reading-session-modal.tsx`, `session-pages.ts`, `toc-parser.ts`, `actions.ts` |
| 2026-10-29 | `UX-11` | Card exibe prazo e páginas restantes, permite alternar para segunda opção elegível e direciona estado vazio à Biblioteca | `recommendation-card.tsx`, `recommendation.ts`, `actions.ts`, `dashboard-view.tsx` |
| 2026-10-29 | `UX-12` | Leituras gerenciadas na Biblioteca, entregas na Agenda e `/setup` dedicado às disciplinas | `library/`, `agenda/`, `setup/`, `navbar.tsx`, `actions.ts` |
| 2026-10-29 | `UX-03/07/09/10/13/15` | Conclusão dos itens pendentes de UX/UI: grade semanal, som do cronômetro, aviso de sessão expirada, heatmap responsivo, sugestões Title Case e refinamento de cards | `subjects-table.tsx`, `reading-timer-bar.tsx`, `auth-redirect.ts`, `consistency-heatmap.tsx`, `text.ts`, `reading-form.tsx`, `book-card.tsx` |
| 2026-10-29 | `DOC-07` | Inclusão de cinco novos pontos pendentes em Bugs, UX/UI, Motor Cognitivo e Funcionalidades | `plano-de-implementacao.md` |
| 2026-10-30 | `DOC-08` | Auditoria estática: registro de riscos observados em RLS, métricas diárias, tratamento de falhas, atomicidade e limites de consulta; feedback de conclusão na Biblioteca | `plano-de-implementacao.md` |
| 2026-10-30 | `DOC-09` | Ideia prematura de editar uma leitura na página de detalhes refinada e classificada como UX-22; propostas anteriormente não aprovadas mantidas sem promoção | `plano-de-implementacao.md` |
| 2026-10-30 | `DOC-10` | Revisão visual do login em desktop e mobile; anotado o excesso de espaço abaixo do formulário em viewports observados | `plano-de-implementacao.md` |
| 2026-10-30 | `DOC-11` | Revisão visual autenticada em desktop e mobile; UX-20 detalhado com o corte da tabela de disciplinas e registrados os atritos UX-24/25; Agenda e Histórico mobile sem problemas evidentes nas telas revistas | `plano-de-implementacao.md` |
| 2026-10-30 | `BUG-07; BUG-10 a BUG-19` | Paginação do Histórico e listas, rateio por data local, validações de progresso, exclusões restritivas, métricas degradadas e RPCs transacionais; migração v1.12 preparada, não aplicada | `src/app/actions.ts`, `src/lib/session-time.ts`, `src/lib/consistency-heatmap.ts`, componentes de Histórico/Dashboard, `supabase/migration-v1.12.sql`, `supabase/schema.sql` |
