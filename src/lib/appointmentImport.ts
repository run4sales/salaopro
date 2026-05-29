import * as XLSX from "xlsx";

export interface AppointmentRow {
  rowIndex: number;
  date: Date | null;
  clientName: string;
  category: string;
  serviceName: string;
  professionalName: string;
  statusLabel: string;
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
  time: ["horario inicio", "horário início", "horario", "horário", "hora", "hora inicio", "hora início"],
  client: ["cliente", "nome do cliente", "nome"],
  category: ["categoria", "tipo"],
  service: ["serviço e produto", "servico e produto", "serviço", "servico", "produto", "item"],
  professional: ["profissional", "responsavel", "responsável", "colaborador", "funcionario", "funcionário"],
  status: ["situacao", "situação", "status"],
  value: ["valor (r$)", "valor", "preço", "preco", "vl"],
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
      return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, 0);
    }
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const day = +m[1];
    const month = +m[2];
    let year = +m[3];
    if (year < 100) year += 2000;
    const h = m[4] ? +m[4] : 0;
    const mi = m[5] ? +m[5] : 0;
    const d = new Date(year, month - 1, day, h, mi, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseTime(raw: unknown): { h: number; m: number } | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && isFinite(raw)) {
    // Excel time fraction of a day
    const total = Math.round(raw * 24 * 60);
    return { h: Math.floor(total / 60) % 24, m: total % 60 };
  }
  if (raw instanceof Date) return { h: raw.getHours(), m: raw.getMinutes() };
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return { h: +m[1], m: +m[2] };
  return null;
}

function parsePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim();
  s = s.replace(/r\$\s*/i, "").replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

export function mapStatusLabel(label: string): string {
  const s = normalizeHeader(label);
  if (!s) return "scheduled";
  if (s.startsWith("confirm")) return "confirmed";
  if (s.startsWith("cancel")) return "cancelled";
  if (s.startsWith("conclu") || s.startsWith("finaliz") || s.startsWith("realiz")) return "completed";
  if (s.startsWith("falt") || s.startsWith("no-show") || s.startsWith("no show")) return "no_show";
  return "scheduled"; // "Marcado" e demais
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
    let date = cols.date !== undefined ? parseDate(r[cols.date]) : null;
    if (date && cols.time !== undefined) {
      const t = parseTime(r[cols.time]);
      if (t) {
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), t.h, t.m, 0);
      }
    }
    const clientName = cols.client !== undefined ? String(r[cols.client] ?? "").trim() : "";
    const category = cols.category !== undefined ? String(r[cols.category] ?? "").trim() : "";
    const serviceName = cols.service !== undefined ? String(r[cols.service] ?? "").trim() : "";
    const professionalName = cols.professional !== undefined ? String(r[cols.professional] ?? "").trim() : "";
    const statusLabel = cols.status !== undefined ? String(r[cols.status] ?? "").trim() : "";
    const price = cols.value !== undefined ? parsePrice(r[cols.value]) : null;
    const errors: string[] = [];
    if (!date) errors.push("Data inválida");
    if (!clientName) errors.push("Cliente vazio");
    if (!serviceName) errors.push("Serviço vazio");
    return { rowIndex: i + 2, date, clientName, category, serviceName, professionalName, statusLabel, price, errors };
  });
}

export function buildTemplateBlob(): Blob {
  const data = [
    ["Data", "Horário Início", "Cliente", "Serviço", "Profissional", "Situação", "Valor (R$)"],
    ["15/06/2026", "09:00", "Maria Silva", "Corte feminino", "Carla de Cassia", "Marcado", "80,00"],
    ["15/06/2026", "10:30", "Joana Souza", "Limpeza de pele", "Amanda Souza", "Confirmado", "220,00"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Agendamentos");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
