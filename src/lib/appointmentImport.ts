import * as XLSX from "xlsx";

export interface AppointmentRow {
  rowIndex: number;
  date: Date | null;
  clientName: string;
  category: string;
  serviceName: string;
  price: number | null;
  errors: string[];
}

export interface ImportSummary {
  created: number;
  skipped: { rowIndex: number; reason: string }[];
  errors: { rowIndex: number; reason: string }[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["data da venda", "data", "data do agendamento", "dt", "dia"],
  client: ["cliente", "nome do cliente", "nome"],
  category: ["categoria", "tipo"],
  service: ["serviço e produto", "servico e produto", "serviço", "servico", "produto", "item"],
  value: ["valor", "preço", "preco", "valor (r$)", "vl"],
};

function normalizeHeader(h: string): string {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const norm = headers.map(normalizeHeader);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = norm.findIndex((h) =>
      aliases.some((a) => h === normalizeHeader(a) || h.includes(normalizeHeader(a)))
    );
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

function parseDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number" && isFinite(raw)) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      return new Date(d.y, d.m - 1, d.d, d.H || 9, d.M || 0, 0);
    }
  }
  const s = String(raw).trim();
  // DD/MM/YYYY [HH:mm]
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const day = +m[1];
    const month = +m[2];
    let year = +m[3];
    if (year < 100) year += 2000;
    const h = m[4] ? +m[4] : 9;
    const mi = m[5] ? +m[5] : 0;
    const d = new Date(year, month - 1, day, h, mi, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim();
  s = s.replace(/r\$\s*/i, "").replace(/\s/g, "");
  // 1.234,56 → 1234.56  | 1234.56 → 1234.56
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

export async function readFile(file: File): Promise<{ headers: string[]; rows: any[][] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: true });
  if (!raw.length) return { headers: [], rows: [] };
  const headers = (raw[0] as any[]).map((h) => String(h ?? "").trim());
  const rows = raw.slice(1).filter((r) => Array.isArray(r) && r.some((c) => c !== "" && c !== null && c !== undefined));
  return { headers, rows };
}

export function parseRows(headers: string[], rows: any[][]): AppointmentRow[] {
  const cols = detectColumns(headers);
  return rows.map((r, i) => {
    const date = cols.date !== undefined ? parseDate(r[cols.date]) : null;
    const clientName = cols.client !== undefined ? String(r[cols.client] ?? "").trim() : "";
    const category = cols.category !== undefined ? String(r[cols.category] ?? "").trim() : "";
    const serviceName = cols.service !== undefined ? String(r[cols.service] ?? "").trim() : "";
    const price = cols.value !== undefined ? parsePrice(r[cols.value]) : null;
    const errors: string[] = [];
    if (!date) errors.push("Data inválida");
    if (!clientName) errors.push("Cliente vazio");
    if (!serviceName) errors.push("Serviço vazio");
    return { rowIndex: i + 2, date, clientName, category, serviceName, price, errors };
  });
}

export function buildTemplateBlob(): Blob {
  const data = [
    ["Data da venda", "Cliente", "Categoria", "Serviço e produto", "Valor", "Comanda"],
    ["15/06/2026 09:00", "Maria Silva", "Cabelo", "Corte feminino", "R$ 80,00", ""],
    ["15/06/2026 10:30", "Joana Souza", "Estética", "Limpeza de pele", "R$ 220,00", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Agendamentos");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
