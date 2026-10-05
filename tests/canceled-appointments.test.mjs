import assert from "node:assert/strict";
import test from "node:test";
import { isCanceledAppointment, summarizeCanceledAppointments } from "../src/lib/canceledAppointments.ts";

test("reconhece o status canônico e grafias históricas de cancelamento", () => {
  assert.equal(isCanceledAppointment({ status: "canceled" }), true);
  assert.equal(isCanceledAppointment({ status: "cancelled" }), true);
  assert.equal(isCanceledAppointment({ status: "Cancelado" }), true);
  assert.equal(isCanceledAppointment({ status: "scheduled" }), false);
});

test("totaliza somente cancelados pelo valor original do agendamento", () => {
  assert.deepEqual(summarizeCanceledAppointments([
    { status: "canceled", service_amount: 450 },
    { status: "cancelled", service_amount: "50.50" },
    { status: "scheduled", service_amount: 999 },
  ]), { count: 2, amount: 500.5 });
});