import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props { establishmentId: string; startDate: Date; endDate: Date }

export function OperationMetrics({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => new Date(startDate).toISOString(), [startDate]);
  const endISO = useMemo(() => new Date(endDate).toISOString(), [endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", "ops", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [salesRes, servicesRes, apptRes] = await Promise.all([
        supabase.from("sales").select("service_id, sale_date, amount, client_id").eq("establishment_id", establishmentId).gte("sale_date", startISO).lte("sale_date", endISO),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("appointments").select("status").eq("establishment_id", establishmentId).gte("appointment_date", startISO).lte("appointment_date", endISO),
      ]);
      if (salesRes.error) throw salesRes.error; if (servicesRes.error) throw servicesRes.error; if (apptRes.error) throw apptRes.error;

      const sales = salesRes.data ?? [];
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const appts = apptRes.data ?? [];

      const byServiceCount = new Map<string, { name: string; qty: number }>();
      const byHour = new Map<number, number>();
      const byClientDates = new Map<string, Date[]>();

      for (const s of sales) {
        const id = s.service_id; const name = services.get(id) ?? "-";
        const prev = byServiceCount.get(id) ?? { name, qty: 0 }; prev.qty += 1; byServiceCount.set(id, prev);
        const hour = new Date(s.sale_date).getHours(); byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
        const dates = byClientDates.get(s.client_id) ?? []; dates.push(new Date(s.sale_date)); byClientDates.set(s.client_id, dates);
      }

      const serviceArray = Array.from(byServiceCount.values());
      const mostSold = serviceArray.sort((a,b)=>b.qty-a.qty)[0] ?? null;
      const leastSold = serviceArray.sort((a,b)=>a.qty-b.qty)[0] ?? null;

      const busyHours = Array.from(byHour.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([h,c]) => ({ hour: h, count: c }));

      const canceled = appts.filter((a: any) => (a.status||"").toLowerCase()==="canceled").length;
      const noShows = appts.filter((a: any) => (a.status||"").toLowerCase()==="no_show").length;

      // Average time between visits (in days)
      let gaps: number[] = [];
      for (const dates of byClientDates.values()) {
        dates.sort((a,b)=>a.getTime()-b.getTime());
        for (let i=1;i<dates.length;i++) gaps.push((dates[i].getTime()-dates[i-1].getTime())/86400000);
      }
      const avgBetweenVisits = gaps.length ? gaps.reduce((a,b)=>a+b,0)/gaps.length : 0;

      return { mostSold, leastSold, busyHours, canceled, noShows, avgBetweenVisits };
    }
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar métricas de operação.</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border p-4"><div className="text-sm text-muted-foreground">Mais vendido</div><div className="text-2xl font-semibold">{data.mostSold ? `${data.mostSold.name} (${data.mostSold.qty})` : 'N/D'}</div></div>
        <div className="rounded-md border p-4"><div className="text-sm text-muted-foreground">Menos vendido</div><div className="text-2xl font-semibold">{data.leastSold ? `${data.leastSold.name} (${data.leastSold.qty})` : 'N/D'}</div></div>
        <div className="rounded-md border p-4"><div className="text-sm text-muted-foreground">Tempo médio entre visitas</div><div className="text-2xl font-semibold">{data.avgBetweenVisits.toFixed(1)} dias</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground mb-2">Horários mais movimentados</div>
          <ul className="text-sm space-y-1">
            {data.busyHours.length === 0 ? <li className="text-muted-foreground">N/D</li> : data.busyHours.map((h) => (
              <li key={h.hour}>{String(h.hour).padStart(2,'0')}:00 — {h.count} vendas</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Cancelamentos / No-shows</div>
          <div className="text-2xl font-semibold mt-2">{data.canceled} / {data.noShows}</div>
        </div>
      </div>
    </div>
  );
}
