import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { KpiCard, currencyBRL } from "./KpiCard";
import { Download, Percent, Users, Wallet } from "lucide-react";
import { fetchCommissionReport, sumCommissionBase, sumCommissions, toPeriodRange } from "@/lib/finance/revenue";

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

const roleLabel: Record<string, string> = {
  solo: "Sozinho",
  with_assistants: "Com auxiliares",
  as_assistant: "Auxiliar",
};

export function CommissionsReport({ establishmentId, startDate, endDate }: Props) {
  const range = useMemo(() => toPeriodRange(startDate, endDate), [startDate, endDate]);
  const [proFilter, setProFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "commissions", establishmentId, range.startISO, range.endExclusiveISO],
    queryFn: () => fetchCommissionReport(establishmentId, range),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar comissões.</div>;
  if (!data) return null;

  const filtered = data.rows.filter((r) =>
    (proFilter === "all" || r.professionalId === proFilter) &&
    (serviceFilter === "all" || r.serviceId === serviceFilter) &&
    (statusFilter === "all" || r.paymentStatus === statusFilter));

  const totalCommission = sumCommissions(filtered);
  const totalBase = sumCommissionBase(filtered);
  const avgRate = totalBase ? (totalCommission / totalBase) * 100 : 0;

  const totalsMap = new Map<string, { name: string; total: number; count: number; base: number }>();
  for (const row of filtered) {
    const current = totalsMap.get(row.professionalId) ?? { name: row.professional, total: 0, count: 0, base: 0 };
    current.total += row.commission;
    current.base += row.baseAmount;
    current.count += 1;
    totalsMap.set(row.professionalId, current);
  }
  const totals = Array.from(totalsMap.entries())
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.total - a.total);

  const exportRows = filtered.map((r) => ({
    Data: r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—",
    Cliente: r.client,
    Tipo: r.kind,
    "Serviço/Produto": r.service,
    Profissional: r.professional,
    "Valor da venda": r.saleAmount,
    "Profissionais na venda": r.participants,
    "Base do profissional": r.baseAmount,
    "Regra de comissão": roleLabel[r.role] ?? r.role,
    "Percentual de comissão": `${r.percent.toFixed(1)}%`,
    "Valor da comissão": r.commission,
    "Status da venda": r.saleStatus,
    "Status do pagamento": r.paymentStatus,
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

  const paymentStatuses = Array.from(new Set(data.rows.map((r) => r.paymentStatus)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Comissão realizada" value={currencyBRL(totalCommission)} icon={Wallet} tone="positive" hint="Vendas finalizadas do período" />
        <KpiCard label="Base comissionável" value={currencyBRL(totalBase)} icon={Wallet} hint="Valor rateado entre profissionais" />
        <KpiCard label="Profissionais com comissão" value={String(totals.length)} icon={Users} tone="accent" />
        <KpiCard label="Taxa média" value={`${avgRate.toFixed(1)}%`} icon={Percent} />
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <div className="px-4 py-3 border-b text-sm font-semibold">Acumulado por profissional</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead className="text-right">Lançamentos</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">A receber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sem comissões.</TableCell></TableRow>
            ) : totals.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-right">{t.count}</TableCell>
                <TableCell className="text-right">{currencyBRL(t.base)}</TableCell>
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
              {data.professionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {data.services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pagamentos</SelectItem>
              {paymentStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-2" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" className="h-8 gap-2" onClick={exportXlsx}><Download className="h-3.5 w-3.5" /> XLSX</Button>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma comissão no período.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço/Produto</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead className="text-right">Valor da venda</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="font-medium">{r.client}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{r.kind}</Badge>
                      <span>{r.service}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.professional}
                    {r.participants > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">({r.participants} profissionais)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{currencyBRL(r.saleAmount)}</TableCell>
                  <TableCell className="text-right">{currencyBRL(r.baseAmount)}</TableCell>
                  <TableCell className="text-right">{r.percent.toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-semibold">{currencyBRL(r.commission)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.paymentStatus} · {r.paymentMethod}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
