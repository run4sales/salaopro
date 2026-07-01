import { useMemo, useState } from "react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { CalendarOff, Clock, Play, RefreshCw, UserX } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ensureComandaForAppointment } from "@/lib/comanda";
import { normalizeStatus, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/appointmentStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Period = "today" | "week" | "next7";

type EmployeeContext = {
  establishmentId: string | null;
  professionalId: string | null;
};

function getRange(period: Period) {
  const today = new Date();
  if (period === "today") return { start: startOfDay(today), end: endOfDay(today) };
  return { start: startOfDay(today), end: endOfDay(addDays(today, 7)) };
}

export default function EmployeeAgendaContent() {
  const { user, profile, professionalId: authProfessionalId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("week");
  const range = useMemo(() => getRange(period), [period]);

  const contextQuery = useQuery<EmployeeContext>({
    queryKey: ["employee-agenda-context", user?.id, profile?.id, authProfessionalId],
    enabled: !!user?.id,
    queryFn: async () => {
      if (profile?.id && authProfessionalId) {
        return { establishmentId: profile.id as string, professionalId: authProfessionalId };
      }

      const { data, error } = await (supabase as any)
        .from("establishment_users")
        .select("establishment_id, professional_id")
        .eq("user_id", user!.id)
        .eq("active", true)
        .maybeSingle();

      if (error) throw error;
      return {
        establishmentId: (profile?.id as string | undefined) ?? data?.establishment_id ?? null,
        professionalId: authProfessionalId ?? data?.professional_id ?? null,
      };
    },
  });

  const establishmentId = contextQuery.data?.establishmentId ?? null;
  const professionalId = contextQuery.data?.professionalId ?? null;

  const agendaQuery = useQuery({
    queryKey: ["employee-agenda-data", establishmentId, professionalId, range.start.toISOString(), range.end.toISOString()],
    enabled: !!establishmentId && !!professionalId,
    queryFn: async () => {
      const appointmentsRes = await supabase
        .from("appointments")
        .select("id, establishment_id, appointment_date, duration_minutes, service_amount, status, notes, client_id, service_id, professional_id")
        .eq("establishment_id", establishmentId!)
        .eq("professional_id", professionalId!)
        .gte("appointment_date", range.start.toISOString())
        .lte("appointment_date", range.end.toISOString())
        .order("appointment_date", { ascending: true });

      if (appointmentsRes.error) throw appointmentsRes.error;
      const appointments = (appointmentsRes.data ?? []).filter((a: any) => !["canceled", "cancelled"].includes(String(a.status ?? "").toLowerCase()));
      const clientIds = [...new Set(appointments.map((a: any) => a.client_id).filter(Boolean))];
      const serviceIds = [...new Set(appointments.map((a: any) => a.service_id).filter(Boolean))];

      const [clientsRes, servicesRes, professionalRes] = await Promise.all([
        clientIds.length ? supabase.from("clients").select("id, name").eq("establishment_id", establishmentId!).in("id", clientIds) : Promise.resolve({ data: [], error: null }),
        serviceIds.length ? supabase.from("services").select("id, name, duration_minutes").eq("establishment_id", establishmentId!).in("id", serviceIds) : Promise.resolve({ data: [], error: null }),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId!).eq("id", professionalId!).maybeSingle(),
      ]);

      return {
        appointments,
        clientMap: new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name])),
        serviceMap: new Map((servicesRes.data ?? []).map((s: any) => [s.id, s])),
        professionalName: (professionalRes.data as any)?.name ?? "Profissional",
      };
    },
  });

  const startService = async (appointment: any) => {
    try {
      await supabase.from("appointments").update({ status: "in_service" }).eq("id", appointment.id);
      await ensureComandaForAppointment({
        establishment_id: appointment.establishment_id,
        appointment_id: appointment.id,
        client_id: appointment.client_id,
        service_id: appointment.service_id,
        professional_id: appointment.professional_id,
      });
      toast({ title: "Atendimento iniciado", description: "Comanda aberta." });
      await qc.invalidateQueries({ queryKey: ["employee-agenda-data"] });
      navigate("/atendimentos");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  if (contextQuery.isLoading) {
    return <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando vínculo do funcionário...</div>;
  }

  if (!professionalId) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        <UserX className="h-10 w-10 mx-auto mb-3 opacity-60" />
        <div className="font-medium text-foreground">Perfil funcionário sem profissional vinculado</div>
        <p className="mt-1">Peça para a administração vincular seu usuário a um profissional para visualizar sua agenda e atendimentos.</p>
      </CardContent></Card>
    );
  }

  const appointments = agendaQuery.data?.appointments ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Área do funcionário</div>
          <div className="text-sm font-medium">{agendaQuery.data?.professionalName ?? "Seus agendamentos"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Próximos 7 dias</SelectItem>
              <SelectItem value="next7">Semana</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => agendaQuery.refetch()} disabled={agendaQuery.isFetching}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {agendaQuery.isLoading ? (
        <div className="rounded-md border p-6 bg-card text-sm text-muted-foreground">Carregando seus agendamentos...</div>
      ) : appointments.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <CalendarOff className="h-10 w-10 mx-auto mb-3 opacity-60" />
          Você ainda não possui atendimentos agendados.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {appointments.map((appointment: any) => {
            const status = normalizeStatus(appointment.status);
            const service: any = agendaQuery.data?.serviceMap.get(appointment.service_id);
            return (
              <Card key={appointment.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{agendaQuery.data?.clientMap.get(appointment.client_id) ?? "Cliente"}</div>
                      <div className="text-sm text-muted-foreground">{service?.name ?? "Serviço"}</div>
                    </div>
                    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>{STATUS_LABELS[status] ?? "Agendado"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> {format(new Date(appointment.appointment_date), "dd/MM/yyyy HH:mm")}
                  </div>
                  {appointment.notes && <p className="text-sm text-muted-foreground border-t pt-2">{appointment.notes}</p>}
                  {status !== "in_service" && status !== "completed" && (
                    <Button className="w-full" onClick={() => startService(appointment)}>
                      <Play className="h-4 w-4 mr-1" /> Iniciar atendimento
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
