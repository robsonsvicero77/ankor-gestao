# Banco de dados

O banco de produção é Supabase Postgres. Crie um projeto Supabase vazio e execute
`migrations/001_create_tables.sql` pelo SQL Editor do painel. A migração cria as
tabelas financeiras, ativa RLS sem expor acesso direto ao navegador e cria o
perfil e o tenant automaticamente quando Supabase Auth cadastra um usuário.
