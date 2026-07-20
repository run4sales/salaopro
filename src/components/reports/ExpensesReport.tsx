import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard, currencyBRL } from "./KpiCard";
import { TrendingDown, TrendingUp, Scale } from "lucide-react";
import { format } from "date-fns";

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

export function ExpensesReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "expenses", establishmentId, startISO, endISO],
    queryFn: async () => {
      const [expRes, salesRes] = await Promise.all([
        supabase.from("expenses")
          .select("id, description, amount, category, expense_date, notes")
          .eq("establishment_id", establishmentId)
          .gte("expense_date", startISO).lte("expense_date", endISO)
          .order("expense_date", { ascending: false }),
        supabase.from("sales")
          .select("amount")
          .eq("establishment_id", establishmentId)
          .gte("sale_date", startISO).lte("sale_date", endISO)
          .is("deleted_at", null),
      ]);
      if (expRes.error) throw expRes.error;
      const expenses = (expRes.data ?? []).map((e: any) => ({
        ...e,
        amount: Number(e.amount || 0),
        payment: (e.notes && /pix|dinheiro|cart[ãa]o|d[eé]bito|cr[eé]dito|boleto|transfer/i.test(e.notes))
          ? e.notes
          : "—",
      }));
      const totalExp = expenses.reduce((a: number, e: any) => a + e.amount, 0);
      const totalRev = (salesRes.data ?? []).reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const byCategory = new Map<string, number>();
      for (const e of expenses) {
        const k = e.category ?? "Outros";
        byCategory.set(k, (byCategory.get(k) ?? 0) + e.amount);
      }
      const categories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
      return { expenses, totalExp, totalRev, profit: totalRev - totalExp, categories };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;

  const positive = data.profit >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Total de despesas" value={currencyBRL(data.totalExp)} icon={TrendingDown} tone="negative" />
        <KpiCard label="Faturamento no período" value={currencyBRL(data.totalRev)} icon={TrendingUp} tone="positive" />
        <KpiCard
          label={positive ? "Lucro" : "Prejuízo"}
          value={currencyBRL(Math.abs(data.profit))}
          icon={Scale}
          tone={positive ? "positive" : "negative"}
        />
      </div>

      {data.categories.length > 0 && (
        <div className="rounded-md border bg-card p-4">
          <div className="text-sm font-semibold mb-3">Despesas por categoria</div>
          <div className="space-y-2">
            {data.categories.map(([cat, val]) => {
              const pct = data.totalExp ? (val / data.totalExp) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{cat}</span>
                    <span className="text-muted-foreground">{currencyBRL(val)} • {pct.toFixed(0)}%</span>
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
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Forma de pagamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.expenses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhuma despesa no período.</TableCell></TableRow>
            ) : data.expenses.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{format(new Date(e.expense_date), "dd/MM/yyyy")}</TableCell>
                <TableCell><Badge variant="secondary">{e.category ?? "Outros"}</Badge></TableCell>
                <TableCell className="font-medium">{e.description}</TableCell>
                <TableCell className="capitalize">{e.payment}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">{currencyBRL(e.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
