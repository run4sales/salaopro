import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
  id: string;
  client_id: string;
  service_id: string;
  amount: number;
  sale_date: string;
  payment_method: string | null;
  notes: string | null;
}

interface SimpleItem { id: string; name: string }

export function RevenueReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => new Date(startDate).toISOString(), [startDate]);
  const endISO = useMemo(() => new Date(endDate).toISOString(), [endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "revenue", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [salesRes, clientsRes, servicesRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, client_id, service_id, amount, sale_date, payment_method, notes")
          .eq("establishment_id", establishmentId)
          .gte("sale_date", startISO)
          .lte("sale_date", endISO)
          .order("sale_date", { ascending: false }),
        supabase
          .from("clients")
          .select("id, name")
          .eq("establishment_id", establishmentId),
        supabase
          .from("services")
          .select("id, name")
          .eq("establishment_id", establishmentId),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const sales = (salesRes.data ?? []) as SaleRow[];
      const clients = new Map((clientsRes.data ?? []).map((c: any) => [c.id, (c as SimpleItem).name]));
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, (s as SimpleItem).name]));

      const rows = sales.map((s) => ({
        ...s,
        clientName: clients.get(s.client_id) ?? "-",
        serviceName: services.get(s.service_id) ?? "-",
      }));

      const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

      return { rows, total };
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar dados.</div>;
  if (!data || data.rows.length === 0) return <div className="text-sm text-muted-foreground">Nenhuma venda no período.</div>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Vendas: {data.rows.length} • Faturamento: <span className="font-semibold text-foreground">{currencyBRL(data.total)}</span>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.sale_date), "dd/MM/yyyy")}</TableCell>
                <TableCell>{(r as any).clientName}</TableCell>
                <TableCell>{(r as any).serviceName}</TableCell>
                <TableCell className="text-right">{currencyBRL(Number(r.amount))}</TableCell>
                <TableCell>{r.payment_method ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
