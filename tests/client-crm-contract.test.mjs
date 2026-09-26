import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clients = readFileSync(new URL("../src/pages/Clients.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../src/components/clients/ClientProfileDialog.tsx", import.meta.url), "utf8");
const combobox = readFileSync(new URL("../src/components/ClientCombobox.tsx", import.meta.url), "utf8");

test("client creation requires only a non-empty name", () => {
  assert.match(clients, /if \(!newClient\.name\.trim\(\)\) return/);
  assert.match(clients, /validatePhone\(newClient\.phone, \{ required: false \}\)/);
});

test("the complete client record exposes real CRM sources", () => {
  for (const source of ["appointments", "sales", "customer_packages", "customer_service_subscriptions", "client_credit_transactions", "service_benefit_consumptions"]) assert.match(profile, new RegExp(source));
  assert.match(profile, /normalizeStatus\(item\.status\) === "completed"/);
  assert.match(profile, /is\("deleted_at", null\)/);
});

test("quick registration was replaced by the complete client record", () => {
  assert.doesNotMatch(combobox, /Cadastro rápido|from\("clients"\)\.insert/);
  assert.match(combobox, /\/clients\?new=1/);
});