import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBRL } from "./shared";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--primary-glow))", "hsl(var(--success))"];

export default function AdminSaaSFinance() {
  const subsQuery = useQuery({
    queryKey: ["admin-finance-subs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("status, monthly_amount, started_at, plan_id, subscription_plans(name)");
      if (error) throw error;
      return (data ?? []) as { status: string; monthly_amount: number; started_at: string; plan_id: string; subscription_plans: { name: string } | null }[];
    },
  });

  const active = (subsQuery.data ?? []).filter((s) => s.status === "active");
  const mrr = active.reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0);
  const arr = mrr * 12;

  // Revenue per plan
  const perPlan = new Map<string, number>();
  active.forEach((s) => {
    const name = s.subscription_plans?.name ?? "Sem plano";
    perPlan.set(name, (perPlan.get(name) ?? 0) + Number(s.monthly_amount || 0));
  });
  const planData = Array.from(perPlan, ([name, value]) => ({ name, value }));

  // Revenue per month (12 months) — assumes active subs were paying since started_at
  const months: { label: string; receita: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = active
      .filter((s) => new Date(s.started_at) < end)
      .reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0);
    months.push({ label: d.toLocaleDateString("pt-BR", { month: "short" }), receita: total });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Receita mensal (MRR)</div>
            <div className="text-2xl font-bold text-accent">{fmtBRL(mrr)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Receita anual (ARR)</div>
            <div className="text-2xl font-bold text-primary-glow">{fmtBRL(arr)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Receita por assinatura média</div>
            <div className="text-2xl font-bold text-success">{fmtBRL(active.length > 0 ? mrr / active.length : 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card/60 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Receita mensal (últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Receita por plano</CardTitle>
          </CardHeader>
          <CardContent>
            {planData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma assinatura ativa ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {planData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
