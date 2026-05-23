import * as XLSX from "xlsx";

export type FieldKey =
  | "name"
  | "nickname"
  | "phone"
  | "email"
  | "instagram"
  | "balance"
  | "birth_date"
  | "gender"
  | "ignore";

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Nome",
  nickname: "Apelido",
  phone: "Telefone",
  email: "Email",
  instagram: "Instagram",
  balance: "Saldo",
  birth_date: "Data de Nascimento",
  gender: "Sexo",
  ignore: "Ignorar",
};

// Heuristic auto-mapping from header → field
const HEADER_PATTERNS: Array<{ field: FieldKey; patterns: RegExp[] }> = [
  { field: "name", patterns: [/^nome$/i, /^name$/i, /cliente/i, /^nome.*completo/i] },
  { field: "nickname", patterns: [/apelido/i, /nickname/i, /alias/i] },
  { field: "phone", patterns: [/telefone/i, /celular/i, /whats/i, /phone/i, /fone/i, /tel/i] },
  { field: "email", patterns: [/e-?mail/i] },
  { field: "instagram", patterns: [/instagram/i, /insta/i, /@/i] },
  { field: "balance", patterns: [/saldo/i, /balance/i, /cr[eé]dito/i] },
  { field: "birth_date", patterns: [/nascimento/i, /aniversário/i, /aniversario/i, /birth/i, /nasc/i, /dt.?nasc/i] },
  { field: "gender", patterns: [/sexo/i, /g[eê]nero/i, /gender/i] },
];

export function autoMapHeader(header: string): FieldKey {
  const h = String(header ?? "").trim();
  if (!h) return "ignore";
  for (const { field, patterns } of HEADER_PATTERNS) {
    if (patterns.some((re) => re.test(h))) return field;
  }
  return "ignore";
}

export function normalizePhone(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  // strip leading zeros
  digits = digits.replace(/^0+/, "");
  // add country code if missing and length matches BR mobile/local
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

export function parseBirthDate(
  raw: unknown
): { iso: string | null; day: number | null; month: number | null } {
  if (raw === null || raw === undefined || raw === "") {
    return { iso: null, day: null, month: null };
  }
  // Excel serial number
  if (typeof raw === "number" && isFinite(raw)) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      return {
        iso: `${d.y.toString().padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`,
        day: d.d,
        month: d.m,
      };
    }
  }
  const s = String(raw).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    if (isValidDMY(day, month, year)) {
      return { iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day, month };
    }
  }
  // DD/MM (no year)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { iso: null, day, month };
    }
  }
  // ISO YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (isValidDMY(day, month, year)) {
      return { iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day, month };
    }
  }
  return { iso: null, day: null, month: null };
}

function isValidDMY(d: number, m: number, y: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseBalance(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim().replace(/[R$\s]/g, "");
  // brazilian format 1.234,56 → 1234.56
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

export function normalizeGender(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (/^m/.test(s) || /masc/.test(s)) return "masculino";
  if (/^f/.test(s) || /fem/.test(s)) return "feminino";
  return "outro";
}

export function normalizeInstagram(raw: unknown): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  s = s.replace(/^@/, "").replace(/\/$/, "");
  return s ? "@" + s : null;
}

export async function readSpreadsheet(file: File): Promise<{ headers: string[]; rows: any[][] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = (data[0] as any[]).map((h) => String(h ?? "").trim());
  const rows = (data.slice(1) as any[][]).filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined));
  return { headers, rows };
}

export interface ParsedRow {
  rowIndex: number; // 1-based excluding header
  name: string;
  nickname: string | null;
  phone: string;
  email: string | null;
  instagram: string | null;
  balance: number;
  birth_iso: string | null;
  birth_day: number | null;
  birth_month: number | null;
  gender: string | null;
  errors: string[];
}

export function parseRows(
  headers: string[],
  rows: any[][],
  mapping: Record<number, FieldKey>
): ParsedRow[] {
  const colByField: Partial<Record<FieldKey, number>> = {};
  Object.entries(mapping).forEach(([idx, field]) => {
    if (field !== "ignore") colByField[field] = Number(idx);
  });

  return rows.map((row, i) => {
    const get = (f: FieldKey) => {
      const idx = colByField[f];
      return idx === undefined ? "" : row[idx];
    };
    const name = String(get("name") ?? "").trim();
    const phone = normalizePhone(get("phone"));
    const emailRaw = String(get("email") ?? "").trim();
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    const nicknameRaw = String(get("nickname") ?? "").trim();
    const balance = parseBalance(get("balance"));
    const { iso: birth_iso, day: birth_day, month: birth_month } = parseBirthDate(get("birth_date"));
    const instagram = normalizeInstagram(get("instagram"));
    const gender = normalizeGender(get("gender"));

    const errors: string[] = [];
    if (!name) errors.push("Nome obrigatório");
    if (!phone && !email && !(name && birth_iso)) {
      errors.push("Sem identificação (telefone, email ou nome+nascimento)");
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("Email inválido");

    return {
      rowIndex: i + 2,
      name,
      nickname: nicknameRaw || null,
      phone,
      email,
      instagram,
      balance,
      birth_iso,
      birth_day,
      birth_month,
      gender,
      errors,
    };
  });
}

export function exportClientsToXlsx(clients: any[], filename = "clientes.xlsx") {
  const data = clients.map((c) => ({
    ID: c.id,
    Nome: c.name ?? "",
    Apelido: c.nickname ?? "",
    Telefone: c.phone ?? "",
    Email: c.email ?? "",
    Instagram: c.instagram ?? "",
    Saldo: Number(c.balance ?? 0),
    "Data Nascimento": c.birth_date
      ? formatDateBR(c.birth_date)
      : c.birth_day && c.birth_month
      ? `${String(c.birth_day).padStart(2, "0")}/${String(c.birth_month).padStart(2, "0")}`
      : "",
    Sexo: c.gender ?? "",
    "Data Cadastro": c.created_at ? formatDateBR(c.created_at) : "",
    "Último Atendimento": c.last_service_date ? formatDateBR(c.last_service_date) : "",
    "Total Gasto": Number(c.total_spent ?? 0),
    Visitas: Number(c.visit_count ?? 0),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, filename);
}

export function exportClientsToCsv(clients: any[], filename = "clientes.csv") {
  const data = clients.map((c) => ({
    ID: c.id,
    Nome: c.name ?? "",
    Apelido: c.nickname ?? "",
    Telefone: c.phone ?? "",
    Email: c.email ?? "",
    Instagram: c.instagram ?? "",
    Saldo: Number(c.balance ?? 0),
    "Data Nascimento": c.birth_date
      ? formatDateBR(c.birth_date)
      : c.birth_day && c.birth_month
      ? `${String(c.birth_day).padStart(2, "0")}/${String(c.birth_month).padStart(2, "0")}`
      : "",
    Sexo: c.gender ?? "",
    "Data Cadastro": c.created_at ? formatDateBR(c.created_at) : "",
    "Último Atendimento": c.last_service_date ? formatDateBR(c.last_service_date) : "",
    "Total Gasto": Number(c.total_spent ?? 0),
    Visitas: Number(c.visit_count ?? 0),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export function exportErrorReport(errors: { rowIndex: number; reason: string; data: any }[]) {
  const rows = errors.map((e) => ({ Linha: e.rowIndex, Erro: e.reason, ...(e.data ?? {}) }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, "erros_importacao.csv");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateBR(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
