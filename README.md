# Lithium

Aplicação pessoal de estudos com Next.js, Supabase e UI em pt-BR.

## Variáveis de ambiente

Configure no ambiente de execução:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_BOOKS_API_KEY` (opcional; sem prefixo `NEXT_PUBLIC_`)
- `CONTACT_EMAIL` (opcional, recomendado para Open Library e Crossref)

O acesso ao app usa Supabase Auth com email e senha. A interface não oferece cadastro: crie a única conta em **Authentication → Users** no painel do Supabase e entre com essas credenciais. A variável antiga `SENHA` não é mais usada.

As consultas de metadados são feitas no servidor e persistidas em `readings`.

### Vercel

O arquivo `.env.local` é ignorado pelo Git e não é enviado para a Vercel. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em **Project Settings → Environment Variables** para Production e, se necessário, Preview; depois faça um novo deploy. Configure também as variáveis opcionais de metadados, se forem necessárias.
