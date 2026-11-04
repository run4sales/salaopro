import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const enabled = process.env.AMBASSADOR_TEST_PORT === '55439';
function sql(query) {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-h', '127.0.0.1', '-p', '55439', '-U', 'nobody', '-d', 'postgres'], { input: query, encoding: 'utf8', env: { ...process.env, PGSSLMODE: 'disable', PGPASSWORD: '' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split('\n').filter(line => !/^(BEGIN|ROLLBACK|INSERT|UPDATE|SET)/.test(line));
}
const fixture = `BEGIN;
INSERT INTO public.ambassadors(id,name,code) VALUES('10000000-0000-0000-0000-000000000001','Ambassador fixture','fixture');
INSERT INTO auth.users(id,raw_user_meta_data) VALUES('20000000-0000-0000-0000-000000000001','{"ambassador_ref":"fixture"}');
INSERT INTO public.profiles(id,user_id,business_name) VALUES('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Salon fixture');
INSERT INTO public.subscriptions(id,establishment_id,plan_id) VALUES('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001');`;
const invoice = (id, month, status = 'RECEIVED') => `INSERT INTO public.subscription_payments(id,establishment_id,subscription_id,asaas_payment_id,value,status,due_date,payment_date)
VALUES('${id}','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','${id}',100,'${status}','2026-${month}-10','2026-${month}-10T12:00:00Z');`;
const first = '60000000-0000-0000-0000-000000000001';
const second = '60000000-0000-0000-0000-000000000002';
for (const plan of ['individual', 'profissional', 'empresa']) {
  test(`${plan}: first month commission is exactly 50%, not added to recurring`, { skip: !enabled }, () => {
    const result = sql(`${fixture} UPDATE public.subscription_plans SET slug='${plan}'; ${invoice(first, '10')} SELECT sum(amount) FROM public.ambassador_commission_entries; ROLLBACK;`);
    assert.equal(result.at(-1), '50.00');
  });
  test(`${plan}: following months pay ${plan === 'individual' ? 15 : 20}%`, { skip: !enabled }, () => {
    const result = sql(`${fixture} UPDATE public.subscription_plans SET slug='${plan}'; ${invoice(first, '10')} ${invoice(second, '11')} SELECT sum(amount) FROM public.ambassador_commission_entries WHERE payment_id='${second}'; ROLLBACK;`);
    assert.equal(result.at(-1), plan === 'individual' ? '15.00' : '20.00');
  });
}
test('unpaid and manual receipts never generate commission', { skip: !enabled }, () => {
  const result = sql(`${fixture} ${invoice(first, '10', 'OVERDUE')} ${invoice(second, '11')} UPDATE public.subscription_payments SET payment_source='manual' WHERE id='${second}'; SELECT coalesce(sum(amount),0) FROM public.ambassador_commission_entries; ROLLBACK;`);
  assert.equal(Number(result.at(-1)), 0);
});
test('repeated paid updates do not duplicate commissions, refund reverses once', { skip: !enabled }, () => {
  const result = sql(`${fixture} ${invoice(first, '10')} UPDATE public.subscription_payments SET status='CONFIRMED' WHERE id='${first}'; SELECT count(*) FROM public.ambassador_commission_entries; UPDATE public.subscription_payments SET status='REFUNDED' WHERE id='${first}'; UPDATE public.subscription_payments SET status='REFUNDED' WHERE id='${first}'; SELECT sum(amount) FROM public.ambassador_commission_entries; SELECT count(*) FROM public.ambassador_commission_entries; ROLLBACK;`);
  assert.deepEqual(result.slice(-3), ['1', '0.00', '2']);
});
test('late older paid invoice corrects first month without duplicating balance', { skip: !enabled }, () => {
  const result = sql(`${fixture} ${invoice(second, '11')} ${invoice(first, '10')} SELECT sum(amount) FROM public.ambassador_commission_entries WHERE payment_id='${second}'; SELECT sum(amount) FROM public.ambassador_commission_entries; ROLLBACK;`);
  assert.deepEqual(result.slice(-2), ['15.00', '65.00']);
});
test('plan changes affect new invoices without repricing prior invoices', { skip: !enabled }, () => {
  const result = sql(`${fixture} ${invoice(first, '10')} UPDATE public.subscription_plans SET slug='empresa'; ${invoice(second, '11')} UPDATE public.subscription_payments SET status='CONFIRMED' WHERE id='${first}'; SELECT ambassador_plan_slug FROM public.subscription_payments WHERE id='${first}'; SELECT sum(amount) FROM public.ambassador_commission_entries WHERE payment_id='${second}'; ROLLBACK;`);
  assert.deepEqual(result.slice(-2), ['individual', '20.00']);
});
test('payout retries return the same receipt and cannot exceed available balance', { skip: !enabled }, () => {
  const call = `public.register_ambassador_payout('10000000-0000-0000-0000-000000000001',30,current_date-1,'PIX-fixture','','70000000-0000-0000-0000-000000000001')`;
  const result = sql(`${fixture} ${invoice(first, '10')} SET LOCAL request.jwt.claim.sub='20000000-0000-0000-0000-000000000001'; SELECT ${call}; SELECT ${call}; SELECT count(*) FROM public.ambassador_payouts; SELECT sum(amount) FROM public.ambassador_payouts; DO $$ BEGIN PERFORM public.register_ambassador_payout('10000000-0000-0000-0000-000000000001',21,current_date-1,'PIX-fixture','','70000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'Test must fail'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Valor maior que o saldo disponível' THEN RAISE; END IF; END; $$; ROLLBACK;`);
  assert.equal(result[0], result[1]);
  assert.deepEqual(result.slice(2, 4), ['1', '30.00']);
});
test('unknown plan holds commission rather than inventing a rate', { skip: !enabled }, () => {
  const result = sql(`${fixture} UPDATE public.subscription_plans SET slug='unknown'; ${invoice(first, '10')} SELECT count(*) FROM public.ambassador_commission_entries; ROLLBACK;`);
  assert.equal(result.at(-1), '0');
});
test('non-admin cannot read report or register payouts', { skip: !enabled }, () => {
  const result = sql(`BEGIN; DO $$ BEGIN PERFORM public.admin_ambassador_report(); RAISE EXCEPTION 'Test must fail'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; $$; DO $$ BEGIN PERFORM public.register_ambassador_payout(gen_random_uuid(),1,current_date-1,'PIX-fixture','',gen_random_uuid()); RAISE EXCEPTION 'Test must fail'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; $$; SELECT 'access-denied'; ROLLBACK;`);
  assert.equal(result.at(-1), 'access-denied');
});