# Backend — configuração e implantação

O backend do AnkorGestão usa FastAPI e é publicado no Vercel. A autenticação é
feita pelo Supabase Auth, e os dados da aplicação são armazenados no Supabase
Postgres. O frontend React é publicado separadamente como site estático na
Hostinger.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor do projeto, execute a migração
   [`001_create_tables.sql`](../db/migrations/001_create_tables.sql). Ela cria
   as tabelas da aplicação e configura a criação automática de um perfil e de
   um tenant para cada novo usuário do Auth.
3. Execute
   [`002_create_proposals.sql`](../db/migrations/002_create_proposals.sql)
   para habilitar o armazenamento de propostas.
4. Execute
   [`003_create_clients.sql`](../db/migrations/003_create_clients.sql)
   para habilitar o cadastro de clientes com isolamento por tenant.
5. Após a migração 003, execute
   [`004_create_contracts.sql`](../db/migrations/004_create_contracts.sql)
   para habilitar contratos vinculados aos clientes cadastrados.
6. Após a migração 004, execute
   [`005_create_persistent_settings.sql`](../db/migrations/005_create_persistent_settings.sql)
   para habilitar as configurações persistentes, os avatares privados e o
   vínculo entre recebíveis e clientes.
7. Após a migração 005, execute
   [`006_link_contract_receivables.sql`](../db/migrations/006_link_contract_receivables.sql)
   para habilitar a geração de recebíveis vinculados às parcelas de contratos
   assinados.
8. Nas configurações de autenticação do Supabase, defina a URL do site da
   Hostinger como URL do site. Se necessário, adicione URLs locais de
   desenvolvimento à lista de redirecionamentos permitidos.
9. Copie a URL do projeto e a chave publicável/anon nas configurações de API do
   Supabase. Essa chave pode ser usada no frontend; nunca exponha a senha do
   banco de dados.

## Publicação da API no Vercel

Importe o repositório no Vercel e defina **Root Directory** como `backend`.
Configure as variáveis de ambiente em cada ambiente Vercel que será utilizado:

| Variável | Valor/uso |
| --- | --- |
| `APP_ENV` | Use `production` nas implantações publicadas. |
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável `sb_publishable_...`. A API a utiliza para validar o token de acesso do usuário no Supabase Auth. |
| `SUPABASE_SECRET_KEY` | Chave secreta `sb_secret_...` usada pela API para listar e excluir contas pelo Supabase Auth Admin. Configure somente no backend/Vercel; nunca no frontend. |
| `DATABASE_URL` | URI do **Transaction Pooler** do Supabase (porta `6543`), com SSL e senha do banco de dados. Não use uma chave do Auth. |
| `CORS_ORIGINS` | Origens HTTPS exatas do site da Hostinger, separadas por vírgula e sem caminhos. |
| `CRON_SECRET` | Segredo aleatório e privado usado para autorizar o job agendado. |
| `RESEND_API_KEY` e `SENDER_EMAIL` | Opcionais; necessários para o envio de e-mails. |

Para implantações Preview, configure as variáveis desse ambiente separadamente
e, de preferência, use um projeto Supabase de testes em vez de dados reais.

O agendamento diário do Vercel está definido em
[`vercel.json`](vercel.json). Ele executa às 12:00 UTC, equivalente a 09:00 no
horário de São Paulo. Lembretes por e-mail são enviados somente a clientes
vinculados que tenham endereço de e-mail cadastrado; os resumos do proprietário
são enviados para o e-mail da conta. O envio automático requer
`RESEND_API_KEY`, `SENDER_EMAIL` e `CRON_SECRET`.

A API acessa o Postgres diretamente e aplica o isolamento por tenant nas
consultas. Não configure `DATABASE_URL` no frontend nem a inclua no repositório.
O pool assíncrono desativa o cache de instruções preparadas para manter a
compatibilidade com o Transaction Pooler do Supabase.

Administradores (`role = 'admin'`) podem consultar as contas em Configurações >
Contas cadastradas. A exclusão é permanente: remover a conta do Supabase Auth
também apaga o perfil, a empresa/tenant e os dados vinculados por cascata.
Contas de administrador não podem ser excluídas por essa tela. A chave
`SUPABASE_SECRET_KEY` é necessária para carregar e excluir contas; mantenha-a
somente como variável secreta do backend.

Para conceder acesso administrativo, altere a função diretamente pelo SQL Editor
do Supabase, substituindo o e-mail pelo da conta autorizada:

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

Não disponibilize essa permissão por uma operação acessível ao frontend.

Ao criar um contrato já como assinado ou mudar seu status para **Assinado**, a
API cria um recebível para cada parcela da agenda, vinculado ao cliente e ao
contrato. A criação é transacional e protegida contra duplicidades. Alterações
posteriores na agenda ou o cancelamento do contrato não modificam nem removem
os recebíveis existentes; esses ajustes devem ser feitos na tela de Recebíveis.
Contratos que já estavam assinados antes da aplicação da migração 006 não são
processados retroativamente, para evitar duplicar recebíveis cadastrados
manualmente.

## Publicação do frontend na Hostinger

Antes de gerar o build, configure estas variáveis no frontend:

- `REACT_APP_BACKEND_URL`: origem da API publicada no Vercel.
- `REACT_APP_SUPABASE_URL`: URL do projeto Supabase.
- `REACT_APP_SUPABASE_PUBLISHABLE_KEY`: chave publicável `sb_publishable_...` do projeto.

Gere o build de produção na pasta `frontend/` e envie o conteúdo de
`frontend/build` para `public_html`. O arquivo `.htaccess` do frontend direciona
as rotas do React Router para `index.html`.

## Desenvolvimento local

Copie `backend/.env.example` para `backend/.env` e
`frontend/.env.example` para `frontend/.env`; preencha os valores necessários e
mantenha `APP_ENV=development`. Inicie a API a partir da pasta `backend/`:

```bash
uvicorn server:app --reload
```

Fora do ambiente de produção, o React usa a API local por padrão.

## Testes de integração opcionais

A suíte `backend_test.py` exige uma conta de teste separada e confirmada no
Supabase, além das variáveis `SUPABASE_TEST_EMAIL` e
`SUPABASE_TEST_PASSWORD`. Também são necessárias `SUPABASE_URL` e
`SUPABASE_PUBLISHABLE_KEY`. A suíte grava dados financeiros; não a execute em um tenant
que contenha dados reais.
