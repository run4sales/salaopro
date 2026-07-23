/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, currencyBRL } from "./KpiCard";
import { ArrowDownCircle, ArrowUpCircle, Scale, TrendingUp, Plus, Repeat } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";

interface Props { establishmentId: string; startDate: Date; endDate: Date; }

const RECURRENCE_FREQUENCIES = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "bimonthly", label: "Bimestral" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];

const PAYMENT_OPTIONS = ["dinheiro", "pix", "cartão de crédito", "cartão de débito", "transferência", "boleto", "outro"];

export function CashFlowReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [recurringFilter, setRecurringFilter] = useState<"all" | "recurring" | "single">("all");
  const [form, setForm] = useState({
    entry_type: "income" as "income" | "expense",
    description: "",
    amount: "",
    category: "",
    payment_method: "dinheiro",
    notes: "",
    entry_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    recurring: false,
    frequency: "monthly",
    end_mode: "never" as "never" | "date" | "count",
    end_date: "",
    max_occurrences: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "cash-flow", establishmentId, startISO, endISO, recurringFilter],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("cash_flow_entries")
        .select("*")
        .eq("establishment_id", establishmentId)
        .is("deleted_at", null)
        .gte("entry_date", startISO).lte("entry_date", endISO)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      const list = rows ?? [];
      const income = list.filter((r: any) => r.entry_type === "income").reduce((a, r: any) => a + Number(r.amount), 0);
      const expense = list.filter((r: any) => r.entry_type === "expense").reduce((a, r: any) => a + Number(r.amount), 0);
      const balance = income - expense;

      // Daily series
      const byDay = new Map<string, { in: number; out: number }>();
      for (const r of list) {
        const k = format(new Date(r.entry_date), "yyyy-MM-dd");
        const cur = byDay.get(k) ?? { in: 0, out: 0 };
        if (r.entry_type === "income") cur.in += Number(r.amount);
        else cur.out += Number(r.amount);
        byDay.set(k, cur);
      }
      const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
      let running = 0;
      const series = days.map(([day, v]) => {
        running += v.in - v.out;
        return { day: format(new Date(day), "dd/MM"), entradas: v.in, saidas: v.out, saldo: running };
      });

      // Payment method breakdown (income only)
      const byMethod = new Map<string, number>();
      for (const r of list) {
        if (r.entry_type !== "income") continue;
        const k = (r.payment_method || "outro").toString().toLowerCase();
        byMethod.set(k, (byMethod.get(k) ?? 0) + Number(r.amount));
      }
      const methods = Array.from(byMethod.entries()).map(([name, value]) => ({ name, value }));

      const filteredRows = recurringFilter === "recurring" ? list.filter((r: any) => r.recurring_plan_id) : recurringFilter === "single" ? list.filter((r: any) => !r.recurring_plan_id) : list;
      return { rows: filteredRows, income, expense, balance, series, methods };
    },
  });

  const submit = async () => {
    const amt = Number(form.amount.replace(",", "."));
    if (!form.description.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Preencha descrição e valor válido", variant: "destructive" });
      return;
    }
    const template = { description: form.description.trim(), amount: amt, category: form.category || (form.entry_type === "income" ? "Entrada manual" : "Saída manual"), payment_method: form.payment_method, notes: form.notes || null };
    const { error } = form.recurring
      ? await supabase.rpc("create_financial_recurrence" as never, {
          p_tenant_id: establishmentId,
          p_tipo: form.entry_type === "income" ? "receivable" : "payable",
          p_frequency: form.frequency,
          p_start_date: form.entry_date.slice(0, 10),
          p_end_date: form.end_mode === "date" && form.end_date ? form.end_date : null,
          p_max_occurrences: form.end_mode === "count" && form.max_occurrences ? Number(form.max_occurrences) : null,
          p_template: template,
          p_generate_until: form.end_mode === "never" ? format(new Date(new Date(form.entry_date).getFullYear() + 1, new Date(form.entry_date).getMonth(), new Date(form.entry_date).getDate()), "yyyy-MM-dd") : null,
        } as never)
      : await supabase.from("cash_flow_entries").insert({
      establishment_id: establishmentId,
      entry_type: form.entry_type,
      description: form.description.trim(),
      amount: amt,
      category: form.category || (form.entry_type === "income" ? "Entrada manual" : "Saída manual"),
      payment_method: form.payment_method,
      notes: form.notes || null,
      entry_date: new Date(form.entry_date).toISOString(),
      source: "manual",
      status: "confirmed",
    });
    if (error) { toast({ title: "Erro ao lançar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Lançamento criado" });
    setOpen(false);
    setForm({ ...form, description: "", amount: "", category: "", notes: "", recurring: false, end_mode: "never", end_date: "", max_occurrences: "" });
    qc.invalidateQueries({ queryKey: ["reports", "cash-flow"] });
  };

  const remove = async (id: string, source: string) => {
    if (source !== "manual") {
      toast({ title: "Não é possível excluir", description: "Lançamentos automáticos devem ser removidos na origem (venda/despesa)." });
      return;
    }
    const { error } = await supabase.from("cash_flow_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["reports", "cash-flow"] });
  };

  if (isLoading || !data) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  const positive = data.balance >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Fluxo de caixa</h2>
          <Select value={recurringFilter} onValueChange={(v: any) => setRecurringFilter(v)}><SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="recurring">Apenas recorrentes</SelectItem><SelectItem value="single">Apenas não recorrentes</SelectItem></SelectContent></Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo lançamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Lançamento manual</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.entry_type} onValueChange={(v: any) => setForm({ ...form, entry_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada</SelectItem>
                      <SelectItem value="expense">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data/hora</Label>
                  <Input type="datetime-local" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aporte do sócio" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <Label>Forma de pagamento</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_OPTIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Categoria (opcional)</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Aporte, Compra emergencial…" />
              </div>
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="recurring-cash-flow">Lançamento recorrente</Label>
                  <Switch id="recurring-cash-flow" checked={form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: v })} />
                </div>
                {form.recurring && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><Label>Frequência</Label><Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RECURRENCE_FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Encerramento</Label><Select value={form.end_mode} onValueChange={(v: any) => setForm({ ...form, end_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="never">Recorrência infinita</SelectItem><SelectItem value="date">Até uma data</SelectItem><SelectItem value="count">Quantidade</SelectItem></SelectContent></Select></div>
                    {form.end_mode === "date" && <div><Label>Data final</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>}
                    {form.end_mode === "count" && <div><Label>Gerar ocorrências</Label><Input type="number" min="1" placeholder="12, 24, 60..." value={form.max_occurrences} onChange={(e) => setForm({ ...form, max_occurrences: e.target.value })} /></div>}
                  </div>
                )}
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit}>Lançar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Entradas" value={currencyBRL(data.income)} icon={ArrowUpCircle} tone="positive" />
        <KpiCard label="Saídas" value={currencyBRL(data.expense)} icon={ArrowDownCircle} tone="negative" />
        <KpiCard label="Saldo do período" value={currencyBRL(data.balance)} icon={Scale} tone={positive ? "positive" : "negative"} />
        <KpiCard label={positive ? "Lucro" : "Prejuízo"} value={currencyBRL(Math.abs(data.balance))} icon={TrendingUp} tone={positive ? "positive" : "negative"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-md border bg-card p-4">
          <div className="text-sm font-semibold mb-3">Evolução do saldo</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => currencyBRL(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="text-sm font-semibold mb-3">Entradas vs Saídas</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => currencyBRL(Number(v))} />
                <Bar dataKey="entradas" fill="hsl(142 71% 45%)" />
                <Bar dataKey="saidas" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {data.methods.length > 0 && (
        <div className="rounded-md border bg-card p-4">
          <div className="text-sm font-semibold mb-3">Entradas por forma de pagamento</div>
          <div className="space-y-2">
            {data.methods.sort((a, b) => b.value - a.value).map((m) => {
              const pct = data.income ? (m.value / data.income) * 100 : 0;
              return (
                <div key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{m.name}</span>
                    <span className="text-muted-foreground">{currencyBRL(m.value)} • {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Nenhuma movimentação no período.</TableCell></TableRow>
            ) : data.rows.map((r: any) => {
              const isIn = r.entry_type === "income";
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(r.entry_date), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>
                    <Badge variant={isIn ? "default" : "destructive"} className={isIn ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20" : ""}>
                      {isIn ? "Entrada" : "Saída"}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{r.category ?? "—"}</Badge></TableCell>
                  <TableCell className="font-medium"><div className="flex items-center gap-2">{r.description}{r.recurring_plan_id && <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> Recorrente</Badge>}</div></TableCell>
                  <TableCell className="capitalize">{r.payment_method ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{r.source === "sale" ? "Venda" : r.source === "expense" ? "Despesa" : r.source === "recurrence" ? "Recorrência" : "Manual"}</Badge>
                  </TableCell>
                  <TableCell className={"text-right font-semibold " + (isIn ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                    {isIn ? "+ " : "- "}{currencyBRL(Number(r.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.source === "manual" && (
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id, r.source)}>Excluir</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
