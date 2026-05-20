import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBRL, fmtDate, STATUS_LABEL, STATUS_TONE } from "./shared";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";

type SubRow = {
  id: string;
  establishment_id: string;
  status: string;
  monthly_amount: number;
  started_at: string;
  trial_ends_at: string | null;
  next_billing_at: string | null;
  profile?: { business_name: string };
  plan?: { name: string };
};

export default function AdminSubscriptions() {
  const subsQuery = useQuery({
    queryKey: ["admin-subscriptions-full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("id, establishment_id, status, monthly_amount, started_at, trial_ends_at, next_billing_at, profiles!subscriptions_establishment_id_fkey(business_name), subscription_plans(name)")
        .order("started_at", { ascending: false });
      // fallback if FK alias not available
      if (error) {
        const { data: data2 } = await (supabase as any)
          .from("subscriptions")
          .select("id, establishment_id, status, monthly_amount, started_at, trial_ends_at, next_billing_at, subscription_plans(name)");
        const { data: profs } = await supabase.from("profiles").select("id, business_name");
        const map = new Map<string, string>();
        (profs ?? []).forEach((p: any) => map.set(p.id, p.business_name));
        return (data2 ?? []).map((s: any) => ({
          ...s,
          plan: s.subscription_plans,
          profile: { business_name: map.get(s.establishment_id) ?? "—" },
        })) as SubRow[];
      }
      return (data ?? []).map((s: any) => ({
        ...s,
        plan: s.subscription_plans,
        profile: s.profiles,
      })) as SubRow[];
    },
  });

  const all = subsQuery.data ?? [];
  const now = Date.now();
  const in7days = now + 7 * 24 * 3600 * 1000;

  const trialsActive = all.filter((s) => s.status === "trial");
  const trialsExpiring = trialsActive.filter(
    (s) => s.trial_ends_at && new Date(s.trial_ends_at).getTime() < in7days
  );
  const overdue = all.filter((s) => s.status === "past_due");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-card/60 border-accent/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-accent" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Trials ativos</div>
              <div className="text-2xl font-bold text-accent">{trialsActive.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-warning/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-warning" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Trials expirando (7 dias)</div>
              <div className="text-2xl font-bold text-warning">{trialsExpiring.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-destructive/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Inadimplentes</div>
              <div className="text-2xl font-bold text-destructive">{overdue.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/60 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Todas as assinaturas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor mensal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim do trial</TableHead>
                  <TableHead>Próxima cobrança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {all.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.profile?.business_name ?? "—"}</TableCell>
                    <TableCell>{s.plan?.name ?? <span className="text-muted-foreground">Sem plano</span>}</TableCell>
                    <TableCell>{fmtBRL(Number(s.monthly_amount || 0))}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${STATUS_TONE[s.status]}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(s.started_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(s.trial_ends_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(s.next_billing_at)}</TableCell>
                  </TableRow>
                ))}
                {all.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma assinatura registrada ainda.
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
