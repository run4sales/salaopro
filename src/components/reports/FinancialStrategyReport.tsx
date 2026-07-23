/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, subMonths, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard, currencyBRL } from "./KpiCard";
import { ArrowDownCircle, ArrowUpCircle, BarChart3, CalendarClock, Download, FileSpreadsheet, LineChart as LineIcon, Scale, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as XLSX from "xlsx";

interface Props { establishmentId: string; startDate: Date; endDate: Date; }
type Granularity = "daily" | "weekly" | "monthly" | "annual";

const realizedSources = new Set(["sale", "appointment_deposit", "manual"]);
const cancelledStatuses = new Set(["cancelled", "canceled", "cancelado", "cancelada"]);
const completedStatuses = new Set(["completed", "concluded", "done", "finalizado", "finalizada", "concluido", "concluída", "concluida"]);
const forecastStatuses = new Set(["scheduled", "confirmed", "pending", "open", "agendado", "confirmado", "pendente", "em aberto"]);

function pct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
function periodKey(date: string | Date, g: Granularity) {
  const d = new Date(date);
  if (g === "annual") return format(d, "yyyy");
  if (g === "monthly") return format(d, "yyyy-MM");
  if (g === "weekly") {
    const x = startOfDay(d); x.setDate(x.getDate() - x.getDay());
    return format(x, "yyyy-MM-dd");
  }
  return format(d, "yyyy-MM-dd");
}
function downloadCsv(name: string, rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] ?? { vazio: "" });
  const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
function downloadXlsx(name: string, rows: Record<string, any>[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Relatório");
  XLSX.writeFile(wb, `${name}.xlsx`);
}
function exportPdf() { window.print(); }

export function FinancialStrategyReport({ establishmentId, startDate, endDate }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [months, setMonths] = useState("6");
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "strategic-finance", establishmentId, startISO, endISO, granularity, months],
    queryFn: async () => {
      const now = new Date();
      const comparisonStart = startOfMonth(subMonths(now, Number(months) - 1)).toISOString();
      const runSafe = async <T,>(label: string, request: PromiseLike<{ data: T[] | null; error: any }>, fallback: T[] = []) => {
        const { data, error } = await request;
        if (error) {
          console.warn(`[Relatórios financeiros] Falha ao carregar ${label}:`, error);
          return fallback;
        }
        return data ?? fallback;
      };
      const loadCashEntries = async () => {
        const primary = await supabase.from("cash_flow_entries").select("id, entry_type, amount, status, entry_date, source, payment_method, category, description").eq("establishment_id", establishmentId).is("deleted_at", null).gte("entry_date", comparisonStart).order("entry_date", { ascending: true });
        if (!primary.error) return primary.data ?? [];
        console.warn("[Relatórios financeiros] Retentando fluxo de caixa sem filtro deleted_at:", primary.error);
        return runSafe("fluxo de caixa", supabase.from("cash_flow_entries").select("id, entry_type, amount, status, entry_date, source, payment_method, category, description").eq("establishment_id", establishmentId).gte("entry_date", comparisonStart).order("entry_date", { ascending: true }));
      };
      const loadSales = async () => {
        const primary = await supabase.from("sales").select("id, client_id, service_id, professional_id, amount, sale_date, payment_method, appointment_id").eq("establishment_id", establishmentId).is("deleted_at", null).gte("sale_date", comparisonStart).order("sale_date", { ascending: true });
        if (!primary.error) return primary.data ?? [];
        console.warn("[Relatórios financeiros] Retentando vendas sem filtro deleted_at:", primary.error);
        return runSafe("vendas", supabase.from("sales").select("id, client_id, service_id, professional_id, amount, sale_date, payment_method, appointment_id").eq("establishment_id", establishmentId).gte("sale_date", comparisonStart).order("sale_date", { ascending: true }));
      };

      const [cashRows, salesRows, appointmentRows, clientRowsRaw, serviceRowsRaw, professionalRowsRaw, apptServicesRows, apptProfsRows] = await Promise.all([
        loadCashEntries(),
        loadSales(),
        runSafe("agendamentos futuros", supabase.from("appointments").select("id, client_id, service_id, professional_id, appointment_date, status").eq("establishment_id", establishmentId).gte("appointment_date", now.toISOString()).order("appointment_date", { ascending: true }).limit(1000)),
        runSafe("clientes", supabase.from("clients").select("id, name").eq("establishment_id", establishmentId)),
        runSafe("serviços", supabase.from("services").select("id, name, price").eq("establishment_id", establishmentId)),
        runSafe("profissionais", supabase.from("professionals").select("id, name, commission_percentage").eq("establishment_id", establishmentId)),
        runSafe("serviços dos agendamentos", supabase.from("appointment_services").select("appointment_id, service_id").eq("establishment_id", establishmentId)),
        runSafe("profissionais dos agendamentos", supabase.from("appointment_professionals").select("appointment_id, professional_id").eq("establishment_id", establishmentId)),
      ]);

      const clients = new Map(clientRowsRaw.map((c: any) => [c.id, c.name]));
      const services = new Map(serviceRowsRaw.map((s: any) => [s.id, s]));
      const profs = new Map(professionalRowsRaw.map((p: any) => [p.id, p]));
      const serviceIdsByAppt = new Map<string, string[]>();
      for (const row of apptServicesRows) serviceIdsByAppt.set((row as any).appointment_id, [...(serviceIdsByAppt.get((row as any).appointment_id) ?? []), (row as any).service_id]);
      const profIdsByAppt = new Map<string, string[]>();
      for (const row of apptProfsRows) profIdsByAppt.set((row as any).appointment_id, [...(profIdsByAppt.get((row as any).appointment_id) ?? []), (row as any).professional_id]);

      const cash = cashRows.filter((r: any) => new Date(r.entry_date) <= endDate);
      const realizedEntries = cash.filter((r: any) => r.status === "confirmed" && r.entry_type === "income" && realizedSources.has(r.source ?? "manual") && new Date(r.entry_date) >= startDate && new Date(r.entry_date) <= endDate);
      const paidExpenses = cash.filter((r: any) => r.status === "confirmed" && r.entry_type === "expense" && new Date(r.entry_date) >= startDate && new Date(r.entry_date) <= endDate);
      const futureExpenses = cashRows.filter((r: any) => r.entry_type === "expense" && new Date(r.entry_date) > now);
      const futureReceivables = cashRows.filter((r: any) => r.entry_type === "income" && r.status === "pending" && new Date(r.entry_date) > now);
      const sales = salesRows.filter((s: any) => new Date(s.sale_date) >= startDate && new Date(s.sale_date) <= endDate);
      const grossRevenue = realizedEntries.reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
      const salesGross = sales.reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const discounts = Math.max(0, salesGross - grossRevenue);
      const netRevenue = grossRevenue - discounts;
      const clientIds = new Set(sales.map((s: any) => s.client_id).filter(Boolean));

      const forecastAppointments = appointmentRows.filter((a: any) => {
        const st = String(a.status ?? "scheduled").toLowerCase();
        return !cancelledStatuses.has(st) && !completedStatuses.has(st) && (forecastStatuses.has(st) || !st);
      }).map((a: any) => {
        const serviceIds = serviceIdsByAppt.get(a.id) ?? (a.service_id ? [a.service_id] : []);
        const professionalIds = profIdsByAppt.get(a.id) ?? (a.professional_id ? [a.professional_id] : []);
        const amount = serviceIds.reduce((sum, id) => sum + Number(services.get(id)?.price || 0), 0);
        return { id: a.id, client: clients.get(a.client_id) ?? "—", professional: professionalIds.map((id) => profs.get(id)?.name).filter(Boolean).join(", ") || "—", service: serviceIds.map((id) => services.get(id)?.name).filter(Boolean).join(", ") || "—", date: a.appointment_date, status: a.status ?? "scheduled", amount };
      });
      const forecastTotal = forecastAppointments.reduce((a, r) => a + r.amount, 0) + futureReceivables.reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
      const expensesTotal = paidExpenses.reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
      const futureExpensesTotal = futureExpenses.reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
      const balanceNow = cash.filter((r: any) => new Date(r.entry_date) <= now).reduce((a: number, r: any) => a + (r.entry_type === "income" ? Number(r.amount || 0) : -Number(r.amount || 0)), 0);

      const seriesMap = new Map<string, { period: string; receita: number; despesas: number; lucro: number; previsto: number }>();
      for (const r of cash) {
        if (new Date(r.entry_date) < startDate || new Date(r.entry_date) > endDate || r.status !== "confirmed") continue;
        const k = periodKey(r.entry_date, granularity); const cur = seriesMap.get(k) ?? { period: k, receita: 0, despesas: 0, lucro: 0, previsto: 0 };
        if (r.entry_type === "income") cur.receita += Number(r.amount || 0); else cur.despesas += Number(r.amount || 0);
        cur.lucro = cur.receita - cur.despesas; seriesMap.set(k, cur);
      }
      for (const a of forecastAppointments) { const k = periodKey(a.date, granularity); const cur = seriesMap.get(k) ?? { period: k, receita: 0, despesas: 0, lucro: 0, previsto: 0 }; cur.previsto += a.amount; seriesMap.set(k, cur); }
      const series = Array.from(seriesMap.values()).sort((a, b) => a.period.localeCompare(b.period));

      const monthly = new Map<string, { month: string; receita: number; despesas: number; lucro: number; crescimento: number }>();
      for (const r of cashRows) { const k = periodKey((r as any).entry_date, "monthly"); const cur = monthly.get(k) ?? { month: k, receita: 0, despesas: 0, lucro: 0, crescimento: 0 }; if ((r as any).status === "confirmed" && (r as any).entry_type === "income") cur.receita += Number((r as any).amount || 0); if ((r as any).entry_type === "expense") cur.despesas += Number((r as any).amount || 0); cur.lucro = cur.receita - cur.despesas; monthly.set(k, cur); }
      const monthlyRows = Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-Number(months)); monthlyRows.forEach((r, i) => { r.crescimento = pct(r.receita, monthlyRows[i - 1]?.receita ?? 0); });

      const byClient = new Map<string, any>();
      for (const s of sales) { const cur = byClient.get((s as any).client_id) ?? { id: (s as any).client_id, name: clients.get((s as any).client_id) ?? "—", count: 0, total: 0, last: null, future: 0 }; cur.count += 1; cur.total += Number((s as any).amount || 0); cur.last = !cur.last || new Date((s as any).sale_date) > new Date(cur.last) ? (s as any).sale_date : cur.last; byClient.set(cur.id, cur); }
      for (const a of forecastAppointments) { const id = [...clients.entries()].find(([, name]) => name === a.client)?.[0] ?? a.client; const cur = byClient.get(id) ?? { id, name: a.client, count: 0, total: 0, last: null, future: 0 }; cur.future += a.amount; byClient.set(id, cur); }
      const clientRows = Array.from(byClient.values()).map((r) => ({ ...r, ticket: r.count ? r.total / r.count : 0 })).sort((a, b) => b.total - a.total);

      const byService = new Map<string, any>();
      for (const s of sales) { const svc = services.get((s as any).service_id); const cur = byService.get((s as any).service_id) ?? { name: svc?.name ?? "—", count: 0, total: 0, future: 0 }; cur.count += 1; cur.total += Number((s as any).amount || 0); byService.set((s as any).service_id, cur); }
      for (const a of forecastAppointments) for (const name of a.service.split(", ").filter(Boolean)) { const cur = byService.get(name) ?? { name, count: 0, total: 0, future: 0 }; cur.future += a.amount / Math.max(1, a.service.split(", ").length); byService.set(name, cur); }
      const serviceRows = Array.from(byService.values()).map((r) => ({ ...r, avg: r.count ? r.total / r.count : 0 })).sort((a, b) => b.total - a.total);

      const byProfessional = new Map<string, any>();
      for (const s of sales) { const pro = profs.get((s as any).professional_id); const commission = Number(s.amount || 0) * Number(pro?.commission_percentage || 0) / 100; const cur = byProfessional.get((s as any).professional_id) ?? { name: pro?.name ?? "—", count: 0, total: 0, commission: 0, future: 0 }; cur.count += 1; cur.total += Number((s as any).amount || 0); cur.commission += commission; byProfessional.set((s as any).professional_id, cur); }
      for (const a of forecastAppointments) for (const name of a.professional.split(", ").filter(Boolean)) { const cur = byProfessional.get(name) ?? { name, count: 0, total: 0, commission: 0, future: 0 }; cur.future += a.amount / Math.max(1, a.professional.split(", ").length); byProfessional.set(name, cur); }
      const professionalRows = Array.from(byProfessional.values()).map((r) => ({ ...r, ticket: r.count ? r.total / r.count : 0 })).sort((a, b) => b.total - a.total);

      return { grossRevenue, discounts, netRevenue, ticket: sales.length ? netRevenue / sales.length : 0, attendanceCount: sales.length, clientCount: clientIds.size, forecastAppointments, forecastTotal, forecastAvg: forecastAppointments.length ? forecastTotal / forecastAppointments.length : 0, expensesTotal, futureExpensesTotal, realizedProfit: netRevenue - expensesTotal, estimatedProfit: netRevenue + forecastTotal - futureExpensesTotal, balanceNow, futureReceivables: futureReceivables.reduce((a: number, r: any) => a + Number(r.amount || 0), 0), projectedBalance: balanceNow + forecastTotal - futureExpensesTotal, series, monthlyRows, clientRows, serviceRows, professionalRows };
    },
  });

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando painel financeiro…</div>;
  if (error || !data) return <div className="text-sm text-destructive">Erro ao carregar painel financeiro.</div>;
  const exportRows = [{ indicador: "Faturamento realizado", valor: data.netRevenue }, { indicador: "Faturamento previsto", valor: data.forecastTotal }, { indicador: "Despesas pagas", valor: data.expensesTotal }, { indicador: "Despesas futuras", valor: data.futureExpensesTotal }, { indicador: "Lucro realizado", valor: data.realizedProfit }, { indicador: "Lucro estimado", valor: data.estimatedProfit }];

  return <div className="space-y-4 print:bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-xl font-bold tracking-tight">Dashboard financeiro estratégico</h2><p className="text-sm text-muted-foreground">Separação entre valores recebidos e potencial futuro da agenda.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => downloadCsv("dashboard-financeiro", exportRows)}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" size="sm" onClick={() => downloadXlsx("dashboard-financeiro", exportRows)}><FileSpreadsheet className="mr-2 h-4 w-4" />XLSX</Button><Button variant="outline" size="sm" onClick={exportPdf}>PDF</Button></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"><KpiCard label="Faturamento realizado" value={currencyBRL(data.netRevenue)} icon={ArrowUpCircle} tone="positive" hint="Recebido/confirmado" /><KpiCard label="Faturamento previsto" value={currencyBRL(data.forecastTotal)} icon={CalendarClock} tone="accent" hint="Agenda futura + recebíveis" /><KpiCard label="Total de despesas" value={currencyBRL(data.expensesTotal)} icon={ArrowDownCircle} tone="negative" hint="Saídas pagas" /><KpiCard label="Lucro estimado" value={currencyBRL(data.estimatedProfit)} icon={TrendingUp} tone={data.estimatedProfit >= 0 ? "positive" : "negative"} hint="Realizado + previsto - despesas futuras" /><KpiCard label="Lucro realizado" value={currencyBRL(data.realizedProfit)} icon={Scale} tone={data.realizedProfit >= 0 ? "positive" : "negative"} hint="Receita recebida - despesas pagas" /><KpiCard label="Saldo atual" value={currencyBRL(data.balanceNow)} icon={Scale} tone={data.balanceNow >= 0 ? "positive" : "negative"} /><KpiCard label="Receitas futuras" value={currencyBRL(data.forecastTotal)} icon={ArrowUpCircle} tone="accent" /><KpiCard label="Saldo projetado" value={currencyBRL(data.projectedBalance)} icon={BarChart3} tone={data.projectedBalance >= 0 ? "positive" : "negative"} /></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><LineIcon className="h-4 w-4" />Evolução do faturamento</CardTitle><Select value={granularity} onValueChange={(v: Granularity) => setGranularity(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Diário</SelectItem><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent></Select></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => currencyBRL(Number(v))} /><Legend /><Line dataKey="receita" name="Receita" stroke="hsl(var(--primary))" strokeWidth={2} /><Line dataKey="despesas" name="Despesas" stroke="hsl(var(--destructive))" strokeWidth={2} /><Line dataKey="lucro" name="Lucro" stroke="#10b981" strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Realizado x previsto</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => currencyBRL(Number(v))} /><Legend /><Bar dataKey="receita" name="Realizado" fill="hsl(var(--primary))" /><Bar dataKey="previsto" name="Previsto" fill="#8b5cf6" /></BarChart></ResponsiveContainer></CardContent></Card></div>
    <Tabs defaultValue="realized" className="space-y-3"><TabsList className="h-auto flex-wrap"><TabsTrigger value="realized">Realizado</TabsTrigger><TabsTrigger value="forecast">Previsto</TabsTrigger><TabsTrigger value="cash">Fluxo de caixa</TabsTrigger><TabsTrigger value="months">Meses</TabsTrigger><TabsTrigger value="clients">Clientes</TabsTrigger><TabsTrigger value="professionals">Profissionais</TabsTrigger><TabsTrigger value="services">Serviços</TabsTrigger></TabsList>
      <TabsContent value="realized"><div className="grid grid-cols-2 lg:grid-cols-6 gap-3"><KpiCard label="Receita bruta" value={currencyBRL(data.grossRevenue)} /><KpiCard label="Descontos" value={currencyBRL(data.discounts)} tone="negative" /><KpiCard label="Receita líquida" value={currencyBRL(data.netRevenue)} tone="positive" /><KpiCard label="Ticket médio" value={currencyBRL(data.ticket)} /><KpiCard label="Atendimentos" value={String(data.attendanceCount)} /><KpiCard label="Clientes" value={String(data.clientCount)} icon={Users} /></div></TabsContent>
      <TabsContent value="forecast"><ReportTable rows={data.forecastAppointments} columns={["cliente", "profissional", "serviço", "data", "horário", "status", "valor"]} mapper={(r: any) => ({ cliente: r.client, profissional: r.professional, serviço: r.service, data: format(new Date(r.date), "dd/MM/yyyy"), horário: format(new Date(r.date), "HH:mm"), status: r.status, valor: currencyBRL(r.amount) })} empty="Nenhum agendamento futuro confirmado/em aberto." /></TabsContent>
      <TabsContent value="cash"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"><KpiCard label="Entradas realizadas" value={currencyBRL(data.netRevenue)} tone="positive" /><KpiCard label="Entradas previstas" value={currencyBRL(data.forecastTotal)} tone="accent" /><KpiCard label="Saídas realizadas" value={currencyBRL(data.expensesTotal)} tone="negative" /><KpiCard label="Saídas previstas" value={currencyBRL(data.futureExpensesTotal)} tone="negative" /></div></TabsContent>
      <TabsContent value="months"><div className="flex justify-end mb-2"><Select value={months} onValueChange={setMonths}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Últimos 12 meses</SelectItem></SelectContent></Select></div><ReportTable rows={data.monthlyRows} columns={["mês", "receita", "despesas", "lucro", "crescimento"]} mapper={(r: any) => ({ mês: r.month, receita: currencyBRL(r.receita), despesas: currencyBRL(r.despesas), lucro: currencyBRL(r.lucro), crescimento: `${r.crescimento >= 0 ? "▲" : "▼"} ${r.crescimento.toFixed(1)}%` })} /></TabsContent>
      <TabsContent value="clients"><ReportTable rows={data.clientRows} columns={["cliente", "atendimentos", "total gasto", "ticket médio", "última visita", "previsto futuro"]} mapper={(r: any) => ({ cliente: r.name, atendimentos: r.count, "total gasto": currencyBRL(r.total), "ticket médio": currencyBRL(r.ticket), "última visita": r.last ? format(new Date(r.last), "dd/MM/yyyy") : "—", "previsto futuro": currencyBRL(r.future) })} /></TabsContent>
      <TabsContent value="professionals"><ReportTable rows={data.professionalRows} columns={["profissional", "atendimentos", "receita", "comissão", "ticket médio", "receita futura"]} mapper={(r: any) => ({ profissional: r.name, atendimentos: r.count, receita: currencyBRL(r.total), comissão: currencyBRL(r.commission), "ticket médio": currencyBRL(r.ticket), "receita futura": currencyBRL(r.future) })} /></TabsContent>
      <TabsContent value="services"><ReportTable rows={data.serviceRows} columns={["serviço", "quantidade", "receita", "preço médio", "receita futura"]} mapper={(r: any) => ({ serviço: r.name, quantidade: r.count, receita: currencyBRL(r.total), "preço médio": currencyBRL(r.avg), "receita futura": currencyBRL(r.future) })} /></TabsContent>
    </Tabs>
  </div>;
}

function ReportTable({ rows, columns, mapper, empty = "Sem dados no período." }: { rows: any[]; columns: string[]; mapper: (row: any) => Record<string, any>; empty?: string }) {
  const mapped = rows.map(mapper);
  return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Dados detalhados</CardTitle><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => downloadCsv("relatorio", mapped)}>CSV</Button><Button variant="outline" size="sm" onClick={() => downloadXlsx("relatorio", mapped)}>XLSX</Button><Button variant="outline" size="sm" onClick={exportPdf}>PDF</Button></div></CardHeader><CardContent className="overflow-x-auto">{mapped.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">{empty}</div> : <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c} className="capitalize">{c}</TableHead>)}</TableRow></TableHeader><TableBody>{mapped.slice(0, 100).map((r, idx) => <TableRow key={idx}>{columns.map((c) => <TableCell key={c}>{String(c).includes("status") ? <Badge variant="secondary">{r[c]}</Badge> : r[c]}</TableCell>)}</TableRow>)}</TableBody></Table>}{mapped.length > 100 && <div className="pt-3 text-xs text-muted-foreground">Exibindo 100 primeiros registros. Use exportação para analisar a base completa carregada.</div>}</CardContent></Card>;
}
