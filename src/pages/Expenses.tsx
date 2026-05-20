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
import { Calendar as CalendarIcon, Plus, Trash2, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["expenses", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("establishment_id", profile.id)
        .order("expense_date", { ascending: false });
      return (data ?? []) as Expense[];
    },
    enabled: !!profile?.id,
  });

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
    () => (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
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
      const { error } = await supabase.from("expenses").insert({
        establishment_id: profile.id,
        description,
        amount: Number(amount),
        category,
        expense_date: date.toISOString(),
        notes: notes || null,
      });
      if (error) throw error;
      toast.success("Despesa registrada!");
      setDescription("");
      setAmount("");
      setCategory("Outros");
      setNotes("");
      setDate(new Date());
      qc.invalidateQueries({ queryKey: ["expenses", profile.id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
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
                <Label>Data</Label>
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
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            {!expenses || expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma despesa registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{e.description}</span>
                        {e.category && <Badge variant="secondary">{e.category}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(e.expense_date), "dd 'de' MMM yyyy", { locale: ptBR })}
                        {e.notes && ` • ${e.notes}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-destructive">R$ {Number(e.amount).toFixed(2)}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(e.id)}>
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
