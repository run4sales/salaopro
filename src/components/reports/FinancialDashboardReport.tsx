import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, CalendarClock, DollarSign, Scale, ShoppingCart, Users } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard, currencyBRL } from "./KpiCard";

type SupabaseError = { message?: string; code?: string; details?: string; hint?: string };
type QueryIssue = { step: string; message: string; code?: string; details?: string; hint?: string };

type SaleRow = {
  id: string;
  amount: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  paid_now: number | null;
  credit_used: number | null;
  client_id: string | null;
  sale_date: string;
};

type CashFlowRow = {
  id: string;
  entry_type: string | null;
  status: string | null;
  amount: number | null;
  entry_date: string;
};

type AppointmentRow = {
  id: string;
  client_id: string | null;
  professional_id: string | null;
  service_id: string | null;
  appointment_date: string;
  service_amount: number | null;
  status: string | null;
};

type NamedRow = { id: string; name: string | null };

interface Props {
  establishmentId: string;
  startDate: Date;
  endDate: Date;
}

const LOG_PREFIX = "[Dashboard Financeiro]";
const CONFIRMED_CASH_STATUSES = new Set(["confirmed", "paid", "received", "completed", "concluded", "done", "pago", "recebido", "confirmado", "concluido", "concluído"]);
const FUTURE_APPOINTMENT_STATUSES = new Set(["scheduled", "confirmed", "open", "pending", "agendado", "confirmado", "aberto", "pendente"]);
const CANCELED_STATUSES = new Set(["canceled", "cancelled", "cancelado", "cancelada"]);

function asNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase();
}

function serializeError(error: SupabaseError | Error | unknown) {
  if (error instanceof Error) {
    return { message: error.message, details: error.stack };
  }
  const e = (error ?? {}) as SupabaseError;
  return {
    message: e.message ?? "Erro desconhecido",
    code: e.code,
    details: e.details,
    hint: e.hint,
  };
}

async function runFinancialStep<T>(step: string, issues: QueryIssue[], fn: () => Promise<T>, fallback: T): Promise<T> {
  console.info(`${LOG_PREFIX} ${step}...`);
  try {
    const result = await fn();
    console.info(`${LOG_PREFIX} ${step} concluído`, result);
    return result;
  } catch (error) {
    const serialized = serializeError(error);
    const issue = { step, ...serialized };
    issues.push(issue);
    console.error(`${LOG_PREFIX} ${step} falhou`, issue);
    return fallback;
  }
}

export function FinancialDashboardReport({ establishmentId, startDate, endDate }: Props) {
  const startISO = useMemo(() => startDate.toISOString(), [startDate]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate]);
  const nowISO = useMemo(() => new Date().toISOString(), []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "financial-dashboard", establishmentId, startISO, endISO, nowISO],
    queryFn: async () => {
      const issues: QueryIssue[] = [];
      console.groupCollapsed(`${LOG_PREFIX} Iniciando carregamento`);
      console.info(`${LOG_PREFIX} Contexto`, { establishmentId, startISO, endISO, nowISO });

      try {
        const sales = await runFinancialStep<SaleRow[]>("Buscando vendas realizadas", issues, async () => {
          const { data: rows, error: salesError } = await supabase
            .from("sales")
            .select("id, amount, gross_amount, net_amount, paid_now, credit_used, client_id, sale_date")
            .eq("establishment_id", establishmentId)
            .gte("sale_date", startISO)
            .lte("sale_date", endISO)
            .is("deleted_at", null);
          if (salesError) throw salesError;
          return rows ?? [];
        }, []);

        const cashEntries = await runFinancialStep<CashFlowRow[]>("Buscando fluxo de caixa do período", issues, async () => {
          const { data: rows, error: cashError } = await supabase
            .from("cash_flow_entries")
            .select("id, entry_type, status, amount, entry_date")
            .eq("establishment_id", establishmentId)
            .is("deleted_at", null)
            .gte("entry_date", startISO)
            .lte("entry_date", endISO);
          if (cashError) throw cashError;
          return rows ?? [];
        }, []);

        const futureAppointments = await runFinancialStep<AppointmentRow[]>("Buscando agendamentos futuros", issues, async () => {
          const { data: rows, error: appointmentsError } = await supabase
            .from("appointments")
            .select("id, client_id, professional_id, service_id, appointment_date, service_amount, status")
            .eq("establishment_id", establishmentId)
            .gte("appointment_date", nowISO)
            .order("appointment_date", { ascending: true })
            .limit(20);
          if (appointmentsError) throw appointmentsError;
          return rows ?? [];
        }, []);

        const serviceIds = Array.from(new Set(futureAppointments.map((a) => a.service_id).filter(Boolean))) as string[];
        const clientIds = Array.from(new Set(futureAppointments.map((a) => a.client_id).filter(Boolean))) as string[];
        const professionalIds = Array.from(new Set(futureAppointments.map((a) => a.professional_id).filter(Boolean))) as string[];

        const services = await runFinancialStep<NamedRow[]>("Buscando serviços dos agendamentos", issues, async () => {
          if (serviceIds.length === 0) return [];
          const { data: rows, error: servicesError } = await supabase
            .from("services")
            .select("id, name")
            .eq("establishment_id", establishmentId)
            .in("id", serviceIds);
          if (servicesError) throw servicesError;
          return rows ?? [];
        }, []);

        const clients = await runFinancialStep<NamedRow[]>("Buscando clientes dos agendamentos", issues, async () => {
          if (clientIds.length === 0) return [];
          const { data: rows, error: clientsError } = await supabase
            .from("clients")
            .select("id, name")
            .eq("establishment_id", establishmentId)
            .in("id", clientIds);
          if (clientsError) throw clientsError;
          return rows ?? [];
        }, []);

        const professionals = await runFinancialStep<NamedRow[]>("Buscando profissionais dos agendamentos", issues, async () => {
          if (professionalIds.length === 0) return [];
          const { data: rows, error: professionalsError } = await supabase
            .from("professionals")
            .select("id, name")
            .eq("establishment_id", establishmentId)
            .in("id", professionalIds);
          if (professionalsError) throw professionalsError;
          return rows ?? [];
        }, []);

        const realizedRevenue = sales.reduce((total, sale) => total + asNumber(sale.paid_now ?? sale.net_amount ?? sale.amount), 0);
        const grossRevenue = sales.reduce((total, sale) => total + asNumber(sale.gross_amount ?? sale.amount), 0);
        const discounts = Math.max(0, grossRevenue - realizedRevenue);
        const realizedExpense = cashEntries
          .filter((entry) => normalizeStatus(entry.status) === "" || CONFIRMED_CASH_STATUSES.has(normalizeStatus(entry.status)))
          .filter((entry) => normalizeStatus(entry.entry_type) === "expense")
          .reduce((total, entry) => total + asNumber(entry.amount), 0);
        const futureIncome = cashEntries
          .filter((entry) => normalizeStatus(entry.entry_type) === "income")
          .filter((entry) => !CONFIRMED_CASH_STATUSES.has(normalizeStatus(entry.status)))
          .reduce((total, entry) => total + asNumber(entry.amount), 0);
        const futureExpense = cashEntries
          .filter((entry) => normalizeStatus(entry.entry_type) === "expense")
          .filter((entry) => !CONFIRMED_CASH_STATUSES.has(normalizeStatus(entry.status)))
          .reduce((total, entry) => total + asNumber(entry.amount), 0);

        const forecastAppointments = futureAppointments.filter((appointment) => {
          const status = normalizeStatus(appointment.status);
          return !CANCELED_STATUSES.has(status) && (status === "" || FUTURE_APPOINTMENT_STATUSES.has(status));
        });
        const forecastRevenue = forecastAppointments.reduce((total, appointment) => total + asNumber(appointment.service_amount), 0);
        const forecastTotal = forecastRevenue + futureIncome;
        const realizedProfit = realizedRevenue - realizedExpense;
        const estimatedProfit = realizedRevenue + forecastTotal - realizedExpense - futureExpense;
        const ticketAverage = sales.length ? realizedRevenue / sales.length : 0;
        const uniqueClients = new Set(sales.map((sale) => sale.client_id).filter(Boolean)).size;

        const clientNames = new Map(clients.map((client) => [client.id, client.name ?? "—"]));
        const serviceNames = new Map(services.map((service) => [service.id, service.name ?? "—"]));
        const professionalNames = new Map(professionals.map((professional) => [professional.id, professional.name ?? "—"]));
        const appointmentRows = forecastAppointments.map((appointment) => ({
          id: appointment.id,
          date: appointment.appointment_date,
          client: appointment.client_id ? clientNames.get(appointment.client_id) ?? "—" : "—",
          professional: appointment.professional_id ? professionalNames.get(appointment.professional_id) ?? "—" : "—",
          service: appointment.service_id ? serviceNames.get(appointment.service_id) ?? "—" : "—",
          status: appointment.status ?? "em aberto",
          amount: asNumber(appointment.service_amount),
        }));

        const payload = {
          realizedRevenue,
          grossRevenue,
          discounts,
          realizedExpense,
          futureExpense,
          forecastTotal,
          forecastRevenue,
          futureIncome,
          realizedProfit,
          estimatedProfit,
          ticketAverage,
          salesCount: sales.length,
          uniqueClients,
          forecastCount: forecastAppointments.length,
          appointmentRows,
          issues,
        };

        console.info(`${LOG_PREFIX} Resposta calculada`, payload);
        return payload;
      } finally {
        console.groupEnd();
      }
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando dashboard financeiro…</div>;

  if (error) {
    const serialized = serializeError(error);
    console.error(`${LOG_PREFIX} Erro fatal no carregamento`, serialized);
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar Dashboard Financeiro</AlertTitle>
        <AlertDescription>
          A aplicação continuou funcionando, mas o painel financeiro não conseguiu ser calculado. Detalhe técnico: {serialized.message}.
        </AlertDescription>
      </Alert>
    );
  }

  const dashboard = data ?? {
    realizedRevenue: 0,
    grossRevenue: 0,
    discounts: 0,
    realizedExpense: 0,
    futureExpense: 0,
    forecastTotal: 0,
    forecastRevenue: 0,
    futureIncome: 0,
    realizedProfit: 0,
    estimatedProfit: 0,
    ticketAverage: 0,
    salesCount: 0,
    uniqueClients: 0,
    forecastCount: 0,
    appointmentRows: [],
    issues: [],
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Dashboard financeiro</h2>
        <p className="text-sm text-muted-foreground">
          Visão estratégica com faturamento realizado, potencial previsto, despesas e lucro para o tenant selecionado.
        </p>
      </div>

      {dashboard.issues.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dashboard carregado parcialmente</AlertTitle>
          <AlertDescription>
            Alguns blocos não responderam e foram zerados para manter o painel disponível. Veja o console do navegador para os detalhes técnicos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Faturamento realizado" value={currencyBRL(dashboard.realizedRevenue)} icon={DollarSign} tone="positive" hint="Vendas recebidas/finalizadas" />
        <KpiCard label="Faturamento previsto" value={currencyBRL(dashboard.forecastTotal)} icon={CalendarClock} tone="accent" hint={`${dashboard.forecastCount} agendamento(s) futuro(s)`} />
        <KpiCard label="Total de despesas" value={currencyBRL(dashboard.realizedExpense + dashboard.futureExpense)} icon={ArrowDownCircle} tone="negative" hint="Pagas + previstas" />
        <KpiCard label="Lucro estimado" value={currencyBRL(dashboard.estimatedProfit)} icon={Scale} tone={dashboard.estimatedProfit >= 0 ? "positive" : "negative"} hint="Realizado + previsto - despesas" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Lucro realizado" value={currencyBRL(dashboard.realizedProfit)} icon={ArrowUpCircle} tone={dashboard.realizedProfit >= 0 ? "positive" : "negative"} hint="Receita recebida - despesas pagas" />
        <KpiCard label="Ticket médio" value={currencyBRL(dashboard.ticketAverage)} icon={ShoppingCart} tone="accent" hint={`${dashboard.salesCount} venda(s)`} />
        <KpiCard label="Clientes atendidos" value={String(dashboard.uniqueClients)} icon={Users} tone="accent" hint="Clientes únicos no período" />
        <KpiCard label="Descontos" value={currencyBRL(dashboard.discounts)} icon={ArrowDownCircle} hint="Bruto - líquido recebido" />
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <div className="p-4 border-b">
          <div className="text-sm font-semibold">Agendamentos futuros considerados na previsão</div>
          <div className="text-xs text-muted-foreground">Cancelados são ignorados; ausência de dados não gera erro.</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dashboard.appointmentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  Nenhum agendamento futuro confirmado/em aberto. A previsão permanece em R$ 0,00.
                </TableCell>
              </TableRow>
            ) : dashboard.appointmentRows.map((appointment) => {
              const date = new Date(appointment.date);
              return (
                <TableRow key={appointment.id}>
                  <TableCell>{format(date, "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-muted-foreground">{format(date, "HH:mm")}</TableCell>
                  <TableCell className="font-medium">{appointment.client}</TableCell>
                  <TableCell>{appointment.professional}</TableCell>
                  <TableCell>{appointment.service}</TableCell>
                  <TableCell><Badge variant="secondary">{appointment.status}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{currencyBRL(appointment.amount)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
