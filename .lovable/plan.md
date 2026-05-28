# Implementação: Novos Planos + Gestão de Assinatura

## 1. Banco de dados (migration)

**Atualizar `subscription_plans`** — recriar/atualizar os 3 planos oficiais:
- Individual — R$ 29,90 — `max_users=1`, `max_clients=300`
- Profissional — R$ 69,90 — `max_users=4`, `max_clients=null` (ilimitado), feature `recommended`
- Empresa — R$ 109,90 — `max_users=20`, `max_clients=null`

Desativar (active=false) planos antigos que não se encaixam, para não quebrar assinaturas existentes.

**Novas funções/triggers:**
- `enforce_plan_user_limit()` → trigger BEFORE INSERT em `establishment_users` que valida `count(active) < plan.max_users`. Erro claro: "Limite de usuários do plano atingido".
- Atualizar `enforce_plan_client_limit()` já existente (mantém — apenas garantir que respeita `max_clients=null=ilimitado`, já faz).
- View/RPC `get_subscription_overview()` retornando: plano atual, valor, usuários usados/limite, clientes usados/limite, status, próxima cobrança, últimas faturas.

## 2. Frontend — Nova página `/planos`

Novo item no `AppSidebar` ("Planos", ícone `CreditCard`, grupo Configuração, visível só para owner/admin).

**`src/pages/Plans.tsx`** com 3 seções:

1. **Resumo do plano atual** — card com nome, preço/mês, usuários (x/y), clientes (x/y ou ilimitado), badge de status, próxima cobrança.
2. **Faturas** — tabela lendo `subscription_payments`: vencimento, status (Pago/Pendente/Vencido), valor, forma de pagamento, botão "Pagar" (abre `invoice_url`/`bank_slip_url`).
3. **Upgrade/Downgrade** — 3 cards de plano lado a lado, destaque no Profissional ("Mais popular"), botão "Plano atual" (disabled) ou "Migrar para este plano".

**Lógica de migração:**
- Upgrade (preço maior) → chama edge function `asaas-change-plan` que cancela assinatura atual no Asaas e cria nova imediatamente, atualiza `subscriptions.plan_id` + `monthly_amount`.
- Downgrade (preço menor) → marca `pending_plan_id` para aplicar no próximo ciclo (campo novo na tabela `subscriptions`) e mantém plano atual ativo.

## 3. Limites no app

- **Users.tsx** — antes de criar usuário, comparar count vs `plan.max_users`. Se atingiu: toast bloqueando + CTA "Fazer upgrade" → `/planos`.
- **Clients.tsx / ImportClientsDialog** — já existe trigger DB; capturar erro e mostrar mensagem amigável com CTA upgrade.

## 4. Landing page

Atualizar seção de planos em `src/components/LandingPage.tsx`:
- 3 cards: Individual R$29,90, Profissional R$69,90 (destacado, badge "Mais popular"), Empresa R$109,90.
- Listar benefícios por plano.
- CTA "Começar teste grátis" passando `signup_plan_slug` no localStorage (já suportado por `SelectPlan.tsx`).

## 5. Cadastro / Onboarding

`SelectPlan.tsx` já existe e seleciona o plano após signup — apenas garantir que mostra os 3 novos planos corretamente (já lê do DB).

## 6. Edge function nova

**`asaas-change-plan`** — autenticada, recebe `{ new_plan_id }`:
- Busca plan atual e novo.
- Se upgrade: cancela `asaas_subscription_id` atual, cria nova subscription no Asaas com `monthly_price` novo, atualiza DB.
- Se downgrade: grava `pending_plan_id` + `pending_plan_effective_at = next_billing_at` no DB. Webhook do próximo `PAYMENT_CONFIRMED` aplica a troca (atualizar `asaas-webhook`).

## 7. Detalhes técnicos

- Cores via tokens (`bg-primary`, `text-success`, `border-warning`...).
- Badges shadcn já presentes.
- Query keys: `["plans-catalog"]`, `["subscription-overview"]`, `["subscription-invoices"]` com refetch após mutação.
- Tudo PT-BR.

## Arquivos a criar/editar

**Migração:** atualizar `subscription_plans` + trigger user limit + colunas `pending_plan_id`, `pending_plan_effective_at` em `subscriptions`.

**Criar:**
- `src/pages/Plans.tsx`
- `supabase/functions/asaas-change-plan/index.ts`

**Editar:**
- `src/App.tsx` (rota `/planos`)
- `src/components/AppSidebar.tsx` (item menu)
- `src/components/LandingPage.tsx` (seção planos)
- `src/pages/Users.tsx` (bloqueio de limite)
- `src/pages/Clients.tsx` (mensagem amigável)
- `supabase/functions/asaas-webhook/index.ts` (aplicar pending_plan no PAYMENT_CONFIRMED)
