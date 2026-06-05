import { useEffect, useMemo, useState } from "react";
import { View } from "react-big-calendar";
import { addDays, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BUSINESS_HOURS_SELECT, DEFAULT_CLOSING_TIME, DEFAULT_OPENING_TIME, normalizeTimeValue } from "@/lib/businessHours";

type PeriodMode = "day" | "week" | "month" | "custom";
type Professional = { id: string; name: string };

const ALL_PROFESSIONALS = "all";
const FILTER_STORAGE_KEY = "agenda.professionalFilter";

const getWeekOptions = () => ({ locale: ptBR, weekStartsOn: 0 as const });

function getRangeForPeriod(periodMode: PeriodMode, date: Date) {
  if (periodMode === "day") {
    return { start: startOfDay(date), end: endOfDay(date) };
  }

  if (periodMode === "month") {
    return { start: startOfMonth(date), end: endOfMonth(date) };
  }

  return {
    start: startOfWeek(date, getWeekOptions()),
    end: endOfWeek(date, getWeekOptions()),
  };
}

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function fromDateInputValue(value: string, fallback: Date) {
  if (!value) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return fallback;
  return new Date(year, month - 1, day);
}

function formatRangeLabel(start: Date, end: Date) {
  return `${format(start, "dd/MM/yyyy")} até ${format(end, "dd/MM/yyyy")}`;
}

export default function AgendaContent() {
  const { profile, establishmentRole, professionalId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const establishmentId = profile?.id as string | undefined;
  const isEmployee = establishmentRole === "employee";

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>("week");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [periodMode, setPeriodMode] = useState<PeriodMode>("week");
  const [range, setRange] = useState<{ start: Date; end: Date }>(() => getRangeForPeriod("week", new Date()));
  const [customStart, setCustomStart] = useState(() => toDateInputValue(range.start));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(range.end));
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(() => {
    if (typeof window === "undefined") return ALL_PROFESSIONALS;
    return window.localStorage.getItem(FILTER_STORAGE_KEY) || ALL_PROFESSIONALS;
  });
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [initialSlot, setInitialSlot] = useState<Date | null>(null);

  const effectiveProfessionalId = isEmployee ? professionalId : selectedProfessionalId !== ALL_PROFESSIONALS ? selectedProfessionalId : null;

  useEffect(() => {
    if (!isEmployee || !professionalId) return;
    setSelectedProfessionalId(professionalId);
  }, [isEmployee, professionalId]);

  useEffect(() => {
    if (isEmployee || typeof window === "undefined") return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, selectedProfessionalId);
  }, [isEmployee, selectedProfessionalId]);

  useEffect(() => {
    if (periodMode !== "custom") {
      const nextRange = getRangeForPeriod(periodMode, calendarDate);
      setRange(nextRange);
      setCustomStart(toDateInputValue(nextRange.start));
      setCustomEnd(toDateInputValue(nextRange.end));
    }
  }, [periodMode, calendarDate]);

  useEffect(() => {
    if (periodMode !== "custom") return;
    const start = startOfDay(fromDateInputValue(customStart, range.start));
    const end = endOfDay(fromDateInputValue(customEnd, range.end));

    if (start <= end) {
      setRange({ start, end });
      setCalendarDate(start);
    }
  }, [customStart, customEnd, periodMode]);

  const { data: professionals = [] } = useQuery<Professional[]>({
    queryKey: ["agenda-professionals", establishmentId, isEmployee, professionalId],
    enabled: !!establishmentId,
    queryFn: async () => {
      let query = supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("name");

      if (isEmployee && professionalId) {
        query = query.eq("id", professionalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Professional[];
    },
  });

  useEffect(() => {
    if (isEmployee || selectedProfessionalId === ALL_PROFESSIONALS || professionals.length === 0) return;
    if (!professionals.some(professional => professional.id === selectedProfessionalId)) {
      setSelectedProfessionalId(ALL_PROFESSIONALS);
    }
  }, [isEmployee, professionals, selectedProfessionalId]);

  const { data: businessHours = { open: DEFAULT_OPENING_TIME, close: DEFAULT_CLOSING_TIME } } = useQuery({
    queryKey: ["business-hours", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("settings")
        .select(BUSINESS_HOURS_SELECT)
        .eq("establishment_id", establishmentId)
        .maybeSingle();
      if (error) throw error;
      return {
        open: normalizeTimeValue(data?.opening_time, DEFAULT_OPENING_TIME),
        close: normalizeTimeValue(data?.closing_time, DEFAULT_CLOSING_TIME),
      };
    },
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["agenda", establishmentId, range.start.toISOString(), range.end.toISOString(), effectiveProfessionalId],
    enabled: !!establishmentId && (!isEmployee || !!professionalId),
    queryFn: async () => {
      const appointmentFields = "id, establishment_id, appointment_date, status, notes, client_id, service_id, professional_id";
      const appointmentRangeQuery = () => supabase
        .from("appointments")
        .select(appointmentFields)
        .eq("establishment_id", establishmentId)
        .gte("appointment_date", range.start.toISOString())
        .lte("appointment_date", range.end.toISOString())
        .order("appointment_date", { ascending: true });

      const appointmentsPromise = effectiveProfessionalId
        ? Promise.all([
            appointmentRangeQuery().eq("professional_id", effectiveProfessionalId),
            supabase
              .from("appointments")
              .select(`${appointmentFields}, appointment_professionals!inner(professional_id)`)
              .eq("establishment_id", establishmentId)
              .eq("appointment_professionals.professional_id", effectiveProfessionalId)
              .gte("appointment_date", range.start.toISOString())
              .lte("appointment_date", range.end.toISOString())
              .order("appointment_date", { ascending: true }),
          ]).then(([primaryRes, linkedRes]) => {
            if (primaryRes.error) return primaryRes;
            if (linkedRes.error) return linkedRes;

            const byId = new Map<string, any>();
            [...(primaryRes.data ?? []), ...(linkedRes.data ?? [])].forEach((appointment: any) => {
              byId.set(appointment.id, appointment);
            });

            return {
              data: [...byId.values()].sort(
                (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
              ),
              error: null,
            };
          })
        : appointmentRangeQuery();

      let professionalsQuery = supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("name");

      if (isEmployee && professionalId) {
        professionalsQuery = professionalsQuery.eq("id", professionalId);
      }

      const [apptRes, servicesRes, profRes] = await Promise.all([
        appointmentsPromise,
        supabase.from("services").select("id, name, duration_minutes").eq("establishment_id", establishmentId).eq("active", true),
        professionalsQuery,
      ]);

      if (apptRes.error) throw apptRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (profRes.error) throw profRes.error;

      const appts = apptRes.data ?? [];
      const services = servicesRes.data ?? [];
      const activeProfessionals = (profRes.data ?? []) as Professional[];
      const clientIds = [...new Set(appts.map((appt: any) => appt.client_id).filter(Boolean))];
      const clientsRes = clientIds.length
        ? await supabase.from("clients").select("id, name").in("id", clientIds)
        : { data: [], error: null };

      if (clientsRes.error) throw clientsRes.error;

      const serviceMap = new Map(services.map((s: any) => [s.id, s]));
      const profMap = new Map(activeProfessionals.map((p: any) => [p.id, p.name]));
      const clientMap = new Map(((clientsRes.data ?? []) as any[]).map((c: any) => [c.id, c.name]));
      return { appts, serviceMap, profMap, clientMap, services, professionals: activeProfessionals };
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

  const selectedProfessionalName = effectiveProfessionalId
    ? professionals.find(professional => professional.id === effectiveProfessionalId)?.name ?? "Profissional"
    : "Todos os profissionais";

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

  const handlePeriodChange = (value: string) => {
    const nextPeriod = value as PeriodMode;
    setPeriodMode(nextPeriod);

    if (nextPeriod === "day") {
      setCalendarView("day");
    } else if (nextPeriod === "month") {
      setCalendarView("month");
    } else if (nextPeriod === "custom") {
      setCalendarView("agenda");
    } else {
      setCalendarView("week");
    }
  };

  const handleCalendarViewChange = (view: View) => {
    setCalendarView(view);
    if (view === "day" || view === "week" || view === "month") {
      setPeriodMode(view);
    }
  };

  const handleCalendarRangeChange = (nextRange: { start: Date; end: Date }) => {
    if (periodMode === "custom") return;
    setRange(nextRange);
    setCustomStart(toDateInputValue(nextRange.start));
    setCustomEnd(toDateInputValue(nextRange.end));
  };

  const navigateCustomRange = (direction: "previous" | "next") => {
    const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1);
    const move = direction === "next" ? addDays : subDays;
    const nextStart = move(range.start, days);
    const nextEnd = move(range.end, days);
    setCustomStart(toDateInputValue(nextStart));
    setCustomEnd(toDateInputValue(nextEnd));
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

      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_220px_minmax(260px,1fr)]">
          <div className="space-y-2">
            <Label>Profissional</Label>
            <Select
              value={isEmployee ? professionalId ?? "" : selectedProfessionalId}
              onValueChange={setSelectedProfessionalId}
              disabled={isEmployee}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {!isEmployee && <SelectItem value={ALL_PROFESSIONALS}>Todos os profissionais</SelectItem>}
                {professionals.map(professional => (
                  <SelectItem key={professional.id} value={professional.id}>{professional.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodMode} onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="custom">Intervalo personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{periodMode === "custom" ? "Intervalo" : "Período atual"}</Label>
            {periodMode === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input className="w-[145px]" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                <span className="text-sm text-muted-foreground">até</span>
                <Input className="w-[145px]" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={() => navigateCustomRange("previous")}>Anterior</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => navigateCustomRange("next")}>Próximo</Button>
              </div>
            ) : (
              <div className="flex min-h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                {formatRangeLabel(range.start, range.end)}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Exibindo {events.length} agendamento(s) para <strong className="text-foreground">{selectedProfessionalName}</strong>.</span>
          {isFetching && <span>Atualizando agenda...</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando agendamentos...</div>
      ) : error ? (
        <div className="rounded-md border p-6 bg-card text-sm text-destructive">Erro ao carregar agenda.</div>
      ) : viewMode === "calendar" ? (
        <AgendaCalendar
          events={events}
          view={calendarView}
          date={calendarDate}
          agendaLength={Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1)}
          openTime={businessHours.open}
          closeTime={businessHours.close}
          onViewChange={handleCalendarViewChange}
          onNavigate={setCalendarDate}
          onSelectSlot={handleSlot}
          onSelectEvent={handleEventClick}
          onRangeChange={handleCalendarRangeChange}
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

      {establishmentId && (
        <ImportAppointmentsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          establishmentId={establishmentId}
          onImported={refresh}
        />
      )}
    </div>
  );
}
