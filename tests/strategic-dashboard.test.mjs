import assert from "node:assert/strict";
import test from "node:test";
import { calculateStrategicDashboard, isFutureAppointment } from "../src/lib/finance/strategicDashboard.ts";

const tomorrow = "2026-09-21T03:00:00.000Z";
const monthEnd = "2026-10-01T03:00:00.000Z";
const appointment = (status, service_amount, appointment_date = "2026-09-25T15:00:00.000Z") => ({ status, service_amount, appointment_date });
const sales = (amounts) => amounts.map((amount, i) => ({ id: String(i), client_id: String(i), amount }));
const calculate = (s, a, goal) => calculateStrategicDashboard(s, a, goal, tomorrow, monthEnd);

test("realizado + agendado = projetado e falta para meta", () => {
  const result = calculate(sales([7000]), [appointment("confirmed", 2150)], 10000);
  assert.equal(result.projected, 9150);
  assert.equal(result.remaining, 850);
});

test("meta superada não gera falta negativa", () => {
  const result = calculate(sales([9000]), [appointment("scheduled", 2000)], 10000);
  assert.equal(result.projected, 11000);
  assert.equal(result.remaining, 0);
});

test("arredonda atendimentos necessários para cima", () => {
  const result = calculate(sales([228]), [], 1078);
  assert.equal(result.ticket, 228);
  assert.equal(result.needed, 4);
});

test("sem clientes, ticket é zero sem divisão por zero", () => {
  const result = calculate([], [], 1000);
  assert.equal(result.ticket, 0);
  assert.equal(result.needed, null);
});

test("clientes únicos mesmo com vendas repetidas", () => {
  const result = calculate([{ id: "1", client_id: "c", amount: 100 }, { id: "2", client_id: "c", amount: 200 }], [], null);
  assert.equal(result.clients, 1);
  assert.equal(result.ticket, 300);
  assert.equal(result.remaining, null);
});

test("hoje, cancelados, concluídos e fora do mês não são futuros", () => {
  const values = [appointment("confirmed", 500, "2026-09-20T16:00:00.000Z"), appointment("canceled", 500), appointment("completed", 500), appointment("confirmed", 500, "2026-10-02T15:00:00.000Z")];
  assert.equal(calculate([], values, 1000).futureCount, 0);
  assert.equal(values.some((a) => isFutureAppointment(a, tomorrow, monthEnd)), false);
});

test("valor negociado zero ou diferente do serviço permanece no snapshot", () => {
  const result = calculate([], [appointment("confirmed", 250), appointment("scheduled", 0)], null);
  assert.equal(result.forecast, 250);
  assert.equal(result.futureCount, 2);
});