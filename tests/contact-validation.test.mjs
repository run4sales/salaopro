import test from "node:test";
import assert from "node:assert/strict";
import { validateEmail, validatePhone } from "../src/lib/contactValidation.ts";

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