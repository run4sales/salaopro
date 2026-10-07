import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSingleFlight } from "../src/lib/singleFlight.ts";

test("double clicks cannot start concurrent validation or appointment writes", async () => {
  const gate = createSingleFlight();
  let release;
  let writes = 0;
  const pending = gate.run(async () => {
    writes++;
    await new Promise(resolve => { release = resolve; });
  });
  assert.equal(await gate.run(async () => { writes++; }), false);
  release();
  assert.equal(await pending, true);
  assert.equal(writes, 1);
});

test("a failed save releases the gate for a deliberate retry", async () => {
  const gate = createSingleFlight();
  await assert.rejects(gate.run(async () => { throw new Error("write failed"); }));
  assert.equal(await gate.run(async () => {}), true);
});

test("partial saves retain their appointment ID rather than inserting another row", () => {
  const source = readFileSync(new URL("../src/components/agenda/AppointmentFormDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /appointment\?\.id \?\? savedAppointmentId\.current/);
  assert.match(source, /savedAppointmentId\.current = data\.id/);
  assert.equal((source.match(/\.from\("appointments"\)\.insert\(/g) ?? []).length, 1);
  assert.match(source, /saveGate\.current\.run/);
});

test("catalog refresh cannot reset the save identity and partial saves do not conflict with themselves", () => {
  const source = readFileSync(new URL("../src/components/agenda/AppointmentFormDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(initializedSession\.current === session\) return/);
  assert.match(source, /findAgendaConflicts\(start, end, form\.professional_ids, occupied, appointment\?\.id \?\? savedAppointmentId\.current\)/);
});

test("lost insert responses reuse a stable request ID and recover only that appointment", () => {
  const source = readFileSync(new URL("../src/components/agenda/AppointmentFormDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /insert\(\{ \.\.\.payload, id: requestId \}\)/);
  assert.match(source, /creationRequestId\.current = requestId/);
  assert.match(source, /\.eq\("id", requestId\)\.eq\("establishment_id", establishmentId\)/);
  assert.match(source, /savedAppointmentId\.current = recovered\.id/);
});

test("appointment imports acquire a synchronous gate and cannot close during writes", () => {
  const source = readFileSync(new URL("../src/components/agenda/ImportAppointmentsDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /importGate\.current\.run/);
  assert.match(source, /if \(importing\) return/);
  assert.match(source, /onClick=\{importOnce\} disabled=\{importing \|\| validRows\.length === 0\}/);
});