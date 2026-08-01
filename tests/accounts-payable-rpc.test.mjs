import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260801090000_repair_pay_expense_rpc.sql", "utf8");
const rpcArgs = ["p_id", "p_payment_date", "p_amount", "p_method", "p_account", "p_interest", "p_fine", "p_discount", "p_notes"];

test("pay_expense repair removes overloads and publishes the canonical contract", () => {
  assert.match(migration, /p\.proname = 'pay_expense'/);
  const signature = migration.match(/CREATE FUNCTION public\.pay_expense\(([\s\S]*?)\)\s*RETURNS public\.expenses/)?.[1] ?? "";
  assert.deepEqual([...signature.matchAll(/^\s*(p_[a-z_]+)\s+/gm)].map((match) => match[1]), rpcArgs);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
});

test("pay_expense always settles the expense and persists payment metadata", () => {
  assert.match(migration, /SET paid_amount = amount,\s*status = 'paid'/);
  for (const assignment of ["payment_date = p_payment_date", "payment_method = p_method", "discount = discount_amount", "fine = fine_amount", "interest = interest_amount", "updated_at = now()"])
    assert.ok(migration.includes(assignment), `missing assignment: ${assignment}`);
});

test("every frontend pay_expense call sends only canonical named arguments", () => {
  for (const file of ["src/pages/AccountsPayable.tsx", "src/pages/Expenses.tsx"]) {
    const source = readFileSync(file, "utf8");
    const call = source.match(/rpc\(["']pay_expense["'],\s*\{([\s\S]*?)\}\)/)?.[1] ?? "";
    assert.ok(call, `missing pay_expense call in ${file}`);
    assert.deepEqual(new Set([...call.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((match) => match[1])), new Set(rpcArgs));
  }
});
