export type NavigationRole = "owner" | "admin" | "employee" | null;
export interface NavigationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const PREFIX = "beauty.navigation.v1:";
const routes = new Set(["/dashboard", "/clients", "/services", "/products", "/sales", "/vendas-historico", "/expenses", "/agenda", "/atendimentos", "/reports", "/beauty-ia", "/metrics", "/settings", "/users", "/escolher-plano", "/checkout", "/planos", "/admin", "/super-admin"]);
const employeeRoutes = new Set(["/agenda", "/atendimentos", "/services", "/products", "/sales"]);
const safeQueryValues: Record<string, RegExp> = {
  filter: /^(inactive|active|birthday|birthdays|all)$/,
  plan: /^(individual|profissional|empresa)$/,
};

export function safeNavigationRoute(value: unknown, role: NavigationRole): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "https://navigation.invalid");
    if (url.origin !== "https://navigation.invalid" || !routes.has(url.pathname)) return null;
    if (!role || (role === "employee" && !employeeRoutes.has(url.pathname))) return null;
    const query = new URLSearchParams();
    for (const [key, pattern] of Object.entries(safeQueryValues)) {
      const item = url.searchParams.get(key);
      if (item && pattern.test(item)) query.set(key, item);
    }
    return url.pathname + (query.size ? `?${query}` : "");
  } catch { return null; }
}

export function navigationScope(userId: string, establishmentId: string) {
  return `${PREFIX}${userId}:${establishmentId}:`;
}

export function readNavigation<T>(storage: NavigationStorage, scope: string, key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = storage.getItem(scope + key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch { return fallback; }
}

export function writeNavigation(storage: NavigationStorage, scope: string, key: string, value: unknown) {
  try { storage.setItem(scope + key, JSON.stringify(value)); } catch { /* Storage may be disabled or full. */ }
}

export function clearNavigation(storage: NavigationStorage, userId: string) {
  try {
    const prefix = `${PREFIX}${userId}:`;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(prefix)) storage.removeItem(key);
    }
    // Retire the old account-independent agenda selection.
    storage.removeItem("agenda.professionalFilter");
  } catch { /* Storage is optional. */ }
}

export const isNavigationId = (value: unknown): value is string => typeof value === "string" && /^(all|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value);
export const isNavigationDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(value) && Number.isFinite(new Date(value).getTime());
export function navigationChoice<T extends string>(...values: T[]) {
  return (value: unknown): value is T => typeof value === "string" && values.includes(value as T);
}