import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { KpiCard, currencyBRL } from "./KpiCard";
import { Download, Percent, Users, Wallet } from "lucide-react";
import { format } from "date-fns";


type SaleRow = {
  id: string;
  service_id: string | null;
  amount: number | null;
  sale_date: string | null;
  client_id: string | null;
  appointment_id: string | null;
  payment_method: string | null;
  notes: string | null;
};

type SaleProfessionalRow = {
  sale_id: string;
  professional_id: string;
  role: string | null;
  commission_percentage: number | null;
  commission_amount: number | null;
};

type LookupRow = { id: string; name: string | null };
type AppointmentRow = { id: string; client_id: string | null; status: string | null; notes: string | null };

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

export function CommissionsReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);
  const [proFilter, setProFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "commissions", establishmentId, startISO, endISO],
    queryFn: async () => {
      const salesRes = await supabase.from("sales")
        .select("id, service_id, amount, sale_date, client_id, appointment_id, payment_method, notes")
        .eq("establishment_id", establishmentId)
        .gte("sale_date", startISO).lte("sale_date", endISO);
      if (salesRes.error) throw salesRes.error;
      const sales = (salesRes.data ?? []) as SaleRow[];
      const saleIds = sales.map((sale) => sale.id);

      const appointmentIds = sales.map((sale) => sale.appointment_id).filter((id): id is string => Boolean(id));
      const clientIds = Array.from(new Set(sales.map((sale) => sale.client_id).filter((id): id is string => Boolean(id))));

      const [spRes, profsRes, servicesRes, clientsRes, appointmentsRes] = await Promise.all([
        saleIds.length
          ? supabase.from("sale_professionals")
              .select("sale_id, professional_id, role, commission_percentage, commission_amount")
              .in("sale_id", saleIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
        clientIds.length
          ? supabase.from("clients").select("id, name").in("id", clientIds)
          : Promise.resolve({ data: [], error: null }),
        appointmentIds.length
          ? supabase.from("appointments").select("id, client_id, status, notes").in("id", appointmentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const profs = new Map(((profsRes.data ?? []) as LookupRow[]).map((professional) => [professional.id, professional.name ?? "—"]));
      const services = new Map(((servicesRes.data ?? []) as LookupRow[]).map((service) => [service.id, service.name ?? "—"]));
      const saleMap = new Map(sales.map((sale) => [sale.id, sale]));
      const clients = new Map(((clientsRes.data ?? []) as LookupRow[]).map((client) => [client.id, client.name ?? "Cliente não informado"]));
      const appointments = new Map(((appointmentsRes.data ?? []) as AppointmentRow[]).map((appointment) => [appointment.id, appointment]));

      const rows = ((spRes.data ?? []) as SaleProfessionalRow[]).map((sp) => {
        const s = saleMap.get(sp.sale_id);
        const appointment = s?.appointment_id ? appointments.get(s.appointment_id) : null;
        const clientId = s?.client_id ?? appointment?.client_id;
        const status = appointment?.status ?? "Pendente";
        return {
          id: `${sp.sale_id}-${sp.professional_id}-${sp.role}`,
          date: s?.sale_date ?? null,
          professionalId: sp.professional_id,
          professional: profs.get(sp.professional_id) ?? "—",
          client: clientId ? (clients.get(clientId) ?? "Cliente não informado") : "Cliente não informado",
          serviceId: s?.service_id ?? "",
          service: services.get(s?.service_id) ?? "—",
          amount: Number(s?.amount || 0),
          role: sp.role ?? "—",
          percent: Number(sp.commission_percentage || 0),
          commission: Number(sp.commission_amount || 0),
          status,
          paymentMethod: s?.payment_method ?? "—",
          notes: s?.notes ?? appointment?.notes ?? "—",
        };
      });

      const totals = new Map<string, { name: string; total: number; count: number }>();
      for (const r of rows) {
        const cur = totals.get(r.professionalId) ?? { name: r.professional, total: 0, count: 0 };
        cur.total += r.commission;
        cur.count += 1;
        totals.set(r.professionalId, cur);
      }
      const totalsArr = Array.from(totals.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);

      return { rows, totals: totalsArr, profs: Array.from(profs.entries()).map(([id, name]) => ({ id, name })), services: Array.from(services.entries()).map(([id, name]) => ({ id, name })) };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;

  const filtered = data.rows.filter((r) => (proFilter === "all" || r.professionalId === proFilter)
    && (serviceFilter === "all" || r.serviceId === serviceFilter)
    && (statusFilter === "all" || r.status === statusFilter));
  const totalCommission = filtered.reduce((a, r) => a + r.commission, 0);
  const totalBase = filtered.reduce((a, r) => a + r.amount, 0);
  const avgRate = totalBase ? (totalCommission / totalBase) * 100 : 0;

  const roleLabel: Record<string, string> = {
    solo: "Sozinho",
    with_assistants: "Com auxiliares",
    as_assistant: "Auxiliar",
  };


  const exportRows = filtered.map((r) => ({
    Profissional: r.professional,
    Cliente: r.client,
    Serviço: r.service,
    "Data do atendimento ou venda": r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—",
    "Valor do serviço/venda": r.amount,
    "Regra de comissão aplicada": roleLabel[r.role] ?? r.role,
    "Percentual de comissão": `${r.percent.toFixed(1)}%`,
    "Valor da comissão": r.commission,
    Status: r.status,
    "Forma de pagamento": r.paymentMethod,
    Observações: r.notes,
  }));

  const downloadBlob = (content: BlobPart, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    downloadBlob(`\uFEFF${csv}`, "text/csv;charset=utf-8;", `relatorio-comissoes-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.csv`);
  };

  const exportXlsx = () => {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comissões");
    XLSX.writeFile(workbook, `relatorio-comissoes-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Total de comissões" value={currencyBRL(totalCommission)} icon={Wallet} tone="positive" />
        <KpiCard label="Profissionais com comissão" value={String(data.totals.length)} icon={Users} tone="accent" />
        <KpiCard label="Taxa média" value={`${avgRate.toFixed(1)}%`} icon={Percent} />
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <div className="px-4 py-3 border-b text-sm font-semibold">Acumulado por profissional</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead className="text-right">Lançamentos</TableHead>
              <TableHead className="text-right">A receber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.totals.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Sem comissões.</TableCell></TableRow>
            ) : data.totals.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-right">{t.count}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{currencyBRL(t.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Detalhamento</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={proFilter} onValueChange={setProFilter}>
            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {data.profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {data.services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Array.from(new Set(data.rows.map((r) => r.status))).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportXlsx} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> XLSX
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead className="text-right">Valor base</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-6">Sem lançamentos.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="font-medium">{r.professional}</TableCell>
                <TableCell>{r.client}</TableCell>
                <TableCell>{r.service}</TableCell>
                <TableCell><Badge variant="outline">{roleLabel[r.role] ?? r.role}</Badge></TableCell>
                <TableCell className="text-right">{currencyBRL(r.amount)}</TableCell>
                <TableCell className="text-right">{r.percent.toFixed(1)}%</TableCell>
                <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{currencyBRL(r.commission)}</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                <TableCell>{r.paymentMethod}</TableCell>
                <TableCell className="max-w-56 truncate" title={r.notes}>{r.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
