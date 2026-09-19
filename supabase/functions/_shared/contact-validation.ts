export type ContactValidationResult = { valid: boolean; code?: "invalid_format" | "suspicious"; message?: string; normalized: string };

export const EMAIL_INVALID_MESSAGE = "Informe um e-mail válido. Verifique se o endereço foi digitado corretamente.";
export const EMAIL_SUSPICIOUS_MESSAGE = "Este e-mail parece inválido ou fictício. Informe um endereço de e-mail válido.";
export const PHONE_INVALID_MESSAGE = "Informe um telefone válido com DDD.";
export const PHONE_SUSPICIOUS_MESSAGE = "Este telefone parece inválido. Informe um número de telefone válido.";

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const RESERVED_LOCALS = new Set(["asdf", "fake", "falso", "naoexiste", "noemail", "sememail", "test", "teste"]);
const RESERVED_DOMAINS = new Set(["asdf.com", "example.com", "example.org", "test.com"]);
const VALID_DDDS = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);

export const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
export function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}
function repeated(value: string) {
  if (value.length < 8) return false;
  return [1, 2].some((size) => value.length % size === 0 && value === value.slice(0, size).repeat(value.length / size));
}
export function isSuspiciousEmail(value: string) {
  const [local = "", domain = ""] = normalizeEmail(value).split("@");
  const compact = local.replace(/[._+-]/g, "");
  return RESERVED_LOCALS.has(compact) || RESERVED_DOMAINS.has(domain) ||
    (/^\d{6,}$/.test(compact) && new Set(compact).size <= 2) || repeated(compact) ||
    (compact.length >= 8 && new Set(compact).size <= 2);
}
export function validateEmail(value: unknown, required = true): ContactValidationResult {
  const normalized = normalizeEmail(value);
  if (!normalized) return required ? { valid: false, code: "invalid_format", message: EMAIL_INVALID_MESSAGE, normalized } : { valid: true, normalized };
  const [local = "", domain = ""] = normalized.split("@");
  if (normalized.length > 254 || local.length > 64 || /\s/.test(String(value ?? "")) || !EMAIL_PATTERN.test(normalized) || local.startsWith(".") || local.endsWith(".") || local.includes("..") || domain.split(".").some((label) => label.startsWith("-") || label.endsWith("-"))) return { valid: false, code: "invalid_format", message: EMAIL_INVALID_MESSAGE, normalized };
  if (isSuspiciousEmail(normalized)) return { valid: false, code: "suspicious", message: EMAIL_SUSPICIOUS_MESSAGE, normalized };
  return { valid: true, normalized };
}
export function isSuspiciousPhone(value: string) {
  const digits = normalizePhone(value);
  return /^(\d)\1+$/.test(digits) || ["0123456789", "1234567890", "9876543210", "0987654321"].some((s) => digits.includes(s)) || repeated(digits.slice(2));
}
export function validatePhone(value: unknown, required = true): ContactValidationResult {
  const raw = String(value ?? "");
  const normalized = normalizePhone(raw);
  if (!normalized) return required ? { valid: false, code: "invalid_format", message: PHONE_INVALID_MESSAGE, normalized } : { valid: true, normalized };
  if (/[a-z]/i.test(raw) || !/^[\d\s()+.-]+$/.test(raw)) return { valid: false, code: "invalid_format", message: PHONE_INVALID_MESSAGE, normalized };
  if (isSuspiciousPhone(normalized)) return { valid: false, code: "suspicious", message: PHONE_SUSPICIOUS_MESSAGE, normalized };
  const area = Number(normalized.slice(0, 2));
  const number = normalized.slice(2);
  if (!VALID_DDDS.has(area) || !((normalized.length === 10 && /^[2-5]\d{7}$/.test(number)) || (normalized.length === 11 && /^9[6-9]\d{7}$/.test(number)))) return { valid: false, code: "invalid_format", message: PHONE_INVALID_MESSAGE, normalized };
  return { valid: true, normalized };
}