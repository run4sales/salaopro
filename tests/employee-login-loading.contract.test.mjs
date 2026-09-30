import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authSource = readFileSync("src/hooks/useAuth.tsx", "utf8");
const layoutSource = readFileSync("src/components/AppLayout.tsx", "utf8");
const agendaSource = readFileSync("src/components/agenda/StableAgendaContent.tsx", "utf8");

test("employee context lookups run together and stale responses are ignored", () => {
  assert.match(authSource, /Promise\.allSettled/);
  assert.match(authSource, /profileRequestRef/);
  assert.match(authSource, /if \(!isCurrent\(\)\) return/);
});

test("profile failures leave loading and expose retry", () => {
  assert.match(authSource, /setProfileError\('Não foi possível carregar seus dados\. Tente novamente\.'\)/);
  assert.match(authSource, /retryProfile/);
  assert.match(layoutSource, /Não foi possível carregar seu acesso/);
  assert.match(layoutSource, /Tentar novamente/);
});

test("employee agenda has a bounded request and visible error state", () => {
  assert.match(agendaSource, /EMPLOYEE_AGENDA_TIMEOUT_MS/);
  assert.match(agendaSource, /isEmployee && isError/);
  assert.match(agendaSource, /Não foi possível carregar sua agenda/);
});

test("subscription polling is disabled for employees", () => {
  assert.match(layoutSource, /useSubscription\(isOwner\)/);
});