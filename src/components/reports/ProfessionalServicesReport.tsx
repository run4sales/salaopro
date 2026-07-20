import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, currencyBRL } from "./KpiCard";
import { Users, Scissors, DollarSign } from "lucide-react";

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

export function ProfessionalServicesReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "by-professional", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [salesRes, clientsRes, servicesRes, profsRes, salePros] = await Promise.all([
        supabase.from("sales")
          .select("id, client_id, service_id, professional_id, amount, sale_date")
          .eq("establishment_id", establishmentId)
          .gte("sale_date", startISO).lte("sale_date", endISO)
          .is("deleted_at", null)
          .order("sale_date", { ascending: false }),
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("sale_professionals").select("sale_id, professional_id").eq("establishment_id", establishmentId),
      ]);
      if (salesRes.error) throw salesRes.error;
      const sales = salesRes.data ?? [];
      const clients = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const profs = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.name]));
      const proBySale = new Map<string, string[]>();
      for (const sp of salePros.data ?? []) {
        const arr = proBySale.get((sp as any).sale_id) ?? [];
        arr.push((sp as any).professional_id);
        proBySale.set((sp as any).sale_id, arr);
      }

      const rows = sales.map((s: any) => {
        const proIds = proBySale.get(s.id) ?? (s.professional_id ? [s.professional_id] : []);
        return {
          id: s.id,
          date: s.sale_date,
          service: services.get(s.service_id) ?? "—",
          client: clients.get(s.client_id) ?? "—",
          amount: Number(s.amount || 0),
          proIds,
          proNames: proIds.map((id: string) => profs.get(id) ?? "—"),
        };
      });

      const totals = new Map<string, { name: string; qty: number; total: number }>();
      for (const r of rows) {
        for (const pid of r.proIds) {
          const cur = totals.get(pid) ?? { name: profs.get(pid) ?? "—", qty: 0, total: 0 };
          cur.qty += 1;
          cur.total += r.amount;
          totals.set(pid, cur);
        }
      }
      const totalsArr = Array.from(totals.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total);

      const allProfs = Array.from(profs.entries()).map(([id, name]) => ({ id, name }));

      return { rows, totals: totalsArr, profs: allProfs };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;

  const filtered = filter === "all" ? data.rows : data.rows.filter((r) => r.proIds.includes(filter));
  const grandTotal = filtered.reduce((a, r) => a + r.amount, 0);
  const topPro = data.totals[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Atendimentos no período" value={String(filtered.length)} icon={Scissors} tone="accent" />
        <KpiCard label="Faturamento" value={currencyBRL(grandTotal)} icon={DollarSign} tone="positive" />
        <KpiCard
          label="Profissional destaque"
          value={topPro?.name ?? "—"}
          icon={Users}
          hint={topPro ? `${currencyBRL(topPro.total)} • ${topPro.qty} atend.` : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Total por profissional</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrar:</span>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {data.profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead className="text-right">Atendimentos</TableHead>
              <TableHead className="text-right">Faturado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.totals.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
            ) : data.totals.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-right">{t.qty}</TableCell>
                <TableCell className="text-right font-semibold">{currencyBRL(t.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Profissional(is)</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sem atendimentos.</TableCell></TableRow>
            ) : filtered.map((r) => {
              const d = new Date(r.date);
              return (
                <TableRow key={r.id}>
                  <TableCell>{format(d, "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-muted-foreground">{format(d, "HH:mm")}</TableCell>
                  <TableCell>{r.service}</TableCell>
                  <TableCell>{r.proNames.length ? r.proNames.join(", ") : "—"}</TableCell>
                  <TableCell>{r.client}</TableCell>
                  <TableCell className="text-right font-semibold">{currencyBRL(r.amount)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
