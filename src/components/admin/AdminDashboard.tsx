import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Sparkles } from "lucide-react";
import { fmtBRL } from "./shared";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";

type Sub = { status: string; monthly_amount: number; started_at: string; canceled_at: string | null };
type Profile = { id: string; created_at: string };

export default function AdminDashboard() {
  const subs = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("status, monthly_amount, started_at, canceled_at");
      if (error) throw error;
      return (data ?? []) as Sub[];
    },
  });

  const profiles = useQuery({
    queryKey: ["admin-profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, created_at");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const list = subs.data ?? [];
  const active = list.filter((s) => s.status === "active");
  const trial = list.filter((s) => s.status === "trial");
  const canceled = list.filter((s) => s.status === "canceled");
  const mrr = active.reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0);
  const arr = mrr * 12;
  const arpu = active.length > 0 ? mrr / active.length : 0;
  const totalCompanies = profiles.data?.length ?? 0;

  // MRR evolution last 6 months
  const mrrEvolution = (() => {
    const months: { label: string; mrr: number; date: Date }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthMrr = list
        .filter((s) => {
          const started = new Date(s.started_at);
          const canceledAt = s.canceled_at ? new Date(s.canceled_at) : null;
          return s.status === "active" && started < end && (!canceledAt || canceledAt >= d);
        })
        .reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0);
      months.push({
        label: d.toLocaleDateString("pt-BR", { month: "short" }),
        mrr: monthMrr,
        date: d,
      });
    }
    return months;
  })();

  // New companies per month last 6 months
  const newPerMonth = (() => {
    const months: { label: string; novas: number; cancel: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const novas = (profiles.data ?? []).filter((p) => {
        const c = new Date(p.created_at);
        return c >= d && c < end;
      }).length;
      const cancel = list.filter((s) => {
        if (!s.canceled_at) return false;
        const c = new Date(s.canceled_at);
        return c >= d && c < end;
      }).length;
      months.push({ label: d.toLocaleDateString("pt-BR", { month: "short" }), novas, cancel });
    }
    return months;
  })();

  // Insights
  const currMrr = mrrEvolution[mrrEvolution.length - 1]?.mrr ?? 0;
  const prevMrr = mrrEvolution[mrrEvolution.length - 2]?.mrr ?? 0;
  const mrrDelta = prevMrr > 0 ? ((currMrr - prevMrr) / prevMrr) * 100 : 0;
  const churnRate = active.length + canceled.length > 0
    ? (canceled.length / (active.length + canceled.length)) * 100
    : 0;
  const trialConversion = trial.length + active.length > 0
    ? (active.length / (trial.length + active.length)) * 100
    : 0;

  const kpis = [
    { label: "MRR", value: fmtBRL(mrr), icon: DollarSign, tone: "text-accent" },
    { label: "ARR", value: fmtBRL(arr), icon: TrendingUp, tone: "text-primary-glow" },
    { label: "Ticket médio (ARPU)", value: fmtBRL(arpu), icon: TrendingUp, tone: "text-accent" },
    { label: "Empresas ativas", value: active.length, icon: Building2, tone: "text-success" },
    { label: "Em teste", value: trial.length, icon: Sparkles, tone: "text-accent" },
    { label: "Canceladas", value: canceled.length, icon: TrendingDown, tone: "text-destructive" },
    { label: "Total cadastradas", value: totalCompanies, icon: Users, tone: "text-primary-glow" },
    { label: "Churn rate", value: `${churnRate.toFixed(1)}%`, icon: AlertTriangle, tone: churnRate > 5 ? "text-destructive" : "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="bg-card/60 border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</span>
                <k.icon className={`h-4 w-4 ${k.tone}`} />
              </div>
              <div className={`text-2xl font-bold ${k.tone}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Variação do MRR</div>
            <div className={`text-lg font-semibold ${mrrDelta >= 0 ? "text-success" : "text-destructive"}`}>
              {mrrDelta >= 0 ? "+" : ""}{mrrDelta.toFixed(1)}% vs mês anterior
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Conversão Trial → Pago</div>
            <div className="text-lg font-semibold text-primary-glow">{trialConversion.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Alerta</div>
            <div className="text-sm text-muted-foreground">
              {churnRate > 10 ? "⚠️ Churn elevado este período" :
               trial.length > active.length ? "💡 Foque em converter trials" :
               "✓ Indicadores saudáveis"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/60 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={mrrEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--accent))", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Novas empresas vs Cancelamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={newPerMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="novas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cancel" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
