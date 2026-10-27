# Lithium

Aplicação pessoal de estudos com Next.js, Supabase e UI em pt-BR.

## Variáveis de ambiente

Configure no ambiente de execução:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_BOOKS_API_KEY` (opcional; sem prefixo `NEXT_PUBLIC_`)
- `CONTACT_EMAIL` (opcional, recomendado para Open Library e Crossref)
- `SENHA` (obrigatória para proteger o acesso; variável somente do servidor, sem prefixo `NEXT_PUBLIC_`)

As consultas de metadados são feitas no servidor e persistidas em `readings`.

### Vercel

O arquivo `.env.local` é ignorado pelo Git e não é enviado para a Vercel. Cadastre `SENHA` em **Project Settings → Environment Variables** para Production e, se necessário, Preview; depois faça um novo deploy. Configure também as variáveis do Supabase no projeto da Vercel.
