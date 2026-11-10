import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const enabled = process.env.BEAUTY_AI_TEST_PORT === '55441';
function sql(query) {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-h', '127.0.0.1', '-p', '55441', '-U', 'postgres', '-d', 'postgres'], { input: query, encoding: 'utf8', env: { ...process.env, PGSSLMODE: 'disable', PGPASSWORD: '' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split('\n').filter(line => !/^(BEGIN|ROLLBACK|INSERT|UPDATE|SET)/.test(line));
}

const SALON = '30000000-0000-0000-0000-000000000001';
const PLAN = '50000000-0000-0000-0000-000000000001';
const fixture = `BEGIN;
INSERT INTO public.profiles(id,user_id,business_name) VALUES('${SALON}','20000000-0000-0000-0000-000000000002','Salon fixture');
INSERT INTO public.subscriptions(id,establishment_id,plan_id) VALUES('40000000-0000-0000-0000-000000000001','${SALON}','${PLAN}');`;
const consume = `SELECT public.consume_beauty_ai_interaction('${SALON}') ->> 'allowed';`;

test('plano Individual nunca é elegível, mesmo liberado pelo super admin', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='individual';
    INSERT INTO public.beauty_ai_settings(establishment_id,enabled) VALUES('${SALON}',true);
    ${consume} ROLLBACK;`);
  assert.equal(result.at(-1), 'false');
});

test('plano Profissional sem liberação do super admin não acessa', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='profissional';
    ${consume} ROLLBACK;`);
  assert.equal(result.at(-1), 'false');
});

test('plano Profissional liberado pelo super admin acessa', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='profissional';
    INSERT INTO public.beauty_ai_settings(establishment_id,enabled) VALUES('${SALON}',true);
    ${consume} ROLLBACK;`);
  assert.equal(result.at(-1), 'true');
});

test('plano Empresa liberado acessa', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='empresa';
    INSERT INTO public.beauty_ai_settings(establishment_id,enabled) VALUES('${SALON}',true);
    ${consume} ROLLBACK;`);
  assert.equal(result.at(-1), 'true');
});

test('limite mensal bloqueia a interação seguinte ao esgotamento', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='profissional';
    INSERT INTO public.beauty_ai_settings(establishment_id,enabled,monthly_limit) VALUES('${SALON}',true,2);
    ${consume} ${consume} ${consume}
    SELECT usage_count FROM public.beauty_ai_settings WHERE establishment_id='${SALON}';
    ROLLBACK;`);
  assert.deepEqual(result.slice(-2), ['false', '2']);
});

test('novo ciclo mensal renova o contador automaticamente', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='profissional';
    INSERT INTO public.beauty_ai_settings(establishment_id,enabled,monthly_limit,usage_count,usage_period) VALUES('${SALON}',true,2,2,'2020-01');
    ${consume}
    SELECT usage_count FROM public.beauty_ai_settings WHERE establishment_id='${SALON}';
    ROLLBACK;`);
  assert.deepEqual(result.slice(-2), ['true', '1']);
});

test('assinatura irregular bloqueia mesmo com plano e liberação', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='profissional';
    INSERT INTO public.beauty_ai_settings(establishment_id,enabled) VALUES('${SALON}',true);
    SET LOCAL test.subscription_state='blocked';
    ${consume} ROLLBACK;`);
  assert.equal(result.at(-1), 'false');
});

test('estorno devolve a interação consumida sem ficar negativo', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    UPDATE public.subscription_plans SET slug='profissional';
    INSERT INTO public.beauty_ai_settings(establishment_id,enabled,monthly_limit) VALUES('${SALON}',true,2);
    ${consume}
    SELECT public.refund_beauty_ai_interaction('${SALON}',NULL,'falha de IA');
    SELECT public.refund_beauty_ai_interaction('${SALON}',NULL,'falha de IA');
    SELECT usage_count FROM public.beauty_ai_settings WHERE establishment_id='${SALON}';
    ROLLBACK;`);
  assert.equal(result.at(-1), '0');
});

test('somente super admin libera acesso e vê o relatório', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    DO $$ BEGIN PERFORM public.admin_set_beauty_ai_access('${SALON}',true); RAISE EXCEPTION 'Test must fail'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Acesso restrito ao super administrador' THEN RAISE; END IF; END; $$;
    DO $$ BEGIN PERFORM public.admin_beauty_ai_report(); RAISE EXCEPTION 'Test must fail'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Acesso restrito ao super administrador' THEN RAISE; END IF; END; $$;
    SET LOCAL request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
    SELECT (public.admin_set_beauty_ai_access('${SALON}',true,77) ->> 'enabled');
    SELECT (public.admin_beauty_ai_report() -> 0 ->> 'monthly_limit');
    ROLLBACK;`);
  assert.deepEqual(result.slice(-2), ['true', '77']);
});

test('faturamento realizado ignora vendas excluídas e calcula ticket médio', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    INSERT INTO public.sales(establishment_id,amount,sale_date,payment_method) VALUES
      ('${SALON}',100,now(),'pix'),('${SALON}',200,now(),'credit'),('${SALON}',999,now(),'pix');
    UPDATE public.sales SET deleted_at=now() WHERE amount=999;
    SELECT public.beauty_ai_revenue_summary('${SALON}',now()-interval '1 day',now()+interval '1 day') -> 'current' ->> 'realized_revenue';
    SELECT public.beauty_ai_revenue_summary('${SALON}',now()-interval '1 day',now()+interval '1 day') -> 'current' ->> 'average_ticket';
    ROLLBACK;`);
  assert.deepEqual(result.slice(-2), ['300.00', '150.00']);
});

test('clientes inativos respeitam o corte de dias e separam faixas', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    INSERT INTO public.clients(establishment_id,name,last_service_date) VALUES
      ('${SALON}','Recente',now()-interval '5 days'),
      ('${SALON}','Ha 40 dias',now()-interval '40 days'),
      ('${SALON}','Ha 100 dias',now()-interval '100 days'),
      ('${SALON}','Nunca veio',NULL);
    SELECT public.beauty_ai_inactive_clients('${SALON}',30) ->> 'total_inactive';
    SELECT public.beauty_ai_inactive_clients('${SALON}',30) -> 'buckets' ->> 'over_90_days';
    SELECT public.beauty_ai_inactive_clients('${SALON}',30) -> 'buckets' ->> 'never_attended';
    ROLLBACK;`);
  assert.deepEqual(result.slice(-3), ['3', '1', '1']);
});

test('previsão usa apenas agendamentos futuros não cancelados', { skip: !enabled }, () => {
  const result = sql(`${fixture}
    INSERT INTO public.appointments(establishment_id,service_amount,appointment_date,status) VALUES
      ('${SALON}',80,now()+interval '2 days','scheduled'),
      ('${SALON}',120,now()+interval '3 days','canceled'),
      ('${SALON}',50,now()-interval '3 days','scheduled');
    SELECT public.beauty_ai_forecast('${SALON}') -> 'future_appointments' ->> 'expected_amount';
    ROLLBACK;`);
  assert.equal(result.at(-1), '80.00');
});

test('funções de consumo e consultas não são executáveis por authenticated', { skip: !enabled }, () => {
  const result = sql(`BEGIN;
    SET LOCAL ROLE authenticated;
    DO $$ BEGIN PERFORM public.consume_beauty_ai_interaction('${SALON}'); RAISE EXCEPTION 'Test must fail'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; $$;
    DO $$ BEGIN PERFORM public.beauty_ai_revenue_summary('${SALON}',now(),now()); RAISE EXCEPTION 'Test must fail'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; $$;
    SELECT 'access-denied'; ROLLBACK;`);
  assert.equal(result.at(-1), 'access-denied');
});
