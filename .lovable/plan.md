## Ajustes Prioritários — Beauty Core

Vou implementar em 5 frentes, na ordem de prioridade que você definiu. Como envolve mudanças de schema + várias telas, peço aprovação antes de começar para não quebrar fluxos já em uso.

---

### 1. Comanda Inteligente (PRIORIDADE MÁXIMA)

Hoje "Vendas (PDV)" registra apenas 1 serviço + 1 profissional por linha. Vou transformar em **comanda multi-item**:

**Novo fluxo:**
- Botão "Abrir Comanda" → seleciona cliente (obrigatório) e, se vier de agendamento, pré-carrega serviços/profissionais
- Tela da comanda lista itens, cada item com:
  - Serviço (editável)
  - Profissional(is) — 1 ou vários, divide comissão igualmente
  - Valor (editável — sobrescreve preço padrão)
  - Comissão calculada e exibida em tempo real
- Ações: ➕ adicionar serviço, 🗑 remover, ✏️ editar valor/profissionais
- **Finalização:** escolhe forma de pagamento (Dinheiro / Pix / Débito / Crédito à vista / Crédito parcelado) → aplica taxa → gera venda + entradas no fluxo de caixa (receita bruta + despesa "Taxa de cartão" automática) + comissões em `sale_professionals`

**Schema:**
- Reaproveita `sales` (1 linha por item da comanda) + `sale_professionals` já existente
- Adiciona `sales.gross_amount`, `sales.fee_amount`, `sales.net_amount`, `sales.card_machine_id`, `sales.installments`
- Trigger `sync_sale_to_cash_flow` passa a registrar 2 entradas quando houver taxa: receita líquida (categoria Serviço) + despesa (categoria "Taxa de cartão") — mantém compatibilidade

---

### 2. Agendamento com Cliente Obrigatório

- Substituir o `Select` de cliente por **Combobox com busca** (nome/telefone) em `AgendaContent.tsx` e em `PublicBooking.tsx` interno
- Se nada encontrado → CTA "➕ Cadastrar novo cliente" abre **modal rápido** (nome + telefone + origem) sem fechar o modal de agendamento
- Após salvar → cliente fica automaticamente selecionado
- Validação: bloqueia submit sem `client_id`

---

### 3. Taxas de Cartão (Financeiro)

**Novas tabelas:**
- `card_machines` (id, establishment_id, name, active)
- `card_machine_fees` (machine_id, payment_type: `debit`/`credit`/`credit_installment`, installments INT NULL, fee_percentage NUMERIC)

**UI:**
- Nova aba em **Configurações** → "Maquininhas & Taxas"
- CRUD de maquininhas + tabela de taxas por modalidade/parcelas
- Usada pela Comanda na hora de finalizar pagamento

---

### 4. Tipos de Comissão por Colaborador

**Schema (`professionals`):**
- `commission_type` TEXT default `'per_service'` → `per_service` | `fixed_daily` | `custom_percentage`
- `custom_percentage` NUMERIC (usado se `custom_percentage`)
- `daily_amount` NUMERIC (usado se `fixed_daily`)

**Cálculo na comanda:**
- `per_service` → usa `services.commission_solo` (% do serviço) ÷ nº de profissionais
- `custom_percentage` → usa o % próprio do colaborador sobre o valor do item
- `fixed_daily` → não gera comissão por venda; aparece como custo fixo do dia (futuro: relatório separado)

**UI:** novo bloco no cadastro do profissional em `Settings`.

---

### 5. Comissão Automática por Serviço

Já temos `services.commission_solo`. Vou:
- Simplificar a UI do serviço para 1 campo "% de comissão" (mantém colunas legadas no banco)
- Na comanda: comissão total = `valor × %` ÷ `nº profissionais` (divisão igualitária automática)
- Grava snapshot em `sale_professionals` (já existe)

---

### Arquivos principais a tocar
**Backend (migration única):**
- `sales`: novos campos financeiros
- `professionals`: tipo de comissão
- novas tabelas `card_machines`, `card_machine_fees`
- atualiza trigger `sync_sale_to_cash_flow` para lançar taxa como despesa

**Frontend:**
- `src/pages/Sales.tsx` → reescrita como **Comanda** (com lista de itens, taxa, finalização)
- `src/components/ClientCombobox.tsx` (novo) — busca + criar inline, reutilizado em Agenda e Comanda
- `src/pages/components/AgendaContent.tsx` → trocar Select por Combobox
- `src/pages/Services.tsx` → simplificar comissão para 1 campo
- `src/pages/Settings.tsx` → novas abas "Maquininhas" e bloco "Tipo de comissão" em profissionais
- `src/pages/PublicBooking.tsx` → ajustes mínimos

---

### Riscos / compatibilidade
- Vendas antigas continuam funcionando (campos novos são opcionais)
- Sem `card_machine_id` → sem taxa (comportamento atual)
- Triggers de fluxo de caixa preservam o que já existe

Posso seguir? Se quiser, começo só pela **Comanda + Cliente obrigatório** (itens 1 e 2) nesta primeira leva e fazemos Taxas/Comissão depois — me diz qual escopo libera.