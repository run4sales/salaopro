import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CircleDollarSign, Clock3, History, PackageCheck, UserRound, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeStatus, STATUS_LABELS } from "@/lib/appointmentStatus";

type ClientRecord = {
  id: string;
  establishment_id: string;
  name: string;
  nickname?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cpf?: string | null;
  address?: string | null;
  instagram?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  acquisition_source?: string | null;
  notes?: string | null;
  credit_balance?: number | null;
};

interface Props {
  client: ClientRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: ClientRecord) => void;
}

const money = (value: unknown) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const when = (value?: string | null) => value ? format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";

export function ClientProfileDialog({ client, open, onOpenChange, onEdit }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-crm", client?.establishment_id, client?.id],
    enabled: open && !!client?.id && !!client?.establishment_id,
    queryFn: async () => {
      if (!client) return null;
      const [appointments, sales, packages, subscriptions, credits, consumptions] = await Promise.all([
        supabase.from("appointments").select("id, appointment_date, status, notes, service_amount, services(name), professionals(name)").eq("establishment_id", client.establishment_id).eq("client_id", client.id).order("appointment_date", { ascending: false }),
        supabase.from("sales").select("id, appointment_id, amount, sale_date, payment_method, notes, services(name)").eq("establishment_id", client.establishment_id).eq("client_id", client.id).is("deleted_at", null).order("sale_date", { ascending: false }),
        supabase.from("customer_packages").select("id, purchased_at, starts_at, expires_at, amount_paid, status, service_packages(name), customer_package_credits(contracted, used, services(name))").eq("establishment_id", client.establishment_id).eq("client_id", client.id).order("purchased_at", { ascending: false }),
        supabase.from("customer_service_subscriptions").select("id, status, starts_at, next_renewal_at, cancelled_at, customer_subscription_plans(name, price), customer_subscription_cycles(id, starts_at, ends_at, status, paid_at, customer_subscription_credits(contracted, used, services(name)))").eq("establishment_id", client.establishment_id).eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("client_credit_transactions").select("id, type, amount, origin, description, payment_method, created_at").eq("establishment_id", client.establishment_id).eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("service_benefit_consumptions").select("id, benefit_type, reference_value, consumed_at, reversed_at, appointments(appointment_date), services(name), professionals(name)").eq("establishment_id", client.establishment_id).eq("client_id", client.id).order("consumed_at", { ascending: false }),
      ]);
      const failure = [appointments, sales, packages, subscriptions, credits, consumptions].find((result) => result.error);
      if (failure?.error) throw failure.error;
      return {
        appointments: (appointments.data ?? []) as any[], sales: (sales.data ?? []) as any[],
        packages: (packages.data ?? []) as any[], subscriptions: (subscriptions.data ?? []) as any[],
        credits: (credits.data ?? []) as any[], consumptions: (consumptions.data ?? []) as any[],
      };
    },
  });

  if (!client) return null;
  const appointments = data?.appointments ?? [];
  const sales = data?.sales ?? [];
  const completed = appointments.filter((item) => normalizeStatus(item.status) === "completed");
  const cancelled = appointments.filter((item) => normalizeStatus(item.status) === "canceled");
  const missed = appointments.filter((item) => ["no_show", "missed", "absent", "faltou"].includes(String(item.status ?? "").toLowerCase()));
  const nextAppointment = [...appointments].filter((item) => new Date(item.appointment_date) > new Date() && !["completed", "canceled"].includes(normalizeStatus(item.status))).sort((a, b) => +new Date(a.appointment_date) - +new Date(b.appointment_date))[0];
  const realized = sales.reduce((sum, sale) => sum + Number(sale.amount ?? 0), 0);
  const saleByAppointment = new Map<string, number>();
  sales.forEach((sale) => sale.appointment_id && saleByAppointment.set(sale.appointment_id, (saleByAppointment.get(sale.appointment_id) ?? 0) + Number(sale.amount ?? 0)));
  const contactRows = [
    ["Telefone", client.phone], ["WhatsApp", client.whatsapp], ["E-mail", client.email], ["CPF", client.cpf],
    ["Nascimento", client.birth_date ? format(new Date(`${client.birth_date}T12:00:00`), "dd/MM/yyyy") : null],
    ["Instagram", client.instagram], ["Endereço", client.address], ["Como chegou", client.acquisition_source],
  ].filter(([, value]) => value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <DialogHeader className="border-b px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="truncate text-2xl">{client.name}</DialogTitle>
              <DialogDescription>{client.nickname ? `Também conhecido como ${client.nickname}` : "Ficha completa do cliente"}</DialogDescription>
            </div>
            <Button variant="outline" onClick={() => onEdit(client)}>Editar dados</Button>
          </div>
        </DialogHeader>

        {isLoading ? <p className="p-8 text-center text-muted-foreground">Carregando ficha...</p> : (
          <div className="space-y-6 px-4 py-5 sm:px-7">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              {[
                [CircleDollarSign, "Consumo realizado", money(realized)],
                [WalletCards, "Ticket médio", money(completed.length ? realized / completed.length : 0)],
                [History, "Atendimentos", String(completed.length)],
                [CalendarClock, "Próximo horário", nextAppointment ? when(nextAppointment.appointment_date) : "Nenhum"],
                [Clock3, "Faltas / cancelamentos", `${missed.length} / ${cancelled.length}`],
              ].map(([Icon, label, value]: any) => (
                <div key={label} className="min-w-0 rounded-md border p-3">
                  <Icon className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="break-words font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <Tabs defaultValue="history">
              <TabsList className="h-auto w-full justify-start overflow-x-auto">
                <TabsTrigger value="personal">Dados pessoais</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
                <TabsTrigger value="packages">Pacotes e combos</TabsTrigger>
                <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
                <TabsTrigger value="financial">Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4 pt-3">
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {contactRows.length ? contactRows.map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="break-words font-medium">{value}</p></div>) : <p className="text-sm text-muted-foreground">Nenhum dado adicional preenchido.</p>}
                </div>
                {client.notes && <div className="border-t pt-4"><p className="text-xs text-muted-foreground">Observações</p><p className="whitespace-pre-wrap text-sm">{client.notes}</p></div>}
              </TabsContent>

              <TabsContent value="history" className="space-y-3 pt-3">
                {completed.length === 0 ? <Empty text="Nenhum atendimento finalizado." /> : completed.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-medium">{item.services?.name ?? "Atendimento"}</p><p className="text-sm text-muted-foreground">{when(item.appointment_date)} · {item.professionals?.name ?? "Profissional não informado"}</p></div>
                    <p className="font-semibold">{money(saleByAppointment.get(item.id) ?? item.service_amount)}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="packages" className="space-y-3 pt-3">
                {(data?.packages ?? []).length === 0 ? <Empty text="Nenhum pacote ou combo adquirido." /> : data?.packages.map((item) => (
                  <div key={item.id} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.service_packages?.name ?? "Pacote"}</p><p className="text-sm text-muted-foreground">Adquirido em {when(item.purchased_at)} · validade até {when(item.expires_at)}</p></div><Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge></div>
                    <p className="mt-2 text-sm font-medium">Valor pago: {money(item.amount_paid)}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">{(item.customer_package_credits ?? []).map((credit: any, index: number) => <div key={`${credit.services?.name}-${index}`} className="flex justify-between rounded-md bg-muted px-3 py-2 text-sm"><span>{credit.services?.name ?? "Serviço"}</span><strong>{credit.contracted - credit.used} de {credit.contracted}</strong></div>)}</div>
                  </div>
                ))}
                {(data?.consumptions ?? []).filter((item) => item.benefit_type === "package").map((item) => <Usage key={item.id} item={item} />)}
              </TabsContent>

              <TabsContent value="subscriptions" className="space-y-3 pt-3">
                {(data?.subscriptions ?? []).length === 0 ? <Empty text="Nenhuma assinatura encontrada." /> : data?.subscriptions.map((item) => (
                  <div key={item.id} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.customer_subscription_plans?.name ?? "Assinatura"}</p><p className="text-sm text-muted-foreground">Início {when(item.starts_at)} · próxima renovação {when(item.next_renewal_at)}</p></div><Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge></div>
                    <p className="mt-2 text-sm font-medium">{money(item.customer_subscription_plans?.price)} por mês</p>
                    {(item.customer_subscription_cycles ?? []).map((cycle: any) => <div key={cycle.id} className="mt-3 border-t pt-3 text-sm"><p className="text-muted-foreground">Ciclo {when(cycle.starts_at)} — {when(cycle.ends_at)}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{(cycle.customer_subscription_credits ?? []).map((credit: any, index: number) => <div key={`${credit.services?.name}-${index}`} className="flex justify-between rounded-md bg-muted px-3 py-2"><span>{credit.services?.name ?? "Serviço"}</span><strong>{credit.contracted - credit.used} de {credit.contracted}</strong></div>)}</div></div>)}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="financial" className="space-y-3 pt-3">
                <div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-muted-foreground">Saldo na carteira</span><strong className="text-lg text-primary">{money(client.credit_balance)}</strong></div>
                {sales.map((sale) => <div key={sale.id} className="flex items-center justify-between gap-3 border-b pb-3"><div><p className="font-medium">{sale.services?.name ?? "Venda"}</p><p className="text-sm text-muted-foreground">{when(sale.sale_date)} · {sale.payment_method ?? "Forma não informada"}</p></div><strong>{money(sale.amount)}</strong></div>)}
                {(data?.credits ?? []).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 border-b pb-3"><div><p className="font-medium">{entry.description || entry.origin}</p><p className="text-sm text-muted-foreground">{when(entry.created_at)}</p></div><strong className={entry.type === "credit" ? "text-success" : "text-destructive"}>{entry.type === "credit" ? "+" : "−"}{money(entry.amount)}</strong></div>)}
                {sales.length === 0 && (data?.credits ?? []).length === 0 && <Empty text="Nenhuma movimentação financeira encontrada." />}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground"><UserRound className="mx-auto mb-2 h-7 w-7" />{text}</div>;
}

function Usage({ item }: { item: any }) {
  return <div className="flex items-center justify-between gap-3 border-b py-2 text-sm"><div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" /><span>{item.services?.name ?? "Serviço utilizado"} · {when(item.consumed_at)}</span></div>{item.reversed_at && <Badge variant="secondary">Estornado</Badge>}</div>;
}