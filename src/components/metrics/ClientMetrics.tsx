import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props { establishmentId: string; startDate: Date; endDate: Date }
interface Sale { client_id: string; sale_date: string; amount: number }
interface Client { id: string; name: string; birth_date: string | null }

function currencyBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function ClientMetrics({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => new Date(startDate).toISOString(), [startDate]);
  const endISO = useMemo(() => new Date(endDate).toISOString(), [endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", "clients", establishmentId, startISO, endISO],
    queryFn: async () => {
      const thresholdRes = await supabase.from("settings").select("inactive_days_threshold").eq("establishment_id", establishmentId).maybeSingle();
      if (thresholdRes.error) throw thresholdRes.error;
      const threshold = Number(thresholdRes.data?.inactive_days_threshold ?? 20);

      const [clientsRes, salesRes] = await Promise.all([
        supabase.from("clients").select("id, name, birth_date, created_at, last_service_date").eq("establishment_id", establishmentId),
        supabase.from("sales").select("client_id, sale_date, amount").eq("establishment_id", establishmentId).gte("sale_date", startISO).lte("sale_date", endISO),
      ]);
      if (clientsRes.error) throw clientsRes.error; if (salesRes.error) throw salesRes.error;

      const clients = (clientsRes.data ?? []) as any[];
      const sales = (salesRes.data ?? []) as Sale[];

      const now = new Date();
      const inactiveLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      inactiveLimit.setDate(inactiveLimit.getDate() - threshold);

      const activeCount = clients.filter(c => c.last_service_date && new Date(c.last_service_date) >= inactiveLimit).length;
      const inactiveCount = clients.filter(c => !c.last_service_date || new Date(c.last_service_date) < inactiveLimit).length;

      const newClients = clients.filter(c => new Date(c.created_at) >= new Date(startISO) && new Date(c.created_at) <= new Date(endISO)).length;

      const salesByClient = new Map<string, { qty: number; total: number }>();
      for (const s of sales) {
        const prev = salesByClient.get(s.client_id) ?? { qty: 0, total: 0 };
        prev.qty += 1; prev.total += Number(s.amount || 0);
        salesByClient.set(s.client_id, prev);
      }
      const uniqueClients = salesByClient.size;
      const recurringClients = Array.from(salesByClient.values()).filter(v => v.qty >= 2).length;
      const totalRevenue = Array.from(salesByClient.values()).reduce((a, v) => a + v.total, 0);
      const retentionRate = uniqueClients ? (recurringClients / uniqueClients) * 100 : 0;
      const ticketMedioCliente = uniqueClients ? totalRevenue / uniqueClients : 0;

      // Birthdays of selected month (use startDate month)
      const month = startDate.getMonth() + 1;
      const birthdays = (clients as Client[]).filter(c => c.birth_date && (new Date(c.birth_date).getMonth()+1) === month).slice(0, 10);

      // Top clients by revenue
      const nameMap = new Map((clients as Client[]).map(c => [c.id, c.name]));
      const topClients = Array.from(salesByClient.entries())
        .map(([id, v]) => ({ id, name: nameMap.get(id) ?? "-", total: v.total }))
        .sort((a,b)=>b.total-a.total)
        .slice(0, 10);

      return { activeCount, inactiveCount, newClients, recurringClients, retentionRate, ticketMedioCliente, birthdays, topClients };
    }
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar métricas de clientes.</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-md border p-4"><div className="text-sm text-muted-foreground">Ativos</div><div className="text-2xl font-semibold">{data.activeCount}</div></div>
        <div className="rounded-md border p-4"><div className="text-sm text-muted-foreground">Inativos</div><div className="text-2xl font-semibold">{data.inactiveCount}</div></div>
        <div className="rounded-md border p-4"><div className="text-sm text-muted-foreground">Novos no período</div><div className="text-2xl font-semibold">{data.newClients}</div></div>
        <div className="rounded-md border p-4"><div className="text-sm text-muted-foreground">Recorrentes</div><div className="text-2xl font-semibold">{data.recurringClients}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Taxa de retenção</div>
          <div className="text-2xl font-semibold">{data.retentionRate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground mt-1">Ticket médio por cliente: {currencyBRL(data.ticketMedioCliente)}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Aniversariantes do mês</div>
          <div className="mt-2 text-sm space-y-1">
            {data.birthdays.length === 0 ? (
              <div className="text-muted-foreground">Nenhum aniversariante listado.</div>
            ) : data.birthdays.map((c) => (<div key={c.id}>{c.name}</div>))}
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Top clientes</TableHead>
              <TableHead className="text-right">Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.topClients.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="text-right">{currencyBRL(c.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
