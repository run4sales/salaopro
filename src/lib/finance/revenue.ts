import { supabase } from "@/integrations/supabase/client";
import {
  buildCommissionEntries,
  type CommissionEntry,
  type PeriodRange,
  type SaleLike,
  type SaleProfessionalLike,
} from "./revenueRules";

export * from "./revenueRules";

const SALE_COLUMNS =
  "id, client_id, service_id, professional_id, appointment_id, amount, gross_amount, net_amount, paid_now, credit_used, fee_amount, payment_method, installments, notes, sale_date";

export type FinanceSale = SaleLike & {
  service_id: string | null;
  professional_id: string | null;
  appointment_id: string | null;
  payment_method: string | null;
  installments: number | null;
  notes: string | null;
  sale_date: string;
};

/**
 * Fonte única das vendas realizadas do período.
 * Filtros oficiais: tenant + `deleted_at IS NULL` + intervalo semiaberto de datas.
 */
export async function fetchRealizedSales(
  establishmentId: string,
  range: PeriodRange,
): Promise<FinanceSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(SALE_COLUMNS)
    .eq("establishment_id", establishmentId)
    .is("deleted_at", null)
    .gte("sale_date", range.startISO)
    .lt("sale_date", range.endExclusiveISO)
    .order("sale_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FinanceSale[];
}

async function fetchSaleProfessionals(saleIds: string[]): Promise<SaleProfessionalLike[]> {
  if (saleIds.length === 0) return [];
  const chunkSize = 200;
  const rows: SaleProfessionalLike[] = [];
  for (let index = 0; index < saleIds.length; index += chunkSize) {
    const { data, error } = await supabase
      .from("sale_professionals")
      .select("sale_id, professional_id, role, commission_percentage, commission_amount")
      .in("sale_id", saleIds.slice(index, index + chunkSize));
    if (error) throw error;
    rows.push(...((data ?? []) as SaleProfessionalLike[]));
  }
  return rows;
}

export type CommissionReportRow = CommissionEntry & {
  professional: string;
  client: string;
  service: string;
  serviceId: string;
  kind: string;
  paymentMethod: string;
  saleStatus: string;
  paymentStatus: string;
  notes: string;
};

export type CommissionReport = {
  rows: CommissionReportRow[];
  professionals: { id: string; name: string }[];
  services: { id: string; name: string }[];
  sales: FinanceSale[];
};

/**
 * Comissões do período, derivadas exatamente das mesmas vendas usadas nos
 * relatórios de faturamento (mesma fonte, mesmos filtros, mesmo período).
 */
export async function fetchCommissionReport(
  establishmentId: string,
  range: PeriodRange,
): Promise<CommissionReport> {
  const sales = await fetchRealizedSales(establishmentId, range);
  const saleIds = sales.map((sale) => sale.id);
  const clientIds = Array.from(new Set(sales.map((s) => s.client_id).filter(Boolean))) as string[];

  const [links, professionalsRes, servicesRes, clientsRes] = await Promise.all([
    fetchSaleProfessionals(saleIds),
    supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
    supabase.from("services").select("id, name, kind").eq("establishment_id", establishmentId),
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);
  if (professionalsRes.error) throw professionalsRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if ("error" in clientsRes && clientsRes.error) throw clientsRes.error;

  const professionals = new Map(
    ((professionalsRes.data ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name ?? "—"]),
  );
  const services = new Map(
    ((servicesRes.data ?? []) as { id: string; name: string | null; kind: string | null }[]).map((s) => [
      s.id,
      { name: s.name ?? "—", kind: s.kind ?? "service" },
    ]),
  );
  const clients = new Map(
    ((clientsRes.data ?? []) as { id: string; name: string | null }[]).map((c) => [c.id, c.name ?? "Cliente não informado"]),
  );
  const saleById = new Map(sales.map((sale) => [sale.id, sale]));

  const rows: CommissionReportRow[] = buildCommissionEntries(sales, links).map((entry) => {
    const sale = saleById.get(entry.saleId) as FinanceSale;
    const service = sale.service_id ? services.get(sale.service_id) : undefined;
    const cashReceived = sale.paid_now ?? null;
    return {
      ...entry,
      professional: professionals.get(entry.professionalId) ?? "—",
      client: sale.client_id ? clients.get(sale.client_id) ?? "Cliente não informado" : "Cliente não informado",
      service: service?.name ?? "—",
      serviceId: sale.service_id ?? "",
      kind: service?.kind === "product" ? "Produto" : "Serviço",
      paymentMethod: sale.payment_method ?? "—",
      saleStatus: "Finalizada",
      paymentStatus: cashReceived !== null && Number(cashReceived) === 0 ? "Pago com crédito" : "Recebido",
      notes: sale.notes ?? "—",
    };
  });

  return {
    rows,
    professionals: Array.from(professionals.entries()).map(([id, name]) => ({ id, name })),
    services: Array.from(services.entries()).map(([id, value]) => ({ id, name: value.name })),
    sales,
  };
}
