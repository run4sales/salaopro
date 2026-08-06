import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard, currencyBRL } from "./KpiCard";
import { DollarSign, Receipt, TrendingUp, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  averageTicket,
  fetchRealizedSales,
  sumCashReceived,
  sumCreditUsed,
  sumRealizedRevenue,
  toPeriodRange,
} from "@/lib/finance/revenue";

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

export function RevenueGeneralReport({ establishmentId, startDate, endDate }: Props) {
  const range = useMemo(() => toPeriodRange(startDate, endDate), [startDate, endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "revenue-general", establishmentId, range.startISO, range.endExclusiveISO],
    queryFn: async () => {
      const sales = await fetchRealizedSales(establishmentId, range);
      const [clientsRes, servicesRes, profsRes, salePros] = await Promise.all([
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, name, kind").eq("establishment_id", establishmentId),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("sale_professionals").select("sale_id, professional_id").eq("establishment_id", establishmentId),
      ]);
      const clients = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s]));
      const profs = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.name]));

      // Profissionais são agregados numa camada separada para nunca multiplicar
      // o valor da venda (uma venda com 3 profissionais continua valendo 1x).
      const proBySale = new Map<string, string[]>();
      for (const sp of salePros.data ?? []) {
        const arr = proBySale.get((sp as any).sale_id) ?? [];
        const name = profs.get((sp as any).professional_id);
        if (name) arr.push(name);
        proBySale.set((sp as any).sale_id, arr);
      }

      const rows = sales.map((s) => {
        const linked = proBySale.get(s.id) ?? [];
        const fallback = s.professional_id ? profs.get(s.professional_id) : null;
        const service = s.service_id ? services.get(s.service_id) : null;
        return {
          id: s.id,
          date: s.sale_date,
          client: (s.client_id && clients.get(s.client_id)) || "—",
          type: service?.kind === "product" ? "Produto" : "Serviço",
          name: service?.name ?? "—",
          professionals: linked.length > 0 ? linked : fallback ? [fallback] : [],
          payment: s.payment_method ?? "—",
          amount: Number(s.amount || 0),
        };
      });

      return {
        rows,
        total: sumRealizedRevenue(sales),
        cashReceived: sumCashReceived(sales),
        creditUsed: sumCreditUsed(sales),
        count: sales.length,
        ticket: averageTicket(sales),
      };
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar.</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento realizado" value={currencyBRL(data.total)} icon={DollarSign} tone="positive" hint={`${data.count} venda(s) finalizada(s)`} />
        <KpiCard label="Recebido em caixa" value={currencyBRL(data.cashReceived)} icon={ShoppingCart} tone="accent" hint={`${currencyBRL(data.creditUsed)} pago com crédito`} />
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
                const d = new Date(r.date as string);
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
