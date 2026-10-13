import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Ban, CheckCircle2, RefreshCw, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fmtBRL, fmtDate, STATUS_LABEL, STATUS_TONE, EFFECTIVE_STATUS_OPTIONS, logAdminAction } from "./shared";


import { billingCountdown, formatBillingDate, subscriptionDeadline } from "@/lib/subscriptionBilling";
import { adminSubscriptionStatus } from "@/lib/adminSubscriptionStatus";
import { fetchLastInvoicePayments } from "@/lib/adminInvoicePayments";
import { setSubscriptionAuthorization, refreshSubscriptionQueries, type AuthorizationAction } from '@/lib/adminSubscriptionAuthorization';
import { Checkbox } from '@/components/ui/checkbox';

type Row = {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  created_at: string;
  last_access_at: string | null;
  plan?: string | null;
  subscription?: {
    id: string;
    status: string;
    plan_id: string | null;
    monthly_amount: number;
    next_billing_at: string | null;
    manual_access_due_date?: string | null;
    trial_ends_at?: string | null;
    current_invoice_status?: string | null;
    current_invoice_due_date?: string | null;
    last_invoice_payment_at?: string | null;
    asaas_subscription_id: string | null;
    inferred?: boolean;
    effective_state?: string;
    plan?: { name: string };
  };

};

export default function AdminCompanies() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [editPlan, setEditPlan] = useState<string>("");
  const [billingTarget, setBillingTarget] = useState<Row | null>(null);
  const [billingStatus, setBillingStatus] = useState<string>("active");
  const [billingAmount, setBillingAmount] = useState<string>("");
  const [billingNextDate, setBillingNextDate] = useState<string>("");
  const [billingPaid, setBillingPaid] = useState(false);
  const [billingPaymentDate, setBillingPaymentDate] = useState('');
  const [billingRequestId, setBillingRequestId] = useState('');
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingPlanId, setBillingPlanId] = useState<string | undefined>();
  const [isSyncingAgendor, setIsSyncingAgendor] = useState(false);


  const profilesQuery = useQuery({
    queryKey: ["admin-companies"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: profiles, error } = await (supabase as any)
        .from("profiles")
        .select("id, business_name, owner_name, email, phone, created_at, last_access_at, plan")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const [{ data: subs, error: subsError }, { data: fetchedPlans, error: plansError }, { data: states, error: statesError }, lastPayments] = await Promise.all([
        (supabase as any)
          .from("subscriptions")
          .select("id, establishment_id, status, plan_id, monthly_amount, next_billing_at, manual_access_due_date, trial_ends_at, created_at, manual_blocked_at, current_invoice_status, current_invoice_due_date, asaas_subscription_id, subscription_plans!subscriptions_plan_id_fkey(name)"),
        (supabase as any)
          .from("subscription_plans")
          .select("id, name, slug, monthly_price")
          .eq("active", true),
        (supabase as any).rpc("get_admin_subscription_states"),
        fetchLastInvoicePayments(),
      ]);
      if (subsError) throw subsError;
      if (plansError) throw plansError;
      if (statesError) throw statesError;
      const stateMap = new Map<string, string>((states ?? []).map((row: any) => [row.establishment_id, row.state]));
      const subsMap = new Map<string, any>();
      (subs ?? []).forEach((s: any) => {
        subsMap.set(s.establishment_id, {
          id: s.id,
          status: s.status,
          plan_id: s.plan_id,
          monthly_amount: Number(s.monthly_amount || 0),
          next_billing_at: s.next_billing_at,
          manual_access_due_date: s.manual_access_due_date,
          trial_ends_at: s.trial_ends_at,
          current_invoice_status: s.current_invoice_status,
          current_invoice_due_date: s.current_invoice_due_date,
          last_invoice_payment_at: lastPayments.get(s.establishment_id) ?? null,
          asaas_subscription_id: s.asaas_subscription_id,
          effective_state: adminSubscriptionStatus(s, stateMap.get(s.establishment_id) ?? "no_subscription"),
          plan: s.subscription_plans ? { name: s.subscription_plans.name } : undefined,
        });
      });

      const plansBySlug = new Map<string, { id: string; name: string; slug: string; monthly_price: number }>();
      (fetchedPlans ?? []).forEach((p: any) => plansBySlug.set(p.slug, p));

      return (profiles ?? []).map((p: any) => {
        const subscription = subsMap.get(p.id);
        const chosenPlan = p.plan && p.plan !== "trial" ? plansBySlug.get(p.plan) : undefined;
        if (subscription) {
          return {
            ...p,
            subscription: {
              ...subscription,
              plan: subscription.plan ?? (chosenPlan ? { name: chosenPlan.name } : undefined),
              monthly_amount: Number(subscription.monthly_amount || chosenPlan?.monthly_price || 0),
            },
          };
        }
        return {
          ...p,
          subscription: {
            id: `profile-${p.id}`,
            status: "trial",
            plan_id: chosenPlan?.id ?? null,
            monthly_amount: Number(chosenPlan?.monthly_price || 0),
            next_billing_at: null,
            asaas_subscription_id: null,
            effective_state: "no_subscription",
            inferred: true,
            plan: chosenPlan ? { name: chosenPlan.name } : undefined,
          },
        };
      }) as Row[];
    },
  });

  const plansQuery = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("id, name, slug, monthly_price")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data as { id: string; name: string; slug: string; monthly_price: number }[];
    },
  });

  const rows = useMemo(() => {
    const data = profilesQuery.data ?? [];
    return data.filter((r) => {
      const effective = r.subscription?.effective_state ?? "no_subscription";
      if (statusFilter !== "all" && effective !== statusFilter) return false;
      if (planFilter !== "all" && r.subscription?.plan_id !== planFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.business_name?.toLowerCase().includes(s) ||
          r.owner_name?.toLowerCase().includes(s) ||
          r.email?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [profilesQuery.data, search, statusFilter, planFilter]);
  async function changeStatus(row: Row, status: string, action: string) {
    if (!row.subscription || row.subscription.inferred) return;
    if (status === 'active') {
      openBilling(row);
      setBillingStatus('active');
      return;
    }
    try {
      await setSubscriptionAuthorization({ establishmentId: row.id, action: status === 'canceled' ? 'cancel' : 'block' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar.');
      return;
    }

    // Ao bloquear, cancela também no Asaas (se existir assinatura lá)
    if (status === "blocked" && row.subscription.asaas_subscription_id) {
      try {
        const { error } = await supabase.functions.invoke("asaas-cancel-subscription", {
          body: { establishment_id: row.id },
        });
        if (error) throw error;
      } catch (e) {
        console.error("asaas-cancel-subscription invoke error", e);
        toast.warning("Status atualizado, mas a assinatura no Asaas pode não ter sido cancelada.");
      }
    }

    toast.success("Status atualizado");
    await refreshSubscriptionQueries(qc);
  }

  function openBilling(row: Row) {
    if (!row.subscription || row.subscription.inferred) return;
    setBillingTarget(row);
    setBillingStatus(row.subscription.status || "active");
    setBillingAmount(String(row.subscription.monthly_amount || ""));
    setBillingPaid(false);
    setBillingPlanId(undefined);
    setBillingRequestId(crypto.randomUUID());
    setBillingPaymentDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
    setBillingNextDate(
      row.subscription.manual_access_due_date ?? (row.subscription.next_billing_at
        ? new Date(row.subscription.next_billing_at).toISOString().slice(0, 10)
        : "")
    );
  }

  async function saveBilling() {
    if (!billingTarget?.subscription || savingBilling) return;
    const actions: Record<string, AuthorizationAction> = { active: billingPaid ? 'paid' : 'grant', trial: 'trial', past_due: 'pending', blocked: 'block', canceled: 'cancel', automatic: 'automatic' };
    const action = actions[billingStatus];
    if (!action) return;
    setSavingBilling(true);
    try {
      await setSubscriptionAuthorization({ establishmentId: billingTarget.id, action: billingPlanId && action === 'grant' ? 'plan' : action, dueDate: billingNextDate, amount: Number(billingAmount), paymentDate: billingPaymentDate, requestId: billingRequestId, planId: billingPlanId });
      toast.success('Autorização atualizada');
      setBillingTarget(null);
      await refreshSubscriptionQueries(qc);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setSavingBilling(false);
    }
  }


  async function syncExistingCompaniesToAgendor() {
    setIsSyncingAgendor(true);
    try {
      const { data, error } = await supabase.functions.invoke("agendor-sync-existing-companies", {
        body: { force: false },
      });

      if (error) throw error;

      const synced = Number((data as any)?.synced ?? 0);
      const failed = Number((data as any)?.failed ?? 0);
      const skipped = Number((data as any)?.skipped ?? 0);

      if (failed > 0) {
        toast.warning(`Agendor: ${synced} sincronizadas, ${failed} com erro e ${skipped} ignoradas.`);
      } else {
        toast.success(`Agendor: ${synced} empresas sincronizadas${skipped ? ` e ${skipped} ignoradas` : ""}.`);
      }

      await logAdminAction(user!.id, "agendor_sync_existing_companies_clicked", undefined, {
        synced,
        failed,
        skipped,
      });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    } catch (error) {
      console.error("agendor-sync-existing-companies invoke error", error);
      toast.error("Não foi possível sincronizar com o Agendor.");
    } finally {
      setIsSyncingAgendor(false);
    }
  }

  async function saveEdit() {
    if (!editTarget?.subscription || !editPlan) return;
    const plan = plansQuery.data?.find((p) => p.id === editPlan);
    if (!plan) return;
    if (!editTarget.subscription.inferred) {
      openBilling(editTarget);
      setBillingStatus('active');
      setBillingPlanId(plan.id);
      setBillingAmount(String(plan.monthly_price));
      setEditTarget(null);
      return;
    }
    const { error } = await (supabase as any)
          .from("subscriptions")
          .insert({
            establishment_id: editTarget.id,
            plan_id: plan.id,
            monthly_amount: plan.monthly_price,
            status: "trial",
            trial_ends_at: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
            next_billing_at: null,
          });
    if (error) {
      toast.error("Não foi possível alterar o plano.");
      return;
    }
    if (user) await logAdminAction(user.id, "change_plan", editTarget.id, {
      new_plan: plan.name,
      monthly: plan.monthly_price,
      created_subscription: Boolean(editTarget.subscription.inferred),
    });
    toast.success(`Plano alterado para ${plan.name}`);
    setEditTarget(null);
    setEditPlan("");
    qc.invalidateQueries({ queryKey: ["admin-companies"] });
    qc.invalidateQueries({ queryKey: ["admin-subs"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, responsável ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {EFFECTIVE_STATUS_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card border-border">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {plansQuery.data?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={syncExistingCompaniesToAgendor}
          disabled={isSyncingAgendor}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncingAgendor ? "animate-spin" : ""}`} />
          {isSyncingAgendor ? "Sincronizando..." : "Sincronizar Agendor"}
        </Button>
      </div>

      <Card className="bg-card/60 border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias para vencer</TableHead>
                  <TableHead>Última fatura paga em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const deadline = subscriptionDeadline(r.subscription);
                  const rawStatus = r.subscription?.status ?? "trial";
                  const status = r.subscription?.effective_state ?? "no_subscription";
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{r.business_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.owner_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.email && <div>{r.email}</div>}
                        {r.phone && <div>{r.phone}</div>}
                      </TableCell>
                      <TableCell>
                        {r.subscription?.plan?.name ?? <span className="text-muted-foreground">—</span>}
                        {r.subscription?.monthly_amount ? (
                          <div className="text-xs text-muted-foreground">{fmtBRL(r.subscription.monthly_amount)}/mês</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${STATUS_TONE[status]}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(r.last_access_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatBillingDate(deadline)}{r.subscription?.manual_access_due_date ? <div className="text-muted-foreground">Autorização manual</div> : r.subscription?.status === "trial" && <div className="text-muted-foreground">Fim do teste</div>}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{billingCountdown(deadline)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatBillingDate(r.subscription?.last_invoice_payment_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditTarget(r); setEditPlan(r.subscription?.plan_id ?? ""); }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Plano
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openBilling(r)} disabled={!r.subscription || r.subscription.inferred}>
                            <Wallet className="h-3.5 w-3.5" /> Cobrança
                          </Button>
                          {rawStatus === "blocked" ? (
                            <Button size="sm" variant="ghost" className="text-success" onClick={() => changeStatus(r, "active", "unblock")}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Desbloquear
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => changeStatus(r, "blocked", "block")}>
                              <Ban className="h-3.5 w-3.5" /> Bloquear
                            </Button>
                          )}
                        </div>

                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Nenhuma empresa encontrada com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Alterar plano — {editTarget?.business_name}</DialogTitle>
          </DialogHeader>
          <Select value={editPlan} onValueChange={setEditPlan}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent>
              {plansQuery.data?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {fmtBRL(p.monthly_price)}/mês
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={!editPlan}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!billingTarget} onOpenChange={(o) => !o && !savingBilling && setBillingTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar cobrança — {billingTarget?.business_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={billingStatus} onValueChange={setBillingStatus}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Em teste</SelectItem>
                  <SelectItem value="past_due">Pendente</SelectItem>
                  <SelectItem value="active">Ativo — autorização manual</SelectItem>
                  <SelectItem value="automatic">Retornar ao controle Asaas</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{billingPaid ? 'Valor recebido (R$)' : 'Valor mensal (R$)'}</Label>
              <Input
                type="number"
                step="0.01"
                value={billingAmount}
                onChange={(e) => setBillingAmount(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Vencimento autorizado para acesso</Label>
              <Input
                type="date"
                aria-label="Vencimento autorizado para acesso"
                value={billingNextDate}
                onChange={(e) => setBillingNextDate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            {billingStatus === 'active' && <div className="space-y-3">
              <div className="flex items-center gap-2"><Checkbox id="manual-paid" checked={billingPaid} onCheckedChange={v => setBillingPaid(v === true)} /><Label htmlFor="manual-paid">Registrar pagamento recebido</Label></div>
              {billingPaid && <div><Label htmlFor="manual-payment-date">Data do pagamento</Label><Input id="manual-payment-date" type="date" value={billingPaymentDate} onChange={e => setBillingPaymentDate(e.target.value)} /></div>}
            </div>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={savingBilling} onClick={() => setBillingTarget(null)}>Cancelar</Button>
            <Button onClick={saveBilling} disabled={savingBilling}>{savingBilling ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

