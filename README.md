# FIN

Aplicação financeira pessoal responsiva construída com Next.js, React, TypeScript, Tailwind CSS, React Hook Form, Zod, Recharts e Supabase.

## Recursos

- Dashboard mensal com saldo previsto, entradas, despesas, vencimentos e gráficos.
- Lançamentos com busca, filtros, status e cadastro validado.
- Contas, cartões, compras parceladas, recorrências e categorias.
- Relatórios mensais, semestrais, anuais e exportação preparada.
- Três interfaces completas (Clássico, Ateliê e Pulse), cada uma com modo claro, escuro e automático.
- Preferência visual sincronizada por usuário e estrutura PWA responsiva.
- Autenticação por e-mail/senha ou Google OAuth.
- Modelo PostgreSQL completo com valores monetários em centavos.
- RLS em todas as tabelas financeiras e categorias iniciais por usuário.
- Função transacional para criar um parcelamento e suas parcelas.

## Estrutura principal

```text
app/
  [section]/page.tsx
  transactions/new/page.tsx
  fin-app.tsx
  globals.css
  layout.tsx
src/lib/
  formatters/money.ts
  supabase/client.ts
supabase/migrations/
  202607200001_initial_schema.sql
public/
  manifest.webmanifest
  og.png
```

## Rodar localmente

Requisitos: Node.js 22.13 ou superior e um projeto no Supabase.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000/dashboard`.

## Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute todos os arquivos de `supabase/migrations/` em ordem pelo nome, incluindo `202607220004_user_themes_and_google_auth.sql`.
3. Em Authentication, habilite e-mail/senha e defina as URLs permitidas.
4. Copie `.env.example` para `.env.local`.
5. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores de Project Settings → API.

O gatilho `handle_new_user` cria o perfil e as categorias padrão após o cadastro. Todas as tabelas possuem políticas que comparam `user_id` com `auth.uid()`.

### Habilitar login com Google

1. No Google Cloud Console, crie credenciais OAuth 2.0 do tipo **Aplicativo da Web**.
2. Use como URI de redirecionamento autorizada `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
3. No Supabase, abra **Authentication → Providers → Google**, habilite o provedor e informe o Client ID e o Client Secret.
4. Em **Authentication → URL Configuration**, cadastre a URL publicada do FIN e suas URLs de desenvolvimento. O FIN conclui o acesso em `/dashboard`.

O Google nunca entrega sua senha ao FIN. O Supabase valida o OAuth e o mesmo RLS usado por contas de e-mail protege todos os registros financeiros.

## Deploy

### Vercel

1. Importe o repositório na Vercel.
2. Cadastre as mesmas variáveis de ambiente do `.env.local`.
3. Use o comando de build `npm run build`.
4. Adicione a URL publicada às URLs permitidas do Supabase Auth.

### Supabase

Execute a migration em produção antes do primeiro acesso. Nunca exponha a `service_role`; o frontend usa somente a chave anônima e depende das políticas RLS.

## Segurança e evolução

- Exclusão funcional usa `deleted_at`; consultas de produto devem sempre ignorar registros removidos.
- Valores são armazenados como `bigint` em centavos.
- Autorização é aplicada no banco, não apenas na interface.
- Anexos podem usar Supabase Storage com políticas por `user_id` em uma próxima etapa.
