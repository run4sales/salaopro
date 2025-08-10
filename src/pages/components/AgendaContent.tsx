import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function AgendaContent() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const establishmentId = profile?.id as string | undefined;

  const start = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const end = useMemo(() => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(23,59,59,999); return d; }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["agenda", establishmentId, start.toISOString(), end.toISOString()],
    enabled: !!establishmentId,
    queryFn: async () => {
      const [apptRes, servicesRes, profRes] = await Promise.all([
        supabase.from("appointments").select("id, appointment_date, status, notes, client_id, service_id, professional_id").eq("establishment_id", establishmentId).gte("appointment_date", start.toISOString()).lte("appointment_date", end.toISOString()).order("appointment_date", { ascending: true }),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
      ]);
      if (apptRes.error) throw apptRes.error; if (servicesRes.error) throw servicesRes.error; if (profRes.error) throw profRes.error;

      const appts = apptRes.data ?? [];
      const serviceMap = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const profMap = new Map((profRes.data ?? []).map((p: any) => [p.id, p.name]));

      const clientIds = Array.from(new Set(appts.map((a: any) => a.client_id)));
      let clientMap = new Map<string, string>();
      if (clientIds.length) {
        const clientsRes = await supabase.from("clients").select("id, name").in("id", clientIds);
        if (clientsRes.error) throw clientsRes.error;
        clientMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
      }

      return { appts, serviceMap, profMap, clientMap };
    }
  });

  const publicLink = establishmentId ? `${window.location.origin}/agendar/${establishmentId}` : "";

  const copyLink = async () => {
    if (!publicLink) return;
    try { await navigator.clipboard.writeText(publicLink); toast({ title: "Link copiado", description: "Envie para seus clientes" }); } catch {}
  };

  if (!establishmentId) return <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando perfil...</div>;
  if (isLoading) return <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando agendamentos...</div>;
  if (error) return <div className="rounded-md border p-6 bg-card text-sm text-destructive">Erro ao carregar agenda.</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Link público da agenda</div>
          <a href={publicLink} className="text-sm font-medium break-all underline underline-offset-4" target="_blank" rel="noreferrer">{publicLink}</a>
        </div>
        <Button onClick={copyLink} variant="outline">Copiar link</Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.appts?.length ? data.appts.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{new Date(a.appointment_date).toLocaleString()}</TableCell>
                <TableCell>{data?.clientMap.get(a.client_id) ?? '-'}</TableCell>
                <TableCell>{data?.serviceMap.get(a.service_id) ?? '-'}</TableCell>
                <TableCell>{data?.profMap.get(a.professional_id) ?? '-'}</TableCell>
                <TableCell className="capitalize">{a.status}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum agendamento nos próximos 7 dias.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
