#!/usr/bin/env node

const supabaseUrl = process.env.SUPABASE_URL;
const syncSecret = process.env.ASAAS_SYNC_SECRET;
if (!supabaseUrl || !syncSecret) {
  console.error('Defina SUPABASE_URL e ASAAS_SYNC_SECRET para executar a auditoria.');
  process.exit(1);
}

const response = await fetch(`${supabaseUrl}/functions/v1/asaas-sync-subscriptions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-asaas-sync-secret': syncSecret,
  },
  body: JSON.stringify({ mode: 'audit', limit: Number(process.env.ASAAS_SYNC_LIMIT ?? 2000) }),
});
const report = await response.json();
console.log(JSON.stringify(report, null, 2));
if (!response.ok || report.failed > 0) process.exitCode = 1;
