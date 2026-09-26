import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CircleDollarSign, Lightbulb, Target, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { fetchRealizedSales, toPeriodRange } from "@/lib/finance/revenue";
import { calculateStrategicDashboard, type ForecastAppointment } from "@/lib/finance/strategicDashboard";
import { currencyBRL } from "@/components/reports/KpiCard";

type Props = { establishmentId: string; today: Date };

export function StrategicPanel({ establishmentId, today }: Props) {
  const month = today.getMonth();
  const year = today.getFullYear();
  const boundaries = useMemo(() => {
    const first = new Date(year, month, 1);
    const tomorrow = new Date(year, month, today.getDate() + 1);
    const last = new Date(year, month + 1, 0);
    return { salesRange: toPeriodRange(first, today), tomorrowISO: tomorrow.toISOString(), monthEndISO: toPeriodRange(first, last).endExclusiveISO };
  }, [year, month, today]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["strategic-dashboard", establishmentId, boundaries.tomorrowISO],
    enabled: !!establishmentId,
    queryFn: async () => {
      const [sales, goalResult] = await Promise.all([
        fetchRealizedSales(establishmentId, boundaries.salesRange),
        supabase.from("goals").select("target_amount")
          .eq("establishment_id", establishmentId).eq("month", month + 1).eq("year", year).maybeSingle(),
      ]);
      if (goalResult.error) throw goalResult.error;

      // Paginação explícita: a previsão não pode ser truncada em salões com mais de 1000 agendamentos.
      const appointments: ForecastAppointment[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: page, error: appointmentsError } = await supabase.from("appointments")
          .select("appointment_date, status, service_amount")
          .eq("establishment_id", establishmentId)
          .gte("appointment_date", boundaries.tomorrowISO)
          .lt("appointment_date", boundaries.monthEndISO)
          .order("appointment_date", { ascending: true })
          .range(offset, offset + 999);
        if (appointmentsError) throw appointmentsError;
        appointments.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }

      return calculateStrategicDashboard(
        sales, appointments, goalResult.data ? Number(goalResult.data.target_amount) : null,
        boundaries.tomorrowISO, boundaries.monthEndISO,
      );
    },
  });

  const figures = data ? [
    { label: "Faturamento realizado até o dia", value: currencyBRL(data.realized), icon: CircleDollarSign },
    { label: "Entrada prevista até o fim do mês", value: currencyBRL(data.forecast), icon: CalendarDays },
    { label: "Faturamento projetado", value: currencyBRL(data.projected), icon: TrendingUp, highlight: true },
    { label: "Meta do mês", value: data.goal === null ? "Não definida" : currencyBRL(data.goal), icon: Target },
    { label: "Falta para meta", value: data.remaining === null ? "—" : currencyBRL(data.remaining), icon: Target },
    { label: "Ticket médio", value: currencyBRL(data.ticket), icon: CircleDollarSign },
    { label: "Clientes atendidos", value: String(data.clients), icon: Users },
    { label: "Agendamentos futuros", value: String(data.futureCount), icon: CalendarDays },
  ] : [];

  return (
    <section aria-label="Visão estratégica do mês" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Visão estratégica</p>
          <h1 className="text-2xl font-bold text-foreground">{today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h1>
        </div>
        <span className="text-xs text-muted-foreground">Atualizado com vendas e agendamentos do mês</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : error ? (
        <p role="alert" className="border-l-2 border-destructive bg-destructive/10 p-4 text-sm text-destructive">Não foi possível carregar os indicadores do mês. Atualize a página para tentar novamente.</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0 border-y border-border md:grid-cols-4 md:gap-x-6">
            {figures.map(({ label, value, icon: Icon, highlight }) => (
              <div key={label} className="min-w-0 border-b border-border py-4 last:border-b-0 md:[&:nth-last-child(-n+4)]:border-b-0">
                <div className="flex items-start gap-2 text-xs text-muted-foreground"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{label}</div>
                <p className={`mt-2 break-words text-xl font-bold tabular-nums sm:text-2xl ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-3 border-l-2 border-primary bg-primary/5 p-4 md:items-center">
            <Lightbulb className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <h2 className="font-semibold">Beauty Core Insights</h2>
              {data.goal === null ? (
                <p>Defina sua meta mensal para acompanhar o que falta até o objetivo.</p>
              ) : data.remaining === 0 ? (
                <p>Sua meta projetada já foi atingida! A projeção está {currencyBRL(Math.max(0, data.projected - data.goal))} acima da meta.</p>
              ) : (
                <>
                  <p>Faltam <strong>{currencyBRL(data.remaining)}</strong> para atingir sua meta.</p>
                  <p>{data.needed === null ? "Ainda não há dados suficientes de ticket médio para calcular novos atendimentos." : `Com seu ticket médio atual de ${currencyBRL(data.ticket)}, você precisa de aproximadamente ${data.needed} ${data.needed === 1 ? "novo atendimento" : "novos atendimentos"}.`}</p>
                </>
              )}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={data.goal === null ? "/settings" : "/agenda"}>{data.goal === null ? "Definir meta" : "Ver agenda"}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}