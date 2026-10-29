<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Lithium
### Comandos
- npm run check = lint + tsc + testes (rápido). npm run build só antes de encerrar tarefa que mexa em rotas, configuração ou CSS global.
- Migrações: arquivo novo supabase/migration-vX.Y.sql (quem aplica no Supabase é o Alexandre); refletir em supabase/schema.sql e src/types/database.ts. Nunca editar migração já aplicada.
### Definição de pronto
1. npm run check passa. Se falhar, corrija antes de responder; nunca declare concluído com teste vermelho.
2. Lógica nova em src/lib vem com teste (*.test.ts ao lado). Bug corrigido vem com um teste que falharia antes da correção.
3. No resumo final: mudanças por arquivo e o que NÃO foi verificado (visual no navegador, banco real).
4. Backlog: se a tarefa concluir ou endereçar itens de plano-de-implementacao.md, marque [x] e atualize o histórico; novos bugs e ideias devem ser registrados lá. Toda ideia acionável de produto, UX, técnica ou funcionalidade que surgir durante o trabalho deve ser anotada primeiro em `plano-de-implementacao.md`, na seção **Ideias prematuras**, mesmo que ainda não esteja suficientemente definida para virar um item categorizado.
### Convenções que o código não deixa óbvias
- Backlog vivo: plano-de-implementacao.md na raiz é o roadmap oficial do projeto (bugs, UX/UI, Motor Cognitivo e novas features). Consulte antes de iniciar demandas e mantenha-o sincronizado.
- UI em pt-BR; Flat Design estrito (sem sombra, sem gradiente).
- Datas: só via src/lib/dates.ts (fuso America/Sao_Paulo). Proibido toISOString().split("T") e toLocaleString sem timeZone.
- Tempo: segundos (duration_seconds) são a fonte da verdade; duration_minutes é legado/exibição. Contas via src/lib/session-time.ts.
- Vínculo prova↔leitura: só via src/lib/cascade.ts.
- APIs externas: só no servidor e nunca durante o render; segredos sem prefixo NEXT_PUBLIC_.
- O Supabase corta respostas em 1.000 linhas sem avisar: para somas, médias e listas grandes use view/agregação em SQL ou paginação.
- Client Components: não congelar props com useState(prop); derivar das props.
### Armadilhas já vividas
- globals.css: "--font-sans: var(--font-sans)" (gerado pelo shadcn) quebra a fonte; --font-sans aponta para --font-geist-sans COM fallback dentro do var(). A falha recente vinha da ausência de fallback interno em var(--font-geist-sans) e da falta de geistSans.className no body.
- O .gitignore ignora .env*: documente variáveis no README, não em .env.example.
### Peça antes de
- adicionar dependência; alterar schema fora de migração; mudar regras de negócio (cascata, D+1/D+7/D+21, vínculo prova↔leitura).
