import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarX2, CircleDollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard, currencyBRL } from "./KpiCard";
import { summarizeCanceledAppointments } from "@/lib/canceledAppointments";
import { toPeriodRange } from "@/lib/finance/revenue";

interface Props { establishmentId: string; startDate: Date; endDate: Date }
type Named = { id: string; name: string };

export function CanceledAppointmentsReport({ establishmentId, startDate, endDate }: Props) {
  const range = useMemo(() => toPeriodRange(startDate, endDate), [startDate, endDate]);
  const [clientFilter, setClientFilter] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "canceled-appointments", establishmentId, range.startISO, range.endExclusiveISO],
    queryFn: async () => {
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, appointment_date, updated_at, canceled_at, cancellation_reason, client_id, professional_id, service_id, service_amount, status")
        .eq("establishment_id", establishmentId)
        .in("status", ["canceled", "cancelled"])
        .gte("appointment_date", range.startISO)
        .lt("appointment_date", range.endExclusiveISO)
        .order("appointment_date", { ascending: false })
        .limit(1000);
      if (appointmentsError) throw appointmentsError;

      const rows = appointments ?? [];
      const appointmentIds = rows.map((row) => row.id);
      const [clientsResult, professionalsResult, servicesResult, linkedProfessionalsResult, linkedServicesResult] = await Promise.all([
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
        appointmentIds.length ? supabase.from("appointment_professionals").select("appointment_id, professional_id").eq("establishment_id", establishmentId).in("appointment_id", appointmentIds) : Promise.resolve({ data: [], error: null }),
        appointmentIds.length ? supabase.from("appointment_services").select("appointment_id, service_id").eq("establishment_id", establishmentId).in("appointment_id", appointmentIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const queryError = clientsResult.error || professionalsResult.error || servicesResult.error || linkedProfessionalsResult.error || linkedServicesResult.error;
      if (queryError) throw queryError;

      const clients = (clientsResult.data ?? []) as Named[];
      const professionals = (professionalsResult.data ?? []) as Named[];
      const services = (servicesResult.data ?? []) as Named[];
      const clientNames = new Map(clients.map((item) => [item.id, item.name]));
      const professionalNames = new Map(professionals.map((item) => [item.id, item.name]));
      const serviceNames = new Map(services.map((item) => [item.id, item.name]));
      const professionalsByAppointment = new Map<string, string[]>();
      const servicesByAppointment = new Map<string, string[]>();

      for (const link of linkedProfessionalsResult.data ?? []) {
        const ids = professionalsByAppointment.get(link.appointment_id) ?? [];
        ids.push(link.professional_id);
        professionalsByAppointment.set(link.appointment_id, ids);
      }
      for (const link of linkedServicesResult.data ?? []) {
        const ids = servicesByAppointment.get(link.appointment_id) ?? [];
        ids.push(link.service_id);
        servicesByAppointment.set(link.appointment_id, ids);
      }

      return {
        clients,
        professionals,
        services,
        rows: rows.map((row) => {
          const professionalIds = professionalsByAppointment.get(row.id) ?? (row.professional_id ? [row.professional_id] : []);
          const serviceIds = servicesByAppointment.get(row.id) ?? (row.service_id ? [row.service_id] : []);
          return {
            ...row,
            clientName: clientNames.get(row.client_id) ?? "Cliente não encontrado",
            professionalIds,
            professionalNames: professionalIds.map((id) => professionalNames.get(id) ?? "Profissional não encontrado"),
            serviceIds,
            serviceNames: serviceIds.map((id) => serviceNames.get(id) ?? "Serviço não encontrado"),
          };
        }),
      };
    },
  });

  const filteredRows = useMemo(() => {
    const search = clientFilter.trim().toLocaleLowerCase("pt-BR");
    return (data?.rows ?? []).filter((row) =>
      (!search || row.clientName.toLocaleLowerCase("pt-BR").includes(search)) &&
      (professionalFilter === "all" || row.professionalIds.includes(professionalFilter)) &&
      (serviceFilter === "all" || row.serviceIds.includes(serviceFilter))
    );
  }, [clientFilter, data?.rows, professionalFilter, serviceFilter]);
  const totals = summarizeCanceledAppointments(filteredRows);

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar cancelamentos.</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Cancelamentos" value={String(totals.count)} icon={CalendarX2} tone="negative" />
        <KpiCard label="Valor cancelado" value={currencyBRL(totals.amount)} icon={CircleDollarSign} tone="negative" />
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Input value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente" />
        <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
          <SelectTrigger><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os profissionais</SelectItem>{data?.professionals.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger><SelectValue placeholder="Serviço" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os serviços</SelectItem>{data?.services.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Agendamento</TableHead><TableHead>Cancelado em</TableHead><TableHead>Cliente</TableHead><TableHead>Profissional</TableHead><TableHead>Serviço</TableHead><TableHead>Motivo</TableHead><TableHead className="text-right">Valor original</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum cancelamento no período.</TableCell></TableRow> : filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{format(new Date(row.appointment_date), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>{format(new Date(row.canceled_at ?? row.updated_at), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>{row.clientName}</TableCell>
                <TableCell>{row.professionalNames.join(", ") || "—"}</TableCell>
                <TableCell>{row.serviceNames.join(", ") || "—"}</TableCell>
                <TableCell className="max-w-52 whitespace-normal">{row.cancellation_reason || "—"}</TableCell>
                <TableCell className="text-right font-medium">{currencyBRL(Number(row.service_amount ?? 0))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}