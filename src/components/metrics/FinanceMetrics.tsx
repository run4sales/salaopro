import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function currencyBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

interface Props { establishmentId: string; startDate: Date; endDate: Date; }

interface Sale { id: string; client_id: string; service_id: string; amount: number; sale_date: string }
interface Goal { id: string; target_amount: number; current_amount: number }
interface Service { id: string; name: string }

export function FinanceMetrics({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => new Date(startDate).toISOString(), [startDate]);
  const endISO = useMemo(() => new Date(endDate).toISOString(), [endDate]);

  const prevStart = useMemo(() => {
    const ms = new Date(startDate).getTime();
    const len = new Date(endDate).getTime() - ms;
    return new Date(ms - len);
  }, [startDate, endDate]);
  const prevEnd = useMemo(() => new Date(startDate), [startDate]);

  const isSameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();

  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", "finance", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [salesRes, prevSalesRes, servicesRes] = await Promise.all([
        supabase
          .from("sales").select("id, client_id, service_id, amount, sale_date")
          .eq("establishment_id", establishmentId)
          .gte("sale_date", startISO).lte("sale_date", endISO),
        supabase
          .from("sales").select("amount")
          .eq("establishment_id", establishmentId)
          .gte("sale_date", prevStart.toISOString()).lte("sale_date", prevEnd.toISOString()),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
      ]);
      if (salesRes.error) throw salesRes.error; if (prevSalesRes.error) throw prevSalesRes.error; if (servicesRes.error) throw servicesRes.error;
      const sales = (salesRes.data ?? []) as Sale[];
      const prevSales = (prevSalesRes.data ?? []) as { amount: number }[];
      const services = new Map(((servicesRes.data ?? []) as Service[]).map(s => [s.id, s.name]));

      // Goal for month (only if within a single month)
      let goal: Goal | null = null;
      if (isSameMonth) {
        const month = startDate.getMonth() + 1; const year = startDate.getFullYear();
        const { data: goalData, error: goalErr } = await supabase
          .from("goals").select("id, target_amount, current_amount")
          .eq("establishment_id", establishmentId).eq("month", month).eq("year", year).maybeSingle();
        if (goalErr) throw goalErr; goal = goalData as Goal | null;
      }

      // Aggregations
      const total = sales.reduce((a, s) => a + Number(s.amount || 0), 0);
      const prevTotal = prevSales.reduce((a, s) => a + Number(s.amount || 0), 0);
      const uniqueClients = new Set(sales.map(s => s.client_id)).size;
      const totalServices = sales.length;
      const ticketCliente = uniqueClients ? total / uniqueClients : 0;
      const ticketServico = totalServices ? total / totalServices : 0;
      const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

      const byService = new Map<string, { name: string; qty: number; total: number }>();
      for (const s of sales) {
        const id = s.service_id; const name = services.get(id) ?? "-";
        const prev = byService.get(id) ?? { name, qty: 0, total: 0 };
        prev.qty += 1; prev.total += Number(s.amount || 0); byService.set(id, prev);
      }
      const serviceRows = Array.from(byService.values()).sort((a,b)=>b.total-a.total);

      // Projection (only if current month)
      let projection: number | null = null;
      const today = new Date();
      if (isSameMonth && today.getMonth() === startDate.getMonth() && today.getFullYear() === startDate.getFullYear()) {
        const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
        const daysPassed = today.getDate();
        const base = goal?.current_amount ?? total;
        projection = daysPassed > 0 ? (base / daysPassed) * daysInMonth : null;
      }

      return { total, prevTotal, growth, uniqueClients, totalServices, ticketCliente, ticketServico, serviceRows, goal, projection };
    }
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar métricas financeiras.</div>;
  if (!data) return null;

  const remainingToGoal = data.goal && data.goal.target_amount != null ? Math.max(0, Number(data.goal.target_amount) - (Number(data.goal.current_amount) || 0)) : null;
  const goalPct = data.goal && data.goal.target_amount ? Math.min(100, ((Number(data.goal.current_amount)||0) / Number(data.goal.target_amount)) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Faturamento</div>
          <div className="text-2xl font-semibold">{currencyBRL(data.total)}</div>
          {data.growth !== null && (
            <div className="text-xs text-muted-foreground mt-1">{data.growth >= 0 ? "+" : ""}{data.growth.toFixed(1)}% vs período anterior</div>
          )}
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Ticket médio (cliente)</div>
          <div className="text-2xl font-semibold">{currencyBRL(data.ticketCliente)}</div>
          <div className="text-xs text-muted-foreground mt-1">Clientes únicos: {data.uniqueClients}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Ticket médio (serviço)</div>
          <div className="text-2xl font-semibold">{currencyBRL(data.ticketServico)}</div>
          <div className="text-xs text-muted-foreground mt-1">Serviços prestados: {data.totalServices}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Meta vs. Realizado</div>
          {data.goal ? (
            <div className="mt-2 space-y-1">
              <div className="text-sm">Meta: {currencyBRL(Number(data.goal.target_amount || 0))}</div>
              <div className="text-sm">Realizado no mês: {currencyBRL(Number(data.goal.current_amount || 0))}</div>
              {goalPct !== null && <div className="text-sm">Atingido: {goalPct.toFixed(1)}% {remainingToGoal !== null && `(Falta ${currencyBRL(remainingToGoal)})`}</div>}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-2">Defina a meta deste mês em Configurações &gt; Metas.</div>
          )}
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Projeção de faturamento</div>
          <div className="text-2xl font-semibold mt-2">{data.projection !== null ? currencyBRL(data.projection) : "N/D"}</div>
          <div className="text-xs text-muted-foreground mt-1">Base: média diária do mês atual</div>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.serviceRows.map((r) => (
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
