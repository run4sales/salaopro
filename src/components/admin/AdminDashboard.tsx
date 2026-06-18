import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Sparkles, Target } from "lucide-react";
import { fmtBRL } from "./shared";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";

type Sub = {
  establishment_id: string;
  status: string;
  monthly_amount: number;
  started_at: string;
  canceled_at: string | null;
  plan_id: string | null;
  plan?: { monthly_price: number; name?: string; slug?: string } | null;
};
type Profile = {
  id: string;
  created_at: string;
  plan?: string | null;
};
type Plan = { id: string; name: string; slug: string; monthly_price: number; display_order: number };

export default function AdminDashboard() {
  const metrics = useQuery({
    queryKey: ["admin-metrics-with-potential"],
    queryFn: async () => {
      const [{ data: subs, error: subsError }, { data: profiles, error: profilesError }, { data: plans, error: plansError }] = await Promise.all([
        (supabase as any)
          .from("subscriptions")
          .select("establishment_id, status, monthly_amount, started_at, canceled_at, plan_id, subscription_plans!subscriptions_plan_id_fkey(id, name, slug, monthly_price, display_order)"),
        (supabase as any).from("profiles").select("id, created_at, plan"),
        (supabase as any).from("subscription_plans").select("id, name, slug, monthly_price, display_order").order("display_order"),
      ]);
      if (subsError) throw subsError;
      if (profilesError) throw profilesError;
      if (plansError) throw plansError;

      const plansById = new Map<string, Plan>();
      const plansBySlug = new Map<string, Plan>();
      (plans ?? []).forEach((p: Plan) => {
        plansById.set(p.id, p);
        plansBySlug.set(p.slug, p);
      });

      const getProfilePlan = (profile: Profile) => {
        const selectedSlug = profile.plan !== "trial" ? profile.plan : null;
        return selectedSlug ? plansBySlug.get(selectedSlug) : undefined;
      };

      const subsByEstablishment = new Map<string, Sub>();
      (subs ?? []).forEach((s: any) => {
        const relationPlan = s.subscription_plans as Plan | null;
        const plan = relationPlan ?? (s.plan_id ? plansById.get(s.plan_id) : undefined);
        subsByEstablishment.set(s.establishment_id, {
          establishment_id: s.establishment_id,
          status: s.status,
          monthly_amount: Number(s.monthly_amount || plan?.monthly_price || 0),
          started_at: s.started_at,
          canceled_at: s.canceled_at,
          plan_id: s.plan_id ?? plan?.id ?? null,
          plan: plan ? { monthly_price: plan.monthly_price, name: plan.name, slug: plan.slug } : null,
        });
      });

      const list = (profiles ?? []).map((p: Profile) => {
        const sub = subsByEstablishment.get(p.id);
        const chosenPlan = getProfilePlan(p);
        const plan = sub?.plan ?? (chosenPlan ? { monthly_price: chosenPlan.monthly_price, name: chosenPlan.name, slug: chosenPlan.slug } : null);
        if (sub) {
          return {
            ...sub,
            monthly_amount: Number(sub.monthly_amount || chosenPlan?.monthly_price || 0),
            plan_id: sub.plan_id ?? chosenPlan?.id ?? null,
            plan,
          } satisfies Sub;
        }
        return {
          establishment_id: p.id,
          status: "trial",
          monthly_amount: Number(chosenPlan?.monthly_price || 0),
          started_at: p.created_at,
          canceled_at: null,
          plan_id: chosenPlan?.id ?? null,
          plan,
        } satisfies Sub;
      });

      return { list, profiles: (profiles ?? []) as Profile[], plans: (plans ?? []) as Plan[] };
    },
  });

  const list = metrics.data?.list ?? [];
  const profiles = metrics.data?.profiles ?? [];
  const plans = metrics.data?.plans ?? [];
  const active = list.filter((s) => s.status === "active");
  const trial = list.filter((s) => s.status === "trial");
  const canceled = list.filter((s) => s.status === "canceled");
  const potentialStatuses = new Set(["trial", "active"]);
  const potentialList = list.filter((s) => potentialStatuses.has(s.status));
  const mrr = active.reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0);
  const potentialMrr = potentialList.reduce((sum, s) => sum + Number(s.monthly_amount || s.plan?.monthly_price || 0), 0);
  const arr = mrr * 12;
  const arpu = active.length > 0 ? mrr / active.length : 0;
  const totalCompanies = profiles.length;

  // MRR evolution last 6 months
  const mrrEvolution = (() => {
    const months: { label: string; mrr: number; potential: number; date: Date }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const eligible = list.filter((s) => {
        const started = new Date(s.started_at);
        const canceledAt = s.canceled_at ? new Date(s.canceled_at) : null;
        return started < end && (!canceledAt || canceledAt >= d);
      });
      const monthMrr = eligible
        .filter((s) => s.status === "active")
        .reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0);
      const monthPotential = eligible
        .filter((s) => potentialStatuses.has(s.status))
        .reduce((sum, s) => sum + Number(s.monthly_amount || s.plan?.monthly_price || 0), 0);
      months.push({
        label: d.toLocaleDateString("pt-BR", { month: "short" }),
        mrr: monthMrr,
        potential: monthPotential,
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
      const novas = profiles.filter((p) => {
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

  const planCounts = (() => {
    const counts = new Map<string, { planId: string | null; name: string; price: number; total: number; active: number; trial: number }>();
    plans.forEach((plan) => {
      counts.set(plan.id, { planId: plan.id, name: plan.name, price: plan.monthly_price, total: 0, active: 0, trial: 0 });
    });
    list.forEach((sub) => {
      const key = sub.plan_id ?? sub.plan?.slug ?? "no-plan";
      const current = counts.get(key) ?? {
        planId: sub.plan_id,
        name: sub.plan?.name ?? "Sem plano definido",
        price: Number(sub.plan?.monthly_price || sub.monthly_amount || 0),
        total: 0,
        active: 0,
        trial: 0,
      };
      current.total += 1;
      if (sub.status === "active") current.active += 1;
      if (sub.status === "trial") current.trial += 1;
      counts.set(key, current);
    });
    return Array.from(counts.values()).filter((item) => item.total > 0);
  })();

  const kpis = [
    { label: "MRR", value: fmtBRL(mrr), icon: DollarSign, tone: "text-accent" },
    { label: "Potencial de MRR", value: fmtBRL(potentialMrr), icon: Target, tone: "text-success" },
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

      <Card className="bg-card/60 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Negócios por plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {planCounts.map((plan) => (
              <div key={plan.planId ?? plan.name} className="rounded-lg border border-border/60 bg-background/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtBRL(plan.price)}/mês</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-glow">{plan.total}</div>
                    <div className="text-xs text-muted-foreground">negócio{plan.total !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-success/10 px-3 py-2">
                    <div className="font-semibold text-success">{plan.active}</div>
                    <div className="text-xs text-muted-foreground">ativos</div>
                  </div>
                  <div className="rounded-md bg-accent/10 px-3 py-2">
                    <div className="font-semibold text-accent">{plan.trial}</div>
                    <div className="text-xs text-muted-foreground">trials</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                <Line type="monotone" dataKey="mrr" name="MRR" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--accent))", r: 4 }} />
                <Line type="monotone" dataKey="potential" name="Potencial" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
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
