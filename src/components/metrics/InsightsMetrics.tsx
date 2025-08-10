import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props { establishmentId: string; startDate: Date; endDate: Date }

function currencyBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function InsightsMetrics({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => new Date(startDate).toISOString(), [startDate]);
  const endISO = useMemo(() => new Date(endDate).toISOString(), [endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", "insights", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [salesRes, servicesRes] = await Promise.all([
        supabase.from("sales").select("service_id, client_id, amount").eq("establishment_id", establishmentId).gte("sale_date", startISO).lte("sale_date", endISO),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
      ]);
      if (salesRes.error) throw salesRes.error; if (servicesRes.error) throw servicesRes.error;

      const sales = salesRes.data ?? [];
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s.name]));

      const total = sales.reduce((a: number, s: any) => a + Number(s.amount||0), 0);
      const totalItems = sales.length;
      const avgTicketPerService = totalItems ? total / totalItems : 0;

      // Goal (if in same month)
      let remainingToGoal: number | null = null;
      if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        const { data: goal, error: gerr } = await supabase
          .from("goals").select("target_amount, current_amount")
          .eq("establishment_id", establishmentId)
          .eq("month", startDate.getMonth()+1)
          .eq("year", startDate.getFullYear()).maybeSingle();
        if (gerr) throw gerr;
        if (goal) remainingToGoal = Math.max(0, Number(goal.target_amount||0) - Number(goal.current_amount||0));
      }

      const byService = new Map<string, { name: string; total: number }>();
      for (const s of sales) {
        const id = s.service_id; const name = services.get(id) ?? "-";
        const prev = byService.get(id) ?? { name, total: 0 }; prev.total += Number(s.amount||0); byService.set(id, prev);
      }
      const topService = Array.from(byService.values()).sort((a,b)=>b.total-a.total)[0] ?? null;

      const servicesNeeded = remainingToGoal !== null && avgTicketPerService > 0
        ? Math.ceil(remainingToGoal / avgTicketPerService)
        : null;

      // Potential lost value = inactive clients * ticket médio cliente
      // Use current snapshot of inactive clients
      const settingsRes = await supabase.from("settings").select("inactive_days_threshold").eq("establishment_id", establishmentId).maybeSingle();
      if (settingsRes.error) throw settingsRes.error;
      const threshold = Number(settingsRes.data?.inactive_days_threshold ?? 20);
      const clientsRes = await supabase.from("clients").select("id, last_service_date").eq("establishment_id", establishmentId);
      if (clientsRes.error) throw clientsRes.error;
      const now = new Date(); const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate()); limit.setDate(limit.getDate()-threshold);
      const inactiveCount = (clientsRes.data ?? []).filter((c: any) => !c.last_service_date || new Date(c.last_service_date) < limit).length;

      // Ticket médio por cliente no período
      const byClient = new Map<string, number>();
      for (const s of sales as any[]) { byClient.set(s.client_id, (byClient.get(s.client_id)||0) + Number(s.amount||0)); }
      const uniqueClients = byClient.size; const ticketClient = uniqueClients ? total / uniqueClients : 0;
      const potentialLost = inactiveCount * ticketClient;

      return { servicesNeeded, topService, remainingToGoal, potentialLost, ticketClient, avgTicketPerService };
    }
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar insights.</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-md border p-4">
        <div className="text-sm text-muted-foreground">Serviços para bater a meta (aprox.)</div>
        <div className="text-2xl font-semibold mt-1">{data.servicesNeeded ?? 'N/D'}</div>
        {data.remainingToGoal !== null && <div className="text-xs text-muted-foreground mt-1">Faltam {currencyBRL(data.remainingToGoal)}</div>}
      </div>
      <div className="rounded-md border p-4">
        <div className="text-sm text-muted-foreground">Serviço que mais contribuiu</div>
        <div className="text-2xl font-semibold mt-1">{data.topService ? data.topService.name : 'N/D'}</div>
      </div>
      <div className="rounded-md border p-4">
        <div className="text-sm text-muted-foreground">Valor potencial perdido (inativos)</div>
        <div className="text-2xl font-semibold mt-1">{currencyBRL(data.potentialLost)}</div>
        <div className="text-xs text-muted-foreground mt-1">Base: ticket médio cliente {currencyBRL(data.ticketClient)}</div>
      </div>
      <div className="rounded-md border p-4">
        <div className="text-sm text-muted-foreground">Ticket médio por serviço</div>
        <div className="text-2xl font-semibold mt-1">{currencyBRL(data.avgTicketPerService)}</div>
      </div>
    </div>
  );
}
