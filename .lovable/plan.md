## Funcionalidades a implementar

### 1. Cadastro de Clientes — Origem ("Como chegou")
- Adicionar campo `acquisition_source` na tabela `clients` (texto).
- Opções no formulário: Indicação, Redes Sociais, Google, Tráfego Pago, Outros.
- Exibir nos filtros/relatórios de clientes (chip/badge).

### 2. Vendas — Múltiplos profissionais por serviço
Hoje a venda tem apenas `professional_id` (único). Vamos suportar N profissionais por venda mantendo compatibilidade.

**Mudança de modelo:**
- Criar tabela `sale_professionals`:
  - `sale_id` (uuid)
  - `professional_id` (uuid)
  - `role` (text): `solo` | `with_assistants` | `as_assistant`
  - `commission_percentage` (numeric) — congelado no momento da venda
  - `commission_amount` (numeric) — valor calculado
  - `establishment_id` (uuid) — para RLS
- Manter `sales.professional_id` como "profissional principal" (compatibilidade).
- RLS por `establishment_id`.

**UI em Vendas:**
- Permitir selecionar 1 ou mais profissionais por venda.
- Para cada profissional escolhido, escolher o papel: Sozinho / Com Assistentes / Como Assistente.
- O percentual de comissão é puxado do cadastro do serviço (item 3) conforme o papel.

### 3. Comissionamento por serviço — 3 regras
Atualmente o % de comissão fica no profissional. Conforme regra do usuário, deve ficar **no serviço**, com três faixas.

**Mudança no `services`:**
- `commission_solo` (numeric, default 40)
- `commission_with_assistants` (numeric, default 0)
- `commission_as_assistant` (numeric, default 0)

**Cadastro de Serviços (UI):**
- Três campos numéricos (%) no formulário do serviço.

**Cálculo de comissão na venda:**
- Para cada profissional vinculado à venda, aplicar `services.commission_*` correspondente ao `role`.
- Salvar `commission_percentage` e `commission_amount` em `sale_professionals` (snapshot).
- Dashboard "Comissão a pagar" passa a somar `sale_professionals.commission_amount` em vez de `sales.amount * professionals.commission_percentage`.

### Resumo técnico
- **Migração**: adicionar `clients.acquisition_source`; adicionar 3 colunas de comissão em `services`; criar tabela `sale_professionals` com RLS.
- **UI**:
  - `src/pages/Clients.tsx` — campo "Como chegou".
  - `src/pages/Services.tsx` — três campos de comissão (%).
  - `src/pages/Sales.tsx` — seleção multi-profissional com papel por profissional; calcular e gravar `sale_professionals`.
  - Dashboard/relatórios de comissão — ler de `sale_professionals`.
- **Compatibilidade**: vendas antigas continuam funcionando; cálculo legado usa `professionals.commission_percentage` quando não houver `sale_professionals`.

Após aprovação, executo a migração e em seguida as alterações de UI.