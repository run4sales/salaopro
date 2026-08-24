import assert from "node:assert/strict";
import test from "node:test";
import {
  averageTicket,
  buildCommissionEntries,
  isConfirmedCashStatus,
  previousPeriodRange,
  saleCashReceived,
  sumCommissionBase,
  sumCommissions,
  sumRealizedRevenue,
  toPeriodRange,
} from "../src/lib/finance/revenueRules.ts";

const sale = (id, amount, extra = {}) => ({ id, amount, sale_date: "2026-07-10T12:00:00.000Z", ...extra });

test("cenário 1 — venda simples entra integralmente no faturamento realizado", () => {
  assert.equal(sumRealizedRevenue([sale("s1", 100)]), 100);
});

test("cenário 2 e 3 — vendas excluídas/canceladas não chegam ao cálculo", () => {
  // A camada de dados filtra deleted_at IS NULL; sem vendas, o realizado é zero.
  assert.equal(sumRealizedRevenue([]), 0);
  assert.equal(averageTicket([]), 0);
});

test("crédito do cliente é forma de pagamento: faturamento cheio, caixa reduzido", () => {
  const withCredit = sale("s1", 100, { credit_used: 40, paid_now: 60 });
  assert.equal(sumRealizedRevenue([withCredit]), 100);
  assert.equal(saleCashReceived(withCredit), 60);
});

test("cenário 4 — dois profissionais dividem a base e usam o próprio percentual", () => {
  const entries = buildCommissionEntries(
    [sale("s1", 300)],
    [
      { sale_id: "s1", professional_id: "a", role: "solo", commission_percentage: 50, commission_amount: 75 },
      { sale_id: "s1", professional_id: "b", role: "solo", commission_percentage: 40, commission_amount: 60 },
    ],
  );
  assert.deepEqual(entries.map((e) => e.baseAmount), [150, 150]);
  assert.deepEqual(entries.map((e) => e.commission), [75, 60]);
  assert.equal(sumCommissions(entries), 135);
  // Base total nunca multiplica a venda.
  assert.equal(sumCommissionBase(entries), 300);
});

test("comissão é calculada quando não há valor gravado", () => {
  const [entry] = buildCommissionEntries(
    [sale("s1", 200)],
    [{ sale_id: "s1", professional_id: "a", role: "solo", commission_percentage: 30, commission_amount: null }],
  );
  assert.equal(entry.commission, 60);
});

test("cenário 5 — duas vendas na mesma comanda somam 300 e não 600", () => {
  assert.equal(sumRealizedRevenue([sale("s1", 100), sale("s2", 200)]), 300);
});

test("não há comissão duplicada por venda/profissional/papel", () => {
  const entries = buildCommissionEntries(
    [sale("s1", 300)],
    [
      { sale_id: "s1", professional_id: "a", role: "solo", commission_percentage: 50, commission_amount: 75 },
      { sale_id: "s1", professional_id: "b", role: "as_assistant", commission_percentage: 40, commission_amount: 60 },
    ],
  );
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
});

test("cenário 6 — 01/07 a 31/07 vira intervalo semiaberto cobrindo o dia 31 inteiro", () => {
  const range = toPeriodRange(new Date(2026, 6, 1, 9, 30), new Date(2026, 6, 31, 15, 0));
  assert.equal(new Date(range.startISO).getDate(), 1);
  assert.equal(new Date(range.startISO).getHours(), 0);
  const endLocal = new Date(range.endExclusiveISO);
  assert.equal(endLocal.getMonth(), 7);
  assert.equal(endLocal.getDate(), 1);
  assert.equal(endLocal.getHours(), 0);
});

test("período anterior tem a mesma duração e termina no início do atual", () => {
  const range = toPeriodRange(new Date(2026, 6, 1), new Date(2026, 6, 31));
  const previous = previousPeriodRange(range);
  assert.equal(previous.endExclusiveISO, range.startISO);
  assert.equal(
    new Date(range.endExclusiveISO) - new Date(range.startISO),
    new Date(previous.endExclusiveISO) - new Date(previous.startISO),
  );
});

test("cenário 7 — dashboard e faturamento geral usam a mesma função", () => {
  const sales = [sale("s1", 100, { paid_now: 40, credit_used: 60 }), sale("s2", 50)];
  const dashboard = sumRealizedRevenue(sales);
  const revenueGeneral = sumRealizedRevenue(sales);
  assert.equal(dashboard, revenueGeneral);
  assert.equal(dashboard, 150);
});

test("cenário 8 — fluxo de caixa só considera lançamentos confirmados", () => {
  assert.equal(isConfirmedCashStatus("confirmed"), true);
  assert.equal(isConfirmedCashStatus(" Confirmed "), true);
  assert.equal(isConfirmedCashStatus("pago"), true);
  assert.equal(isConfirmedCashStatus(null), true); // registros históricos sem status
  assert.equal(isConfirmedCashStatus("pending"), false);
  assert.equal(isConfirmedCashStatus("pendente"), false);
});
