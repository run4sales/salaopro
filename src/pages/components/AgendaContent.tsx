import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, List, Upload } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AgendaCalendar, AgendaEvent } from "@/components/agenda/AgendaCalendar";
import { AppointmentFormDialog } from "@/components/agenda/AppointmentFormDialog";
import { AppointmentDetailsDialog } from "@/components/agenda/AppointmentDetailsDialog";
import ImportAppointmentsDialog from "@/components/agenda/ImportAppointmentsDialog";
import { STATUS_LABELS, STATUS_VARIANTS, STATUS_OPTIONS, normalizeStatus } from "@/lib/appointmentStatus";

export default function AgendaContent() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const establishmentId = profile?.id as string | undefined;

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [range, setRange] = useState<{ start: Date; end: Date }>(() => {
    const s = new Date(); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  });
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [initialSlot, setInitialSlot] = useState<Date | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["agenda", establishmentId, range.start.toISOString(), range.end.toISOString()],
    enabled: !!establishmentId,
    queryFn: async () => {
      const [apptRes, servicesRes, profRes, clientsRes] = await Promise.all([
        supabase.from("appointments").select("id, establishment_id, appointment_date, status, notes, client_id, service_id, professional_id")
          .eq("establishment_id", establishmentId)
          .gte("appointment_date", range.start.toISOString())
          .lte("appointment_date", range.end.toISOString())
          .order("appointment_date", { ascending: true }),
        supabase.from("services").select("id, name, duration_minutes").eq("establishment_id", establishmentId).eq("active", true),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId).eq("active", true),
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId).order("name"),
      ]);
      if (apptRes.error) throw apptRes.error;
      const appts = apptRes.data ?? [];
      const services = servicesRes.data ?? [];
      const professionals = profRes.data ?? [];
      const clients = clientsRes.data ?? [];
      const serviceMap = new Map(services.map((s: any) => [s.id, s]));
      const profMap = new Map(professionals.map((p: any) => [p.id, p.name]));
      const clientMap = new Map(clients.map((c: any) => [c.id, c.name]));
      return { appts, serviceMap, profMap, clientMap, services, professionals, clients };
    },
  });

  const events: AgendaEvent[] = useMemo(() => {
    if (!data) return [];
    return data.appts.map((a: any) => {
      const svc: any = data.serviceMap.get(a.service_id);
      const start = new Date(a.appointment_date);
      const dur = svc?.duration_minutes ?? 30;
      const end = new Date(start.getTime() + dur * 60_000);
      const client = data.clientMap.get(a.client_id) ?? "Cliente";
      const sname = svc?.name ?? "Serviço";
      return { id: a.id, title: `${client} · ${sname}`, start, end, status: a.status, raw: a };
    });
  }, [data]);

  const slug = (profile as any)?.slug as string | undefined;
  const publicLink = establishmentId ? `${window.location.origin}/${slug ?? `agendar/${establishmentId}`}` : "";

  const copyLink = async () => {
    if (!publicLink) return;
    try { await navigator.clipboard.writeText(publicLink); toast({ title: "Link copiado" }); } catch {}
  };

  const handleNew = () => { setSelectedAppt(null); setInitialSlot(null); setFormOpen(true); };
  const handleSlot = (slot: any) => { setSelectedAppt(null); setInitialSlot(slot.start); setFormOpen(true); };
  const handleEventClick = (e: AgendaEvent) => { setSelectedAppt(e.raw); setDetailsOpen(true); };

  const refresh = () => qc.invalidateQueries({ queryKey: ["agenda"] });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    refresh();
  };

  if (!establishmentId) return <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando perfil...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">Link público da agenda</div>
          <a href={publicLink} className="text-sm font-medium break-all underline underline-offset-4" target="_blank" rel="noreferrer">{publicLink}</a>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} variant="outline" size="sm">
            <ToggleGroupItem value="calendar" aria-label="Calendário"><CalendarDays className="h-4 w-4 mr-1" />Calendário</ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Lista"><List className="h-4 w-4 mr-1" />Lista</ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={copyLink} variant="outline">Copiar link</Button>
          <Button onClick={() => setImportOpen(true)} variant="outline"><Upload className="h-4 w-4 mr-1" /> Importar</Button>
          <Button onClick={handleNew}><Plus className="h-4 w-4 mr-1" /> Novo agendamento</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando agendamentos...</div>
      ) : error ? (
        <div className="rounded-md border p-6 bg-card text-sm text-destructive">Erro ao carregar agenda.</div>
      ) : viewMode === "calendar" ? (
        <AgendaCalendar
          events={events}
          onSelectSlot={handleSlot}
          onSelectEvent={handleEventClick}
          onRangeChange={(r) => setRange(r)}
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.appts?.length ? data.appts.map((a: any) => {
                const key = normalizeStatus(a.status);
                return (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => { setSelectedAppt(a); setDetailsOpen(true); }}>
                    <TableCell>{new Date(a.appointment_date).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{data?.clientMap.get(a.client_id) ?? "-"}</TableCell>
                    <TableCell>{(data?.serviceMap.get(a.service_id) as any)?.name ?? "-"}</TableCell>
                    <TableCell>{data?.profMap.get(a.professional_id) ?? "-"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANTS[key] ?? "secondary"}>{STATUS_LABELS[key] ?? "Agendado"}</Badge></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={key} onValueChange={(v) => updateStatus(a.id, v)}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum agendamento no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {establishmentId && (
        <AppointmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          establishmentId={establishmentId}
          services={data?.services ?? []}
          professionals={data?.professionals ?? []}
          initialDate={initialSlot}
          appointment={selectedAppt}
          onSaved={refresh}
        />
      )}

      <AppointmentDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        appointment={selectedAppt}
        clientName={selectedAppt ? data?.clientMap.get(selectedAppt.client_id) : undefined}
        serviceName={selectedAppt ? (data?.serviceMap.get(selectedAppt.service_id) as any)?.name : undefined}
        professionalName={selectedAppt ? data?.profMap.get(selectedAppt.professional_id) : undefined}
        onEdit={() => { setDetailsOpen(false); setFormOpen(true); }}
        onChanged={refresh}
      />
    </div>
  );
}
