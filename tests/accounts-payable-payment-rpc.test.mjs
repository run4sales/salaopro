import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260803120000_canonical_pay_expense_rpc.sql", "utf8");
const rpcArgs = ["p_id", "p_payment_date", "p_amount", "p_method", "p_account", "p_interest", "p_fine", "p_discount", "p_notes"];

test("pay_expense repair removes overloads and publishes the canonical contract", () => {
  assert.match(migration, /p\.proname = 'pay_expense'/);
  const signature = migration.match(/CREATE OR REPLACE FUNCTION public\.pay_expense\(([\s\S]*?)\)\s*RETURNS public\.expenses/)?.[1] ?? "";
  assert.deepEqual([...signature.matchAll(/^\s*(p_[a-z_]+)\s+/gm)].map((match) => match[1]), rpcArgs);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
  assert.doesNotMatch(migration, /ALTER TABLE public\.expenses/);
});

test("pay_expense always settles the expense and persists payment metadata", () => {
  assert.match(migration, /SET paid_amount = amount,\s*status = 'paid'/);
  assert.match(migration, /INSERT INTO public\.expense_payments \([\s\S]*payment_date, amount, interest, fine,[\s\S]*discount, payment_method, financial_account, notes/);
  assert.match(migration, /p_amount \+ interest_amount \+ fine_amount - discount_amount/);
  assert.match(migration, /updated_at = now\(\)/);
  assert.match(migration, /status = 'paid'.*paid_amount >= expense_before\.amount/s);
  assert.match(migration, /RAISE EXCEPTION 'Despesa já está paga'/);
  assert.match(migration, /FOR UPDATE/);
});

test("every frontend pay_expense call sends only canonical named arguments", () => {
  for (const file of ["src/pages/AccountsPayablePayment.tsx", "src/pages/AccountsPayable.tsx", "src/pages/Expenses.tsx"]) {
    const source = readFileSync(file, "utf8");
    const call = source.match(/rpc\(["']pay_expense["'],\s*\{([\s\S]*?)\}\)/)?.[1] ?? "";
    assert.ok(call, `missing pay_expense call in ${file}`);
    assert.deepEqual(new Set([...call.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((match) => match[1])), new Set(rpcArgs));
  }
});

test("financial adjustments produce the persisted effective payment amount", () => {
  const cases = [
    { principal: 100, discount: 0, interest: 0, fine: 0, expected: 100 },
    { principal: 100, discount: 10, interest: 0, fine: 0, expected: 90 },
    { principal: 100, discount: 0, interest: 7, fine: 0, expected: 107 },
    { principal: 100, discount: 0, interest: 0, fine: 5, expected: 105 },
    { principal: 100, discount: 0, interest: 7, fine: 5, expected: 112 },
  ];
  for (const item of cases)
    assert.equal(item.principal + item.interest + item.fine - item.discount, item.expected);
});
