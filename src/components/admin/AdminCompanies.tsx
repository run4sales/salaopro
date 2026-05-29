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
import { fmtBRL, fmtDate, STATUS_LABEL, STATUS_TONE, logAdminAction } from "./shared";


type Row = {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  created_at: string;
  last_access_at: string | null;
  subscription?: {
    id: string;
    status: string;
    plan_id: string | null;
    monthly_amount: number;
    next_billing_at: string | null;
    asaas_subscription_id: string | null;
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


  const profilesQuery = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, business_name, owner_name, email, phone, created_at, last_access_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: subs } = await (supabase as any)
        .from("subscriptions")
        .select("id, establishment_id, status, plan_id, monthly_amount, next_billing_at, asaas_subscription_id, subscription_plans(name)");
      const subsMap = new Map<string, any>();
      (subs ?? []).forEach((s: any) => {
        subsMap.set(s.establishment_id, {
          id: s.id,
          status: s.status,
          plan_id: s.plan_id,
          monthly_amount: Number(s.monthly_amount || 0),
          next_billing_at: s.next_billing_at,
          asaas_subscription_id: s.asaas_subscription_id,
          plan: s.subscription_plans ? { name: s.subscription_plans.name } : undefined,
        });
      });

      return (profiles ?? []).map((p: any) => ({ ...p, subscription: subsMap.get(p.id) })) as Row[];
    },
  });

  const plansQuery = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("id, name, monthly_price")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data as { id: string; name: string; monthly_price: number }[];
    },
  });

  const rows = useMemo(() => {
    const data = profilesQuery.data ?? [];
    return data.filter((r) => {
      if (statusFilter !== "all" && r.subscription?.status !== statusFilter) return false;
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
    if (!row.subscription) return;
    const updates: any = { status };
    if (status === "canceled" || status === "blocked") updates.canceled_at = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("subscriptions")
      .update(updates)
      .eq("id", row.subscription.id);
    if (error) {
      toast.error("Não foi possível atualizar. Tente novamente.");
      return;
    }

    // Ao bloquear, cancela também no Asaas (se existir assinatura lá)
    if (status === "blocked" && row.subscription.asaas_subscription_id) {
      try {
        await supabase.functions.invoke("asaas-cancel-subscription", {
          body: { establishment_id: row.id },
        });
      } catch (e) {
        console.error("asaas-cancel-subscription invoke error", e);
        toast.warning("Status atualizado, mas a assinatura no Asaas pode não ter sido cancelada.");
      }
    }

    await logAdminAction(user!.id, action, row.id, { new_status: status, business: row.business_name });
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["admin-companies"] });
    qc.invalidateQueries({ queryKey: ["admin-subs"] });
  }

  function openBilling(row: Row) {
    if (!row.subscription) return;
    setBillingTarget(row);
    setBillingStatus(row.subscription.status || "active");
    setBillingAmount(String(row.subscription.monthly_amount || ""));
    setBillingNextDate(
      row.subscription.next_billing_at
        ? new Date(row.subscription.next_billing_at).toISOString().slice(0, 10)
        : ""
    );
  }

  async function saveBilling() {
    if (!billingTarget?.subscription) return;
    const updates: any = {
      status: billingStatus,
      monthly_amount: Number(billingAmount) || 0,
    };
    if (billingNextDate) {
      updates.next_billing_at = new Date(billingNextDate + "T12:00:00").toISOString();
    } else {
      updates.next_billing_at = null;
    }
    if (billingStatus === "active") updates.last_payment_at = new Date().toISOString();

    const { error } = await (supabase as any)
      .from("subscriptions")
      .update(updates)
      .eq("id", billingTarget.subscription.id);
    if (error) {
      toast.error("Não foi possível salvar a cobrança.");
      return;
    }
    await logAdminAction(user!.id, "manual_billing_update", billingTarget.id, updates);
    toast.success("Cobrança atualizada");
    setBillingTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-companies"] });
    qc.invalidateQueries({ queryKey: ["admin-subs"] });
  }


  async function saveEdit() {
    if (!editTarget?.subscription || !editPlan) return;
    const plan = plansQuery.data?.find((p) => p.id === editPlan);
    if (!plan) return;
    const { error } = await (supabase as any)
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        monthly_amount: plan.monthly_price,
        status: "active",
        next_billing_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      })
      .eq("id", editTarget.subscription.id);
    if (error) {
      toast.error("Não foi possível alterar o plano.");
      return;
    }
    await logAdminAction(user!.id, "change_plan", editTarget.id, {
      new_plan: plan.name,
      monthly: plan.monthly_price,
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
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const status = r.subscription?.status ?? "trial";
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditTarget(r); setEditPlan(r.subscription?.plan_id ?? ""); }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Plano
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openBilling(r)} disabled={!r.subscription}>
                            <Wallet className="h-3.5 w-3.5" /> Cobrança
                          </Button>
                          {status === "blocked" ? (
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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


      <Dialog open={!!billingTarget} onOpenChange={(o) => !o && setBillingTarget(null)}>
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
                  <SelectItem value="active">Ativo (pago)</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Valor mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={billingAmount}
                onChange={(e) => setBillingAmount(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data da próxima fatura</Label>
              <Input
                type="date"
                value={billingNextDate}
                onChange={(e) => setBillingNextDate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingTarget(null)}>Cancelar</Button>
            <Button onClick={saveBilling}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

