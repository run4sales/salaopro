import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface SimpleClient { id: string; name: string }
interface SimpleService { id: string; name: string; price: number }

const paymentMethods = [
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "Cartão", label: "Cartão" },
  { value: "Pix", label: "Pix" },
  { value: "Transferência", label: "Transferência" },
];

export default function Sales() {
  const { user, profile } = useAuth();

  // SEO basics
  useEffect(() => {
    document.title = "Lançar Vendas | Salão PRO";
    const desc = "Cadastrar vendas: cliente, serviço, pagamento e data";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = desc;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }, []);

  const [clientId, setClientId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Dinheiro");
  const [notes, setNotes] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const { data: clients } = useQuery<SimpleClient[]>({
    queryKey: ["clients", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("establishment_id", profile.id)
        .order("name");
      return (data ?? []) as SimpleClient[];
    },
    enabled: !!profile?.id,
  });

  const { data: services } = useQuery<SimpleService[]>({
    queryKey: ["services", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("establishment_id", profile.id)
        .eq("active", true)
        .order("name");
      return ((data ?? []) as any[]).map((s) => ({ id: s.id, name: s.name, price: Number(s.price) }));
    },
    enabled: !!profile?.id,
  });

  const selectedService = useMemo(() => services?.find(s => s.id === serviceId), [services, serviceId]);

  useEffect(() => {
    if (selectedService && !amount) {
      setAmount(String(selectedService.price));
    }
  }, [selectedService]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!clientId || !serviceId || !amount || !date || !paymentMethod) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("sales").insert([
        {
          establishment_id: profile.id,
          client_id: clientId,
          service_id: serviceId,
          amount: value,
          sale_date: date.toISOString(),
          payment_method: paymentMethod,
          notes: notes || null,
        },
      ]);

      if (error) throw error;

      toast.success("Venda lançada com sucesso!");
      // Reset parcial
      setServiceId("");
      setAmount("");
      setPaymentMethod("Dinheiro");
      setNotes("");
      setDate(new Date());
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível lançar a venda.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold">Faça login para lançar vendas</h1>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Lançar Vendas</h1>
          <p className="text-muted-foreground">Registre serviços realizados e pagamentos</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {Number.isFinite(s.price) ? `- R$ ${s.price.toFixed(2)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data do Procedimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "justify-start",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy") : <span>Escolha a data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: pacote, desconto, etc."
              rows={3}
            />
          </div>

          <div className="md:col-span-2 flex gap-3">
            <Button type="submit" className="min-w-40" disabled={submitting}>
              {submitting ? "Lançando..." : "Lançar Venda"}
            </Button>
          </div>
        </form>

        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-2">Como funciona</h2>
          <p className="text-muted-foreground text-sm">
            Ao lançar a venda, o faturamento do mês é atualizado automaticamente e as
            estatísticas do cliente são ajustadas. Você poderá visualizar o faturamento
            atualizado no Dashboard.
          </p>
        </section>
      </main>
    </div>
  );
}
