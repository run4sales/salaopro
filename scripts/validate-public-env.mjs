import { readFileSync } from 'node:fs';

function localEnv() {
  try {
    return Object.fromEntries(
      readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separator = line.indexOf('=');
          const rawValue = line.slice(separator + 1).trim();
          const value = /^(['"]).*\1$/.test(rawValue) ? rawValue.slice(1, -1) : rawValue;
          return [line.slice(0, separator), value];
        }),
    );
  } catch {
    return {};
  }
}

const values = { ...localEnv(), ...process.env };
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PROJECT_ID'];
const missing = required.filter((name) => !values[name]?.trim());

if (missing.length) {
  console.error(`Build interrompido: variáveis públicas ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

try {
  const url = new URL(values.VITE_SUPABASE_URL);
  if (url.protocol !== 'https:') throw new Error('protocol');
} catch {
  console.error('Build interrompido: VITE_SUPABASE_URL deve ser uma URL HTTPS válida.');
  process.exit(1);
}

console.log('Configuração pública do Supabase validada.');
