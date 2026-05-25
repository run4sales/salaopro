# Módulo Agenda + Atendimento + PDV (Beauty Core)

Escopo grande. Proposta de entrega **em 3 ondas** para reduzir risco e validar cada parte antes da próxima.

---

## 🌊 Onda 1 — Agenda visual estilo Google Calendar

**Objetivo:** transformar a tela `Agenda` (hoje só tabela) num calendário visual com 3 visões.

### UI
- Nova lib: `react-big-calendar` (leve, integra bem com shadcn/Tailwind).
- Visões: **Dia / Semana (default) / Mês**.
- Cada evento = bloco colorido por status:
  - 🟡 `scheduled` (Agendado)
  - 🔵 `confirmed` (Confirmado)
  - 🟢 `in_service` (Em atendimento) — **novo status**
  - ⚫ `completed` (Finalizado)
  - 🔴 `canceled` (Cancelado)
- Bloco mostra: hora · cliente · serviço.
- Toggle "Calendário / Lista" no topo (mantém a tabela atual como fallback).

### Interações
- Clique em horário vazio → modal **Novo agendamento** (reaproveita o existente, pré-preenchendo data/hora).
- Clique em evento → **Popover de detalhes** com: cliente, serviço, profissional, valor estimado e botões:
  - ✏️ Editar  · ▶️ Iniciar atendimento  · ❌ Cancelar
- Clique no dia (visão Mês) → drill-down para visão Dia.
- (Extra Onda 1) Drag-and-drop para reagendar (mover bloco no grid).

### Banco
- Migração: adicionar `'in_service'` como valor aceito de `appointments.status` (já é text livre, só formalizar nas constantes do front).

### Arquivos
- `src/pages/components/AgendaContent.tsx` — refactor: dividir em `AgendaCalendar.tsx` + `AgendaList.tsx`.
- `src/components/agenda/AppointmentDetailsPopover.tsx` — novo.
- `src/components/agenda/AppointmentFormDialog.tsx` — extrair modal atual.
- `src/index.css` — estilos do `react-big-calendar` mapeados nos tokens.

---

## 🌊 Onda 2 — Importação / Exportação de Agendamentos

**Reaproveita** a infra de `src/lib/clientImportExport.ts` e `ImportClientsDialog.tsx`.

### Importação (CSV/XLSX)
Colunas esperadas (auto-mapeamento heurístico):
`Data` · `Hora` · `Cliente` · `Telefone` · `Serviço` · `Profissional` · `Valor` · `Status` · `Observações`

Regras:
- Cliente inexistente → cria automaticamente (match por telefone → nome).
- Serviço inexistente → cria com preço da planilha e `duration_minutes` default 30.
- Profissional inexistente → cria inativo + aviso.
- Data + Hora combinadas em `appointment_date` (timezone do salão).
- Deduplicação: mesmo cliente+profissional+horário não duplica.

UI: wizard reaproveitando `ImportClientsDialog` (Upload → Mapping → Preview → Result com falhas).

### Exportação
Botão no topo da Agenda com filtros: período (date range), profissional, status. Gera `.xlsx` e `.csv`.

### Arquivos
- `src/lib/appointmentImportExport.ts` — novo (espelha clientes).
- `src/components/agenda/ImportAppointmentsDialog.tsx` — novo.
- Botões "Importar" / "Exportar" no header da Agenda.

---

## 🌊 Onda 3 — Atendimentos em tempo real + Comanda + PDV

### 3a. Tela "Atendimentos em andamento"
- Nova rota `/atendimentos` no menu.
- Lista cards de appointments com `status='in_service'` ou `status='awaiting_payment'`.
- Card: cliente · serviço · profissional · início · **cronômetro** (tempo decorrido).
- Ações: ➕ Adicionar item · 🧾 Abrir comanda · 💰 Finalizar.

### 3b. Fluxo Comanda
- Tabela nova `comandas` (header) + `comanda_items` (linhas) **OU** reaproveitar `sales` já estruturada como comanda (cada `sales` row = 1 item). Proposta: **criar `comandas`** para separar "comanda em aberto" de "venda confirmada":
  ```
  comandas(id, establishment_id, appointment_id?, client_id, status[open|paid|canceled],
           subtotal, discount, total, opened_at, closed_at)
  comanda_items(id, comanda_id, kind[service|product], service_id?, name, qty,
                unit_price, total, professional_id, commission_percentage, commission_amount)
  ```
- "Iniciar atendimento" no appointment:
  1. Muda status do appointment → `in_service`.
  2. Cria `comanda` (open) com 1 item do serviço agendado.
- Tela de comanda: add/remover item, editar valor, desconto, trocar profissional.

### 3c. PDV (Finalização)
- Botão "Finalizar" na comanda → abre **modal PDV** (reaproveita parte do `Sales.tsx` atual):
  - Lista itens (read-only com conferência).
  - Forma de pagamento (Dinheiro/Pix/Débito/Crédito) + parcelas + maquininha (já existe `card_machines`).
  - Cálculo automático de taxa e líquido.
- Ao confirmar:
  - Cria N rows em `sales` (uma por item) com `fee_amount` rateado.
  - Marca `comanda.status='paid'`, `appointment.status='completed'`.
  - Triggers existentes já sincronizam cash flow + comissão.

### Arquivos
- Migração: nova tabela `comandas` + `comanda_items` (com RLS por establishment, índices por status).
- `src/pages/Attendances.tsx` — nova rota lista de atendimentos ativos.
- `src/components/comanda/ComandaDrawer.tsx` — drawer/sheet da comanda aberta.
- `src/components/comanda/PdvDialog.tsx` — modal de pagamento.
- `src/App.tsx` + `AppSidebar.tsx` — nova rota "Atendimentos".
- `Sales.tsx` — passa a listar **comandas pagas** (histórico) + ainda permite venda avulsa que cria comanda+fecha na hora.

---

## ⚙️ Detalhes técnicos transversais

- **Realtime:** habilitar `supabase_realtime` em `appointments` e `comandas` para refletir mudanças sem reload.
- **Performance da agenda:** query por janela visível (start/end do range), índice em `(establishment_id, appointment_date)`.
- **Status novo `in_service`/`awaiting_payment`:** centralizar em `src/lib/appointmentStatus.ts` (labels, cores, variants).
- **Tokens de cor:** adicionar `--status-scheduled`, `--status-confirmed`, `--status-in-service`, `--status-completed`, `--status-canceled` em `index.css`.

---

## 🚦 Sugestão de execução

Recomendo **começar pela Onda 1 (agenda visual)** isolada, pois é o que o usuário vê primeiro e desbloqueia o "Iniciar atendimento" da Onda 3. Posso entregar nesta ordem:

1. **Onda 1** completa (agenda visual + popover + drag-drop básico).
2. **Onda 3** (atendimentos + comanda + PDV) — maior valor operacional.
3. **Onda 2** (import/export) — quick win por reaproveitar infra de clientes.

**Me confirma:**
- (a) Pode seguir nessa ordem (1 → 3 → 2)?
- (b) Para a comanda, prefere **nova tabela `comandas`** (separação limpa, recomendado) ou **reaproveitar `sales`** como hoje (mais simples, menos migração)?
- (c) Libera adicionar a lib `react-big-calendar` (~30kb gzip) para a visão calendário?
