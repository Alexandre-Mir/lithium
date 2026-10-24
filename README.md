# Lithium

Aplicação pessoal de estudos com Next.js, Supabase e UI em pt-BR.

## Variáveis de ambiente

Configure no ambiente de execução:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_BOOKS_API_KEY` (opcional; sem prefixo `NEXT_PUBLIC_`)
- `CONTACT_EMAIL` (opcional, recomendado para Open Library e Crossref)

As consultas de metadados são feitas no servidor e persistidas em `readings`.
