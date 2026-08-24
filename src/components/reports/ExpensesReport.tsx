import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard, currencyBRL } from "./KpiCard";
import { TrendingDown, TrendingUp, Scale } from "lucide-react";
import { format } from "date-fns";
import {
  asNumber,
  fetchPeriodExpenses,
  fetchRealizedSales,
  round2,
  sumExpenses,
  sumRealizedRevenue,
  toPeriodRange,
} from "@/lib/finance/revenue";

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Vencido",
  due_today: "Vence hoje",
  cancelled: "Cancelado",
};

function statusLabel(status: string | null): string {
  const key = String(status ?? "pending").trim().toLowerCase();
  return STATUS_LABELS[key] ?? "Pendente";
}

function statusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  const key = String(status ?? "pending").trim().toLowerCase();
  if (key === "paid") return "default";
  if (key === "overdue") return "destructive";
  if (key === "due_today") return "secondary";
  return "outline";
}

/** due_date é `date` (yyyy-mm-dd): interpretar como dia local, sem timezone. */
function formatDueDate(dueDate: string | null, fallback: string | null): string {
  const raw = dueDate ?? fallback;
  if (!raw) return "—";
  const day = raw.slice(0, 10);
  return format(new Date(`${day}T00:00:00`), "dd/MM/yyyy");
}

export function ExpensesReport({ establishmentId, startDate, endDate }: Props) {
  const range = useMemo(() => toPeriodRange(startDate, endDate), [startDate, endDate]);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "expenses", establishmentId, range.startISO, range.endExclusiveISO],
    queryFn: async () => {
      // Mesma fonte de verdade dos demais relatórios:
      // - Despesas: por data de vencimento, excluindo apagadas (soft delete).
      // - Faturamento: mesmas vendas do Faturamento Geral / Dashboard Financeiro.
      const [expenses, sales] = await Promise.all([
        fetchPeriodExpenses(establishmentId, startDate, endDate),
        fetchRealizedSales(establishmentId, range),
      ]);

      const totalExp = sumExpenses(expenses);
      const totalRev = sumRealizedRevenue(sales);

      const byCategory = new Map<string, number>();
      for (const expense of expenses) {
        const key = expense.category ?? "Outros";
        byCategory.set(key, round2((byCategory.get(key) ?? 0) + asNumber(expense.amount)));
      }
      const categories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

      return { expenses, totalExp, totalRev, profit: round2(totalRev - totalExp), categories };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;

  const positive = data.profit >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Total de despesas" value={currencyBRL(data.totalExp)} icon={TrendingDown} tone="negative" hint="Por data de vencimento" />
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
              <TableHead>Vencimento</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.expenses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhuma despesa com vencimento no período.</TableCell></TableRow>
            ) : data.expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="whitespace-nowrap">{formatDueDate(expense.due_date, expense.expense_date)}</TableCell>
                <TableCell><Badge variant="secondary">{expense.category ?? "Outros"}</Badge></TableCell>
                <TableCell className="font-medium">{expense.description}</TableCell>
                <TableCell><Badge variant={statusVariant(expense.status)}>{statusLabel(expense.status)}</Badge></TableCell>
                <TableCell className="text-right font-semibold text-destructive">{currencyBRL(asNumber(expense.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
