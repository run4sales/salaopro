import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, validateEmail, validatePhone } from "../src/lib/contactValidation.ts";
import { readFileSync } from "node:fs";

test("rejects malformed or clearly artificial emails", () => {
  for (const email of [
    "aaaaaaaaaaaaa@gmail.com", "aaaaaaaaaa@gmail.com", "lalalalala@gmail.com",
    "LALALAALAL@gmail.com", "1111111111@gmail.com", "teste@gmail.com",
    "test@test.com", "asdf@asdf.com", "sem-arroba.com", "nome@", " nome @gmail.com",
  ]) assert.equal(validateEmail(email, { required: true }).valid, false, email);
});

test("accepts varied legitimate email structures", () => {
  for (const email of [
    "ana.clara+agenda@gmail.com", "contato@studio-beleza.com.br",
    "joao_das-neves@empresa.co", "bookkeeper77@dominio.com.br", "x7z9q2@provedor.net",
  ]) assert.equal(validateEmail(email, { required: true }).valid, true, email);
});

test("rejects malformed or artificial Brazilian phones", () => {
  for (const phone of ["aaaaaaaaaa", "11111111111", "00000000000", "99999999999", "123456789", "1199999999a", "1199999"])
    assert.equal(validatePhone(phone, { required: true }).valid, false, phone);
});

test("accepts valid Brazilian landlines and mobile phones", () => {
  for (const phone of ["(11) 98765-4321", "11987654321", "+55 (21) 99876-5432", "1132345678", "55 31 3987-6543"])
    assert.equal(validatePhone(phone, { required: true }).valid, true, phone);
});

test("client import uses the same phone key with or without Brazil country code", () => {
  assert.equal(normalizePhone("+55 (11) 98765-4321"), "11987654321");
  assert.equal(normalizePhone("(11) 98765-4321"), "11987654321");
  const source = readFileSync(new URL("../src/components/clients/ImportClientsDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /const pNorm = normalizePhone\(c\.phone\)/);
});

test("all contact write screens use the centralized validators", () => {
  const paths = [
    "src/pages/Auth.tsx", "src/pages/Clients.tsx", "src/pages/PublicBooking.tsx",
    "src/pages/Checkout.tsx", "src/pages/Users.tsx", "src/pages/StaffUsers.tsx",
    "src/components/settings/ProfileForm.tsx", "src/components/users/EditUserDialog.tsx",
    "src/components/ClientCombobox.tsx", "src/lib/clientImportExport.ts",
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /contactValidation/, path);
  }
  for (const path of ["create-staff-user", "update-staff-user", "asaas-create-subscription"]) {
    const source = readFileSync(new URL(`../supabase/functions/${path}/index.ts`, import.meta.url), "utf8");
    assert.match(source, /contact-validation/, path);
  }
});