import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clients = readFileSync(new URL("../src/pages/Clients.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../src/components/clients/ClientProfileDialog.tsx", import.meta.url), "utf8");
const combobox = readFileSync(new URL("../src/components/ClientCombobox.tsx", import.meta.url), "utf8");
const bookingClient = readFileSync(new URL("../src/components/clients/BookingClientDialog.tsx", import.meta.url), "utf8");
const appointmentDetails = readFileSync(new URL("../src/components/agenda/AppointmentDetailsDialog.tsx", import.meta.url), "utf8");
const agenda = readFileSync(new URL("../src/components/agenda/StableAgendaContent.tsx", import.meta.url), "utf8");

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
  assert.doesNotMatch(combobox, /window\.location\.assign|\/clients\?new=1/);
  assert.match(combobox, /<BookingClientDialog/);
  assert.match(bookingClient, /Somente o nome é obrigatório/);
  for (const field of ["phone", "whatsapp", "email", "cpf", "nickname", "instagram", "birth_date", "address", "gender", "acquisition_source", "notes"]) assert.match(bookingClient, new RegExp(`"${field}"`));
  assert.match(bookingClient, /onCreated\(data\)/);
});

test("staff may operate their own appointment without seeing manager billing", () => {
  assert.match(agenda, /canOperate=\{establishmentRole === "owner" \|\| establishmentRole === "admin" \|\| \(isEmployee && !!professionalId && selectedAppt\?\.professional_id === professionalId\)\}/);
  assert.match(appointmentDetails, /\{canOperate && <Button variant="outline" size="sm" onClick=\{onEdit\}/);
  assert.match(appointmentDetails, /\{canOperate && !billing\?\.paid/);
  assert.match(appointmentDetails, /\{canOperate && key !== "canceled"/);
  assert.match(appointmentDetails, /\{canManage && <div className="flex justify-between border-t pt-2"/);
});