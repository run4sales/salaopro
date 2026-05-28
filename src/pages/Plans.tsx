import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Check, Crown, ArrowUpRight, Loader2, ExternalLink, CreditCard } from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const PAYMENT_STATUS: Record<string, { label: string; tone: string }> = {
  CONFIRMED: { label: "Pago", tone: "bg-success/15 text-success border-success/30" },
  RECEIVED: { label: "Pago", tone: "bg-success/15 text-success border-success/30" },
  PENDING: { label: "Pendente", tone: "bg-warning/15 text-warning border-warning/30" },
  OVERDUE: { label: "Vencido", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  REFUNDED: { label: "Estornado", tone: "bg-muted text-muted-foreground border-border" },
};

const SUB_STATUS: Record<string, { label: string; tone: string }> = {
  trial: { label: "Em teste", tone: "bg-accent/15 text-accent border-accent/30" },
  active: { label: "Ativa", tone: "bg-success/15 text-success border-success/30" },
  past_due: { label: "Em atraso", tone: "bg-warning/15 text-warning border-warning/30" },
  canceled: { label: "Cancelada", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  blocked: { label: "Bloqueada", tone: "bg-destructive/15 text-destructive border-destructive/30" },
};

type Plan = {
  id: string; slug: string; name: string;
  monthly_price: number; max_users: number | null; max_clients: number | null;
  features: any; display_order: number; active: boolean;
};

export default function Plans() {
  const { profile, establishmentRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [migrating, setMigrating] = useState<string | null>(null);

  const isAdmin = establishmentRole === "owner" || establishmentRole === "admin";
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const establishmentId = profile?.id;

  const subQuery = useQuery({
    queryKey: ["subscription-overview", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data: sub } = await (supabase as any)
        .from("subscriptions").select("*").eq("establishment_id", establishmentId).maybeSingle();
      const { data: plan } = sub?.plan_id
        ? await (supabase as any).from("subscription_plans").select("*").eq("id", sub.plan_id).maybeSingle()
        : { data: null };
      const { data: pendingPlan } = sub?.pending_plan_id
        ? await (supabase as any).from("subscription_plans").select("name, monthly_price").eq("id", sub.pending_plan_id).maybeSingle()
        : { data: null };
      const { count: userCount } = await (supabase as any)
        .from("establishment_users")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId)
        .eq("active", true);
      const { count: clientCount } = await (supabase as any)
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);
      return { sub, plan, pendingPlan, userCount: userCount ?? 0, clientCount: clientCount ?? 0 };
    },
  });

  const plansQuery = useQuery({
    queryKey: ["plans-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data as Plan[];
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ["subscription-invoices", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_payments")
        .select("*")
        .eq("establishment_id", establishmentId)
        .order("due_date", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { sub, plan, pendingPlan, userCount, clientCount } = subQuery.data ?? {} as any;

  async function migrate(target: Plan) {
    if (!sub) {
      toast.info("Você ainda não possui assinatura ativa.");
      navigate("/checkout");
      return;
    }
    if (plan?.id === target.id) return;

    const isUpgrade = Number(target.monthly_price) >= Number(sub.monthly_amount ?? 0);
    if (!confirm(
      isUpgrade
        ? `Confirmar upgrade para o plano ${target.name} por ${fmtBRL(target.monthly_price)}/mês? A cobrança é imediata.`
        : `Confirmar troca para ${target.name} (${fmtBRL(target.monthly_price)}/mês) a partir do próximo ciclo?`
    )) return;

    setMigrating(target.id);
    try {
      if (!sub.asaas_customer_id) {
        // Sem cliente Asaas ainda — redireciona pro checkout com o plano escolhido
        try { localStorage.setItem("signup_plan_slug", target.slug); } catch {}
        navigate("/checkout");
        return;
      }
      const { data, error } = await supabase.functions.invoke("asaas-change-plan", {
        body: { new_plan_id: target.id },
      });
      if (error) throw error;
      if ((data as any)?.scheduled) {
        toast.success("Troca agendada para o próximo ciclo.");
      } else {
        toast.success("Plano migrado com sucesso!");
        if ((data as any)?.payment_link) window.open((data as any).payment_link, "_blank");
      }
      qc.invalidateQueries({ queryKey: ["subscription-overview"] });
      qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível migrar de plano.");
    } finally {
      setMigrating(null);
    }
  }

  const statusInfo = SUB_STATUS[sub?.status ?? "trial"] ?? SUB_STATUS.trial;

  const userLimit = plan?.max_users ?? null;
  const clientLimit = plan?.max_clients ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planos & Assinatura</h1>
        <p className="text-muted-foreground text-sm">Gerencie seu plano, consumo e faturas.</p>
      </div>

      {/* Resumo */}
      <Card className="bg-card/60 border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Plano atual: {plan?.name ?? "Nenhum"}
            </span>
            <Badge variant="outline" className={statusInfo.tone}>{statusInfo.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric label="Valor mensal" value={fmtBRL(Number(sub?.monthly_amount ?? plan?.monthly_price ?? 0))} />
          <Metric
            label="Usuários"
            value={`${userCount ?? 0} / ${userLimit ?? "Ilimitado"}`}
            warn={userLimit != null && (userCount ?? 0) >= userLimit}
          />
          <Metric
            label="Clientes"
            value={`${clientCount ?? 0} / ${clientLimit ?? "Ilimitado"}`}
            warn={clientLimit != null && (clientCount ?? 0) >= clientLimit}
          />
          <Metric
            label={sub?.status === "trial" ? "Fim do teste" : "Próxima cobrança"}
            value={fmtDate(sub?.status === "trial" ? sub?.trial_ends_at : sub?.next_billing_at)}
          />
          {pendingPlan && (
            <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-warning/30 bg-warning/10 text-sm p-3">
              Troca agendada para <strong>{pendingPlan.name}</strong> ({fmtBRL(pendingPlan.monthly_price)}/mês)
              a partir de {fmtDate(sub?.pending_plan_effective_at)}.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planos disponíveis */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Trocar de plano</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {plansQuery.data?.map((p) => {
            const current = plan?.id === p.id;
            const recommended = p.slug === "profissional";
            const features: string[] = Array.isArray(p.features) ? p.features : [];
            return (
              <Card
                key={p.id}
                className={`relative ${
                  recommended
                    ? "border-primary/50 shadow-[0_0_24px_hsl(var(--primary)/0.25)]"
                    : "border-border/60"
                }`}
              >
                {recommended && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground border-0">
                    Mais popular
                  </Badge>
                )}
                {current && (
                  <Badge variant="outline" className="absolute -top-2 right-3 bg-success/15 text-success border-success/30">
                    Plano atual
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between">
                    <span>{p.name}</span>
                    <span className="text-2xl font-bold text-primary">
                      {fmtBRL(p.monthly_price)}
                      <span className="text-xs text-muted-foreground font-normal">/mês</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {p.max_users ? `Até ${p.max_users} usuário${p.max_users > 1 ? "s" : ""}` : "Usuários ilimitados"}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {p.max_clients ? `Até ${p.max_clients} clientes` : "Clientes ilimitados"}
                    </li>
                    {features.filter((f) => f !== "Mais popular").map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={current ? "outline" : "default"}
                    disabled={current || migrating === p.id}
                    onClick={() => migrate(p)}
                  >
                    {migrating === p.id ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Migrando...</>
                    ) : current ? (
                      "Plano atual"
                    ) : (
                      <>Migrar para {p.name} <ArrowUpRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Faturas */}
      <Card className="bg-card/60 border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Faturas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoicesQuery.data ?? []).map((inv: any) => {
                  const st = PAYMENT_STATUS[inv.status] ?? { label: inv.status, tone: "border-border text-muted-foreground" };
                  const url = inv.invoice_url || inv.bank_slip_url;
                  const isPaid = inv.status === "CONFIRMED" || inv.status === "RECEIVED";
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{fmtDate(inv.due_date)}</TableCell>
                      <TableCell><Badge variant="outline" className={st.tone}>{st.label}</Badge></TableCell>
                      <TableCell>{fmtBRL(Number(inv.value ?? 0))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.billing_type ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {url && (
                          <Button size="sm" variant={isPaid ? "outline" : "default"} asChild>
                            <a href={url} target="_blank" rel="noreferrer">
                              {isPaid ? "Ver" : "Pagar"} <ExternalLink className="h-3.5 w-3.5 ml-1" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!invoicesQuery.data?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma fatura ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-warning/40 bg-warning/5" : "border-border/60 bg-background/40"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${warn ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}
