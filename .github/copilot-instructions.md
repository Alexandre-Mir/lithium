# Copilot instructions

## Project overview

Lithium is a personal study-planning app built with Next.js 16 App Router, React, and Supabase. The UI is in Brazilian Portuguese.

- Route pages in `src/app` load server-side data and pass it to feature components in `src/components`. Mutations and most data access live in `src/app/actions.ts` as Server Actions.
- Supabase session refresh and route protection are handled by `src/proxy.ts` and `src/lib/supabase/proxy.ts`; server-side reads and writes use `requireSupabaseUser` from `src/lib/supabase/server.ts`. Row-level security in Supabase isolates user data.
- `src/lib` contains domain calculations and validation, generally as pure functions with colocated `*.test.ts` tests. The study workflow tracks subjects, deliverables, readings, and reading sessions; dashboard recommendations and cognitive load are computed by modules such as `recommendation.ts`, `projection.ts`, `speed.ts`, and `cognitive-budget.ts`. Review scheduling includes D+1, D+7, and D+21.
- Book and article metadata providers are called server-side through `src/lib/book-metadata.ts`; never call external APIs during rendering or expose their secrets to the client.
- `supabase/schema.sql` is the current schema reference, `supabase/migration-v*.sql` contains versioned migrations, and `src/types/database.ts` mirrors the schema.

## Commands

- `npm run dev` — start the development server.
- `npm run check` — run ESLint, TypeScript, and the Vitest suite.
- `npm run lint` — run ESLint.
- `npm run typecheck` — run TypeScript without emitting files.
- `npm test` — run all tests once; `npm run test:watch` runs Vitest interactively.
- Run one test file with `npx vitest run src/lib/cascade.test.ts` (replace the path with the target `*.test.ts` file).
- `npm run build` — production build; run before finishing changes to routes, configuration, or global CSS.

Vitest uses the Node environment and includes `src/**/*.test.ts`.

## Repository conventions

- Read `AGENTS.md` and `plano-de-implementacao.md` before feature work. The plan is the official roadmap: mark completed roadmap items and update its history; record newly discovered actionable ideas under **Ideias prematuras**.
- Before changing Next.js code, consult the relevant guide under `node_modules/next/dist/docs/`; this repository uses Next.js 16.4.3, whose APIs and conventions may differ from older versions.
- Keep user-facing UI in pt-BR and follow the existing strict flat design: no shadows or gradients.
- Route every date/time-zone operation through `src/lib/dates.ts` (`America/Sao_Paulo`). Do not use `toISOString().split("T")` or `toLocaleString` without an explicit `timeZone`.
- `duration_seconds` is authoritative for session duration; `duration_minutes` is a legacy/display field. Use `src/lib/session-time.ts` for duration calculations.
- Resolve proof-to-reading links only through `src/lib/cascade.ts`. Ask before changing business rules, including cascade behavior and spaced-review intervals.
- Put new domain logic in `src/lib` with a colocated test. Preserve the existing separation between domain calculations and UI/data access.
- Supabase can silently cap results at 1,000 rows. Paginate large reads and use SQL views/aggregations for large aggregates; follow existing truncation warnings where applicable.
- In Client Components, derive values from props rather than initializing state from a prop that can become stale.
- Add database changes as a new `supabase/migration-vX.Y.sql`; never edit an applied migration. Keep `supabase/schema.sql` and `src/types/database.ts` in sync, and ask before schema changes or adding dependencies. Alexandre applies migrations in Supabase.
- Document environment variables in `README.md`, not `.env.example` (`.env*` is ignored). Keep secrets server-only and without a `NEXT_PUBLIC_` prefix.
- When changing global font styles, preserve the Geist fallback in the `--font-sans` variable and `geistSans.className` on the body; removing either has broken font rendering.
