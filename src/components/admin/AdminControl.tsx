import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert } from "lucide-react";
import AdminAgendorSync from "./agendor/SyncPanel";

type LogRow = {
  id: string;
  admin_user_id: string;
  action: string;
  target_establishment_id: string | null;
  details: any;
  created_at: string;
  target_name?: string;
};

const ACTION_LABEL: Record<string, string> = {
  block: "🚫 Bloqueio",
  unblock: "✅ Desbloqueio",
  change_plan: "🔄 Alteração de plano",
  cancel: "❌ Cancelamento",
  reset: "🔁 Reset de acesso",
  mark_overdue: "⚠️ Marcar inadimplente",
};

export default function AdminControl() {
  const logsQuery = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("admin_actions_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const { data: profs } = await supabase.from("profiles").select("id, business_name");
      const map = new Map<string, string>();
      (profs ?? []).forEach((p: any) => map.set(p.id, p.business_name));
      return (data ?? []).map((l: any) => ({
        ...l,
        target_name: l.target_establishment_id ? map.get(l.target_establishment_id) ?? "—" : "—",
      })) as LogRow[];
    },
  });

  return (
    <div className="space-y-6">
      <AdminAgendorSync />

      <Card className="bg-card/60 border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">Auditoria de ações administrativas</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Registro de bloqueios, desbloqueios e mudanças de plano. As ações são realizadas na aba Empresas.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logsQuery.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{ACTION_LABEL[l.action] ?? l.action}</TableCell>
                    <TableCell>{l.target_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.details ? JSON.stringify(l.details) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!logsQuery.data || logsQuery.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma ação administrativa registrada ainda.
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
