import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { ClientCombobox } from "@/components/ClientCombobox";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Pendente",
  pending: "Pendente",
  confirmed: "Confirmado",
  canceled: "Cancelado",
  cancelled: "Cancelado",
  completed: "Confirmado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "secondary",
  pending: "secondary",
  confirmed: "default",
  completed: "default",
  canceled: "destructive",
  cancelled: "destructive",
};

export default function AgendaContent() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const establishmentId = profile?.id as string | undefined;

  const start = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const end = useMemo(() => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(23,59,59,999); return d; }, []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", service_id: "", professional_id: "", appointment_date: "", notes: "", status: "scheduled" });
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["agenda", establishmentId, start.toISOString(), end.toISOString()],
    enabled: !!establishmentId,
    queryFn: async () => {
      const [apptRes, servicesRes, profRes, clientsRes] = await Promise.all([
        supabase.from("appointments").select("id, appointment_date, status, notes, client_id, service_id, professional_id").eq("establishment_id", establishmentId).gte("appointment_date", start.toISOString()).lte("appointment_date", end.toISOString()).order("appointment_date", { ascending: true }),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId).eq("active", true),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId).eq("active", true),
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId).order("name"),
      ]);
      if (apptRes.error) throw apptRes.error; if (servicesRes.error) throw servicesRes.error; if (profRes.error) throw profRes.error; if (clientsRes.error) throw clientsRes.error;

      const appts = apptRes.data ?? [];
      const services = servicesRes.data ?? [];
      const professionals = profRes.data ?? [];
      const clients = clientsRes.data ?? [];
      const serviceMap = new Map(services.map((s: any) => [s.id, s.name]));
      const profMap = new Map(professionals.map((p: any) => [p.id, p.name]));
      const clientMap = new Map(clients.map((c: any) => [c.id, c.name]));

      return { appts, serviceMap, profMap, clientMap, services, professionals, clients };
    }
  });

  const slug = (profile as any)?.slug as string | undefined;
  const publicLink = establishmentId ? `${window.location.origin}/${slug ?? `agendar/${establishmentId}`}` : "";

  const copyLink = async () => {
    if (!publicLink) return;
    try { await navigator.clipboard.writeText(publicLink); toast({ title: "Link copiado", description: "Envie para seus clientes" }); } catch {}
  };

  const resetForm = () => setForm({ client_id: "", service_id: "", professional_id: "", appointment_date: "", notes: "", status: "scheduled" });

  const handleCreate = async () => {
    if (!establishmentId) return;
    if (!form.client_id || !form.service_id || !form.appointment_date) {
      toast({ title: "Preencha cliente, serviço e data/hora", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      establishment_id: establishmentId,
      client_id: form.client_id,
      service_id: form.service_id,
      professional_id: form.professional_id || null,
      appointment_date: new Date(form.appointment_date).toISOString(),
      status: form.status,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Agendamento criado" });
    setOpen(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["agenda"] });
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["agenda"] });
  };

  if (!establishmentId) return <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando perfil...</div>;
  if (isLoading) return <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando agendamentos...</div>;
  if (error) return <div className="rounded-md border p-6 bg-card text-sm text-destructive">Erro ao carregar agenda.</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Link público da agenda</div>
          <a href={publicLink} className="text-sm font-medium break-all underline underline-offset-4" target="_blank" rel="noreferrer">{publicLink}</a>
        </div>
        <div className="flex gap-2">
          <Button onClick={copyLink} variant="outline">Copiar link</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Novo agendamento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Cliente *</label>
                  <div className="mt-1">
                    <ClientCombobox
                      establishmentId={establishmentId}
                      value={form.client_id}
                      onChange={(id) => setForm(f => ({ ...f, client_id: id }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Serviço</label>
                  <Select value={form.service_id} onValueChange={(v) => setForm(f => ({ ...f, service_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{data?.services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Profissional</label>
                  <Select value={form.professional_id} onValueChange={(v) => setForm(f => ({ ...f, professional_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{data?.professionals.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Data e hora</label>
                  <Input type="datetime-local" value={form.appointment_date} onChange={(e) => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Pendente</SelectItem>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Observações</label>
                  <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                </div>
                <Button className="w-full" disabled={saving} onClick={handleCreate}>{saving ? "Salvando..." : "Confirmar agendamento"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
              <TableHead className="w-[180px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.appts?.length ? data.appts.map((a: any) => {
              const key = (a.status || "scheduled").toLowerCase();
              return (
                <TableRow key={a.id}>
                  <TableCell>{new Date(a.appointment_date).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{data?.clientMap.get(a.client_id) ?? '-'}</TableCell>
                  <TableCell>{data?.serviceMap.get(a.service_id) ?? '-'}</TableCell>
                  <TableCell>{data?.profMap.get(a.professional_id) ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[key] ?? "secondary"}>{STATUS_LABELS[key] ?? "Pendente"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={key === "completed" ? "confirmed" : key} onValueChange={(v) => updateStatus(a.id, v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="canceled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum agendamento nos próximos 7 dias.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
