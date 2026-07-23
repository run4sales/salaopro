import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard, currencyBRL } from "./KpiCard";
import { DollarSign, Receipt, TrendingUp, ShoppingCart } from "lucide-react";
import { FinancialStrategyReport } from "./FinancialStrategyReport";

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

export function RevenueGeneralReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "revenue-general", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [salesRes, clientsRes, servicesRes, profsRes, salePros] = await Promise.all([
        supabase.from("sales")
          .select("id, client_id, service_id, professional_id, amount, sale_date, payment_method")
          .eq("establishment_id", establishmentId)
          .gte("sale_date", startISO).lte("sale_date", endISO)
          .is("deleted_at", null)
          .order("sale_date", { ascending: false }),
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("sale_professionals").select("sale_id, professional_id").eq("establishment_id", establishmentId),
      ]);
      if (salesRes.error) throw salesRes.error;
      const sales = salesRes.data ?? [];
      const clients = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const profs = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.name]));
      const proBySale = new Map<string, string[]>();
      for (const sp of salePros.data ?? []) {
        const arr = proBySale.get((sp as any).sale_id) ?? [];
        const name = profs.get((sp as any).professional_id);
        if (name) arr.push(name);
        proBySale.set((sp as any).sale_id, arr);
      }
      const rows = sales.map((s: any) => {
        const linkedPros = proBySale.get(s.id) ?? [];
        const fallback = s.professional_id ? profs.get(s.professional_id) : null;
        const proNames = linkedPros.length > 0 ? linkedPros : (fallback ? [fallback] : []);
        return {
          id: s.id,
          date: s.sale_date,
          client: clients.get(s.client_id) ?? "—",
          type: "Serviço" as const,
          name: services.get(s.service_id) ?? "—",
          professionals: proNames,
          payment: s.payment_method ?? "—",
          amount: Number(s.amount || 0),
        };
      });
      const total = rows.reduce((a, r) => a + r.amount, 0);
      const count = rows.length;
      const ticket = count ? total / count : 0;
      return { rows, total, count, ticket };
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar.</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <FinancialStrategyReport establishmentId={establishmentId} startDate={startDate} endDate={endDate} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento" value={currencyBRL(data.total)} icon={DollarSign} tone="positive" />
        <KpiCard label="Vendas" value={String(data.count)} icon={ShoppingCart} tone="accent" />
        <KpiCard label="Ticket médio" value={currencyBRL(data.ticket)} icon={TrendingUp} tone="accent" />
        <KpiCard label="Período" value={`${format(startDate, "dd/MM")} – ${format(endDate, "dd/MM")}`} icon={Receipt} />
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        {data.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma venda no período.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Serviço/Produto</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const d = new Date(r.date);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{format(d, "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-muted-foreground">{format(d, "HH:mm")}</TableCell>
                    <TableCell className="font-medium">{r.client}</TableCell>
                    <TableCell><Badge variant="secondary">{r.type}</Badge></TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.professionals.length ? r.professionals.join(", ") : "—"}</TableCell>
                    <TableCell className="capitalize">{r.payment}</TableCell>
                    <TableCell className="text-right font-semibold">{currencyBRL(r.amount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
