import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateEmail, validatePhone } from "./contact-validation.ts";

Deno.test("contact validation rejects artificial data", () => {
  for (const email of ["aaaaaaaaaaaaa@gmail.com", "lalalalala@gmail.com", "1111111111@gmail.com", "asdf@asdf.com"])
    assertEquals(validateEmail(email).valid, false, email);
  for (const phone of ["aaaaaaaaaa", "11111111111", "00000000000", "123456789"])
    assertEquals(validatePhone(phone).valid, false, phone);
});

Deno.test("contact validation accepts legitimate formats", () => {
  assertEquals(validateEmail("ana.clara+agenda@gmail.com").valid, true);
  assertEquals(validateEmail("x7z9q2@provedor.net").valid, true);
  assertEquals(validatePhone("(11) 98765-4321").valid, true);
  assertEquals(validatePhone("55 31 3987-6543").valid, true);
});