import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("database guard serializes exact inserts and preserves canceled history", () => {
  const sql = readFileSync(new URL("../drizzle/migrations/0006_prevent_exact_duplicate_appointments.sql", import.meta.url), "utf8");
  assert.match(sql, /pg_advisory_xact_lock/);
  for (const column of ["establishment_id", "client_id", "appointment_date", "service_id"]) {
    assert.ok(sql.includes(`a.${column} = NEW.${column}`));
  }
  assert.match(sql, /a\.professional_id IS NOT DISTINCT FROM NEW\.professional_id/);
  assert.match(sql, /a\.status IS DISTINCT FROM 'canceled'/);
  assert.match(sql, /a\.status IS DISTINCT FROM 'cancelled'/);
  assert.match(sql, /BEFORE INSERT ON public\.appointments/);
  assert.doesNotMatch(sql, /DELETE FROM|UPDATE public\.appointments/);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/);
});