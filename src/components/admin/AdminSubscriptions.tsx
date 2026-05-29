import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBRL, fmtDate, STATUS_LABEL, STATUS_TONE } from "./shared";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { fetchAdminOverview } from "./data";

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
      const overview = await fetchAdminOverview();
      const profilesMap = new Map(overview.profiles.map((p) => [p.id, p.business_name]));
      return overview.subscriptions.map((s) => ({
        id: s.id,
        establishment_id: s.establishment_id,
        status: s.status,
        monthly_amount: Number(s.monthly_amount || s.plan?.monthly_price || 0),
        started_at: s.started_at,
        trial_ends_at: s.trial_ends_at,
        next_billing_at: s.next_billing_at,
        plan: s.plan ? { name: s.plan.name } : undefined,
        profile: { business_name: profilesMap.get(s.establishment_id) ?? "—" },
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
