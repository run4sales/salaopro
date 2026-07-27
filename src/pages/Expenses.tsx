/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Plus, Repeat, Trash2, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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

const CATEGORIES = [
  "Aluguel",
  "Energia",
  "Água",
  "Internet",
  "Produtos",
  "Salários",
  "Marketing",
  "Manutenção",
  "Impostos",
  "Outros",
];

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  expense_date: string;
  notes: string | null;
  recurring_plan_id: string | null;
  status: string;
  deleted_at: string | null;
}

export default function Expenses() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "Despesas | Beauty Core";
  }, []);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [endMode, setEndMode] = useState<"never" | "date" | "count">("never");
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [recurringFilter, setRecurringFilter] = useState<"all" | "recurring" | "single">("all");

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["expenses", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("establishment_id", profile.id)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false });
      return (data ?? []) as Expense[];
    },
    enabled: !!profile?.id,
  });

  const filteredExpenses = useMemo(() => {
    if (recurringFilter === "recurring") return (expenses ?? []).filter((e) => e.recurring_plan_id);
    if (recurringFilter === "single") return (expenses ?? []).filter((e) => !e.recurring_plan_id);
    return expenses ?? [];
  }, [expenses, recurringFilter]);

  const monthTotal = useMemo(() => {
    if (!expenses) return 0;
    const now = new Date();
    return expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [expenses]);

  const total = useMemo(
    () => (filteredExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0),
    [filteredExpenses]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!description || !amount) {
      toast.error("Preencha descrição e valor.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        description,
        amount: Number(amount),
        category,
        notes: notes || null,
      };
      const { error } = recurring
        ? await supabase.rpc("create_financial_recurrence" as never, {
            p_tenant_id: profile.id,
            p_tipo: "payable",
            p_frequency: frequency,
            p_start_date: format(date, "yyyy-MM-dd"),
            p_end_date: endMode === "date" && endDate ? endDate : null,
            p_max_occurrences: endMode === "count" && maxOccurrences ? Number(maxOccurrences) : null,
            p_template: payload,
            p_generate_until: endMode === "never" ? format(new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()), "yyyy-MM-dd") : null,
          } as never)
        : await supabase.from("expenses").insert({
            establishment_id: profile.id,
            ...payload,
            expense_date: date.toISOString(),
            status: "confirmed",
          });
      if (error) throw error;
      toast.success("Despesa registrada!");
      setDescription("");
      setAmount("");
      setCategory("Outros");
      setNotes("");
      setDate(new Date());
      setRecurring(false);
      setEndMode("never");
      setEndDate("");
      setMaxOccurrences("");
      qc.invalidateQueries({ queryKey: ["expenses", profile.id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (item: Expense) => {
    const future = item.recurring_plan_id && confirm("OK: excluir esta e todas as próximas ocorrências. Cancelar: excluir somente esta ocorrência.");
    const query = future
      ? supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("recurring_plan_id", item.recurring_plan_id).gte("expense_date", item.expense_date)
      : supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", item.id);
    const { error } = await query;
    if (error) return toast.error(error.message);
    toast.success("Despesa excluída.");
    qc.invalidateQueries({ queryKey: ["expenses", profile?.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Despesas</h1>
          <p className="text-muted-foreground">Controle todos os custos do seu salão</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total no mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <span className="text-2xl font-bold">R$ {monthTotal.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total geral</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">R$ {total.toFixed(2)}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Nova despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Descrição</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Conta de luz" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{recurring ? "Data inicial" : "Data"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={cn("justify-start", !date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "dd/MM/yyyy") : "Escolher"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="md:col-span-2 rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="recurring-expense">Lançamento recorrente</Label>
                  <Switch id="recurring-expense" checked={recurring} onCheckedChange={setRecurring} />
                </div>
                {recurring && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>Frequência</Label><Select value={frequency} onValueChange={setFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RECURRENCE_FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Encerramento</Label><Select value={endMode} onValueChange={(v: any) => setEndMode(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="never">Recorrência infinita</SelectItem><SelectItem value="date">Até uma data</SelectItem><SelectItem value="count">Quantidade</SelectItem></SelectContent></Select></div>
                    {endMode === "date" && <div className="space-y-2"><Label>Data final</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>}
                    {endMode === "count" && <div className="space-y-2"><Label>Gerar ocorrências</Label><Input type="number" min="1" placeholder="12, 24, 60..." value={maxOccurrences} onChange={(e) => setMaxOccurrences(e.target.value)} /></div>}
                  </div>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : "Registrar despesa"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3"><span>Histórico</span><Select value={recurringFilter} onValueChange={(v: any) => setRecurringFilter(v)}><SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="recurring">Apenas recorrentes</SelectItem><SelectItem value="single">Apenas não recorrentes</SelectItem></SelectContent></Select></CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma despesa registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{e.description}</span>
                        {e.category && <Badge variant="secondary">{e.category}</Badge>}
                        {e.recurring_plan_id && <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> Recorrente</Badge>}
                        {e.status === "pending" && <Badge variant="outline">Pendente</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(e.expense_date), "dd 'de' MMM yyyy", { locale: ptBR })}
                        {e.notes && ` • ${e.notes}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-destructive">R$ {Number(e.amount).toFixed(2)}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
