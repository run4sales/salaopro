import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, currencyBRL } from "./KpiCard";
import { Wallet, Users, Percent } from "lucide-react";
import { format } from "date-fns";

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

export function CommissionsReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);
  const [proFilter, setProFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "commissions", establishmentId, startISO, endISO],
    queryFn: async () => {
      const salesRes = await supabase.from("sales")
        .select("id, service_id, amount, sale_date")
        .eq("establishment_id", establishmentId)
        .gte("sale_date", startISO).lte("sale_date", endISO);
      if (salesRes.error) throw salesRes.error;
      const sales = salesRes.data ?? [];
      const saleIds = sales.map((s: any) => s.id);

      const [spRes, profsRes, servicesRes] = await Promise.all([
        saleIds.length
          ? supabase.from("sale_professionals")
              .select("sale_id, professional_id, role, commission_percentage, commission_amount")
              .in("sale_id", saleIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId),
      ]);

      const profs = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.name]));
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const saleMap = new Map(sales.map((s: any) => [s.id, s]));

      const rows = (spRes.data ?? []).map((sp: any) => {
        const s: any = saleMap.get(sp.sale_id);
        return {
          id: `${sp.sale_id}-${sp.professional_id}-${sp.role}`,
          date: s?.sale_date ?? null,
          professionalId: sp.professional_id,
          professional: profs.get(sp.professional_id) ?? "—",
          service: services.get(s?.service_id) ?? "—",
          amount: Number(s?.amount || 0),
          role: sp.role as string,
          percent: Number(sp.commission_percentage || 0),
          commission: Number(sp.commission_amount || 0),
          status: "Pendente" as const,
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

      return { rows, totals: totalsArr, profs: Array.from(profs.entries()).map(([id, name]) => ({ id, name })) };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;

  const filtered = proFilter === "all" ? data.rows : data.rows.filter((r) => r.professionalId === proFilter);
  const totalCommission = filtered.reduce((a, r) => a + r.commission, 0);
  const totalBase = filtered.reduce((a, r) => a + r.amount, 0);
  const avgRate = totalBase ? (totalCommission / totalBase) * 100 : 0;

  const roleLabel: Record<string, string> = {
    solo: "Sozinho",
    with_assistants: "Com auxiliares",
    as_assistant: "Auxiliar",
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
        <Select value={proFilter} onValueChange={setProFilter}>
          <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {data.profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead className="text-right">Valor base</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Sem lançamentos.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="font-medium">{r.professional}</TableCell>
                <TableCell>{r.service}</TableCell>
                <TableCell><Badge variant="outline">{roleLabel[r.role] ?? r.role}</Badge></TableCell>
                <TableCell className="text-right">{currencyBRL(r.amount)}</TableCell>
                <TableCell className="text-right">{r.percent.toFixed(1)}%</TableCell>
                <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{currencyBRL(r.commission)}</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
