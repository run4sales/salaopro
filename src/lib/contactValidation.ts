import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL } from "@/integrations/supabase/public-config";

export type ContactValidationCode =
  | "required"
  | "invalid_format"
  | "suspicious";

export interface ContactValidationResult {
  valid: boolean;
  code?: ContactValidationCode;
  message?: string;
  normalized: string;
}

export const EMAIL_INVALID_MESSAGE =
  "Informe um e-mail válido. Verifique se o endereço foi digitado corretamente.";
export const EMAIL_SUSPICIOUS_MESSAGE =
  "Este e-mail parece inválido ou fictício. Informe um endereço de e-mail válido.";
export const PHONE_INVALID_MESSAGE = "Informe um telefone válido com DDD.";
export const PHONE_SUSPICIOUS_MESSAGE =
  "Este telefone parece inválido. Informe um número de telefone válido.";

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const RESERVED_EMAIL_LOCALS = new Set([
  "asdf", "fake", "falso", "naoexiste", "noemail", "sememail", "test", "teste",
]);
const RESERVED_EMAIL_DOMAINS = new Set(["asdf.com", "example.com", "example.org", "test.com"]);
const VALID_BR_AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34,
  35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62,
  63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84,
  85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function hasShortRepeatedPattern(value: string): boolean {
  if (value.length < 8) return false;
  for (const size of [1, 2]) {
    if (value.length % size === 0 && value === value.slice(0, size).repeat(value.length / size)) return true;
  }
  return false;
}

export function isSuspiciousEmail(value: string): boolean {
  const [local = "", domain = ""] = normalizeEmail(value).split("@");
  const compactLocal = local.replace(/[._+-]/g, "");
  if (RESERVED_EMAIL_LOCALS.has(compactLocal) || RESERVED_EMAIL_DOMAINS.has(domain)) return true;
  if (/^\d{6,}$/.test(compactLocal) && new Set(compactLocal).size <= 2) return true;
  if (hasShortRepeatedPattern(compactLocal)) return true;
  if (compactLocal.length >= 8 && new Set(compactLocal).size <= 2) return true;
  return false;
}

export function validateEmail(value: unknown, options: { required?: boolean } = {}): ContactValidationResult {
  const normalized = normalizeEmail(value);
  if (!normalized) {
    return options.required
      ? { valid: false, code: "required", message: EMAIL_INVALID_MESSAGE, normalized }
      : { valid: true, normalized };
  }
  const [local = "", domain = ""] = normalized.split("@");
  const domainLabels = domain.split(".");
  const invalid =
    normalized.length > 254 ||
    local.length > 64 ||
    /\s/.test(String(value ?? "")) ||
    !EMAIL_PATTERN.test(normalized) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domainLabels.some((label) => label.startsWith("-") || label.endsWith("-"));
  if (invalid) return { valid: false, code: "invalid_format", message: EMAIL_INVALID_MESSAGE, normalized };
  if (isSuspiciousEmail(normalized)) {
    return { valid: false, code: "suspicious", message: EMAIL_SUSPICIOUS_MESSAGE, normalized };
  }
  return { valid: true, normalized };
}

export function normalizePhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

export function isSuspiciousPhone(value: string): boolean {
  const digits = normalizePhone(value);
  if (!digits) return false;
  if (/^(\d)\1+$/.test(digits)) return true;
  if (["0123456789", "1234567890", "9876543210", "0987654321"].some((sequence) => digits.includes(sequence))) return true;
  const subscriber = digits.slice(2);
  if (hasShortRepeatedPattern(subscriber)) return true;
  return false;
}

export function validatePhone(value: unknown, options: { required?: boolean } = {}): ContactValidationResult {
  const raw = String(value ?? "");
  const normalized = normalizePhone(raw);
  if (!normalized) {
    return options.required
      ? { valid: false, code: "required", message: PHONE_INVALID_MESSAGE, normalized }
      : { valid: true, normalized };
  }
  if (/[a-z]/i.test(raw) || !/^[\d\s()+.-]+$/.test(raw)) {
    return { valid: false, code: "invalid_format", message: PHONE_INVALID_MESSAGE, normalized };
  }
  if (isSuspiciousPhone(normalized)) {
    return { valid: false, code: "suspicious", message: PHONE_SUSPICIOUS_MESSAGE, normalized };
  }
  const areaCode = Number(normalized.slice(0, 2));
  const subscriber = normalized.slice(2);
  const validLengthAndPrefix =
    (normalized.length === 10 && /^[2-5]\d{7}$/.test(subscriber)) ||
    (normalized.length === 11 && /^9[6-9]\d{7}$/.test(subscriber));
  if (!VALID_BR_AREA_CODES.has(areaCode) || !validLengthAndPrefix) {
    return { valid: false, code: "invalid_format", message: PHONE_INVALID_MESSAGE, normalized };
  }
  return { valid: true, normalized };
}

export function contactErrorProps(message?: string) {
  return message ? { "aria-invalid": true as const, "aria-describedby": undefined } : {};
}

export async function checkEmailDomain(email: string): Promise<ContactValidationResult> {
  const local = validateEmail(email, { required: true });
  if (!local.valid) return local;
  try {
    const cloudUrl = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY;
    const response = await fetch(`${cloudUrl}/functions/v1/validate-email-domain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
      },
      body: JSON.stringify({ email: local.normalized }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok || result.status === "inconclusive") return local;
    return { valid: false, code: "invalid_format", message: result.error ?? EMAIL_INVALID_MESSAGE, normalized: local.normalized };
  } catch {
    return local;
  }
}