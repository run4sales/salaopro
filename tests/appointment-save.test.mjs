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