import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getBlockPersistenceErrorMessage } from "../src/lib/appointmentBlockErrors.ts";

test("permission failures are not misreported as missing block tables", () => {
  const message = getBlockPersistenceErrorMessage({ code: "42501", message: 'new row violates row-level security policy for table "appointment_blocks"' });
  assert.match(message, /profissional vinculado/);
  assert.doesNotMatch(message, /indisponível|migrations/);
});
test("missing schema errors remain distinct from authorization failures", () => {
  assert.match(getBlockPersistenceErrorMessage({ code: "PGRST205" }), /temporariamente indisponível/);
  assert.equal(getBlockPersistenceErrorMessage({ message: "Intervalo inválido" }), "Intervalo inválido");
});
test("block policy resolves authenticated ownership with both tenant and professional", () => {
  const sql = readFileSync(new URL("../drizzle/migrations/0003_fix_employee_own_appointment_block_access.sql", import.meta.url), "utf8");
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /auth.uid\(\) IS NOT NULL/);
  assert.match(sql, /eu.user_id = auth.uid\(\)/);
  assert.match(sql, /eu.establishment_id = p_establishment/);
  assert.match(sql, /eu.professional_id = p_professional/);
  assert.match(sql, /eu.role = 'employee'/);
  assert.match(sql, /eu.active = true/);
  assert.match(sql, /WITH CHECK \(public.can_manage_appointment_block/);
});