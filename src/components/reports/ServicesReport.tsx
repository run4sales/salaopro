import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currencyBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

interface SaleRow {
  service_id: string;
  amount: number;
}

interface SimpleService { id: string; name: string }

export function ServicesReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => new Date(startDate).toISOString(), [startDate]);
  const endISO = useMemo(() => new Date(endDate).toISOString(), [endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "services", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [salesRes, servicesRes] = await Promise.all([
        supabase
          .from("sales")
          .select("service_id, amount")
          .eq("establishment_id", establishmentId)
          .gte("sale_date", startISO)
          .lte("sale_date", endISO),
        supabase
          .from("services")
          .select("id, name")
          .eq("establishment_id", establishmentId),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const sales = (salesRes.data ?? []) as SaleRow[];
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, (s as SimpleService).name]));

      const byService = new Map<string, { name: string; qty: number; total: number }>();
      for (const s of sales) {
        const name = services.get(s.service_id) ?? "-";
        const prev = byService.get(s.service_id) ?? { name, qty: 0, total: 0 };
        prev.qty += 1;
        prev.total += Number(s.amount || 0);
        byService.set(s.service_id, prev);
      }

      const rows = Array.from(byService.values()).sort((a, b) => b.total - a.total);
      const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
      const totalQty = rows.reduce((acc, r) => acc + r.qty, 0);

      return { rows, grandTotal, totalQty };
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar dados.</div>;
  if (!data || data.rows.length === 0) return <div className="text-sm text-muted-foreground">Nenhum serviço no período.</div>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Total de serviços: {data.totalQty} • Faturamento do período: <span className="font-semibold text-foreground">{currencyBRL(data.grandTotal)}</span>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right">{r.qty}</TableCell>
                <TableCell className="text-right">{currencyBRL(r.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
