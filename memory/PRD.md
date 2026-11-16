# FinPredict - PRD (Product Requirements Document)

## Visão Geral
**Produto**: Painel de previsibilidade financeira para prestadores de serviço
**Stack**: React + FastAPI + Supabase Auth + Supabase Postgres
**Status**: MVP Sprint 1 + Sprint 2 - COMPLETO

---

## Problema Statement Original
Sistema SaaS de previsibilidade financeira com:
- Dashboard com saldo atual, receitas/despesas previstas 30d, saldo projetado
- CRUD de receitas a receber e despesas a pagar
- Sistema de Ledger (razão) para rastreabilidade de movimentações
- Interface em Português (BR)

---

## User Personas

### Persona 1: Prestador de Serviço Autônomo
- **Quem**: Freelancers, consultores, profissionais liberais
- **Necessidade**: Controlar fluxo de caixa de forma simples
- **Dor**: Planilhas complexas, falta de visibilidade de projeção

### Persona 2: Pequeno Empresário
- **Quem**: MEIs, pequenas empresas de serviço
- **Necessidade**: Prever se terá dinheiro para pagar contas
- **Dor**: Surpresas com fluxo de caixa negativo

---

## Core Requirements (Estáticos)

### Regras Fundamentais
1. O sistema NUNCA marca pago automaticamente
2. Saldo atual muda SOMENTE via ledger (marcar pago ou ajuste)
3. Todo número do dashboard é explicável via histórico (ledger)

### Requisitos Funcionais MVP
- [x] Auth: Cadastro e Login com Supabase Auth
- [x] CRUD Receitas (receivables)
- [x] CRUD Despesas (payables)
- [x] Marcar como pago → gera ledger entry
- [x] Dashboard com métricas financeiras
- [x] Timeline próximos 7 dias
- [x] Histórico completo (ledger)
- [x] Status de alerta (OK/ATENÇÃO/RISCO)

---

## O Que Foi Implementado

### Sprint 1 (02/03/2026)
- **Auth**: Cadastro/Login com Supabase Auth
- **CRUD**: Receitas e Despesas com marcar como pago
- **Ledger**: Sistema de razão para rastreabilidade
- **Dashboard**: Métricas financeiras completas

### Sprint 2 (02/03/2026)
- **P0 - Onboarding Obrigatório**: Usuários são redirecionados para definir saldo inicial antes de acessar o dashboard
- **P1 - Export CSV**: Exportação de receitas, despesas e histórico em formato CSV
- **P1 - Import CSV**: Importação em lote com modelos de planilha e validação
- **P1 - Filtros Avançados no Ledger**: Filtros por tipo, direção, data início e data fim
- **Enhancement - Lembretes por Email**: Sistema de lembretes para receitas pendentes (MOCKED sem RESEND_API_KEY, funcional com Resend em produção)

### Backend (FastAPI)
- **Auth**: Supabase Auth no cliente e `/api/auth/me` para carregar o perfil
- **Balance**: `/api/balance/initial`, `/api/balance/adjustment`
- **Receivables**: CRUD completo + `/mark-paid`
- **Payables**: CRUD completo + `/mark-paid`
- **Dashboard**: `/api/dashboard`
- **Ledger**: `/api/ledger` com filtros
- **Export**: `/api/export/receivables`, `/api/export/payables`, `/api/export/ledger`
- **Import**: `/api/import/receivables`, `/api/import/payables`, `/api/import/template/{type}`
- **Reminders**: `/api/reminders/send`, `/api/reminders/upcoming`
- **Onboarding**: `/api/onboarding/status`

### Frontend (React)
- Tela de Login/Registro responsiva
- Onboarding obrigatório para saldo inicial
- Dashboard com Bento Grid
- Página de Receitas com CRUD + botão de lembrete
- Página de Despesas com CRUD
- Página de Histórico (Ledger) com filtros avançados
- Página de Configurações com Export/Import
- Navegação responsiva (Sidebar desktop, Bottom nav mobile)

### Design
- Tema dark profissional
- Fonte: Chivo (headings), Inter (body)
- Cores: Zinc background, Emerald success, Rose danger
- Interface 100% em Português (BR)

---

## Backlog Priorizado

### P0 (Crítico)
- [x] Onboarding obrigatório para saldo inicial
- [x] Export CSV

### P1 (Importante)
- [x] Import de planilha (CSV)
- [x] Filtros avançados no ledger
- [x] Lembretes por email (MOCKED)

### P2 (Nice to have)
- [ ] Gráficos de projeção
- [ ] Recorrência de receitas/despesas
- [ ] Multi-moeda

### Futuro
- [ ] Multi-tenant (times)
- [ ] Integração bancária
- [ ] App mobile nativo
- [ ] Notificações push

---

## Configurações de Integração

### Email (Resend)
- **Variáveis de ambiente**:
  - `RESEND_API_KEY`: API key do Resend (opcional, mock mode se não configurado)
  - `SENDER_EMAIL`: Email remetente (default: noreply@finpredict.com)
- **Modo teste**: Emails são logados sem envio real
- **Produção**: Configurar RESEND_API_KEY para envio real

---

## Métricas de Sucesso
- Backend: 100% dos endpoints funcionando
- Frontend: 100% dos fluxos funcionando
- Testes automatizados: Passando

---

*Última atualização: 02/03/2026*
