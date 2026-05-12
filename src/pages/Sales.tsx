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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface SimpleClient { id: string; name: string }
interface SimpleService {
  id: string;
  name: string;
  price: number;
  commission_solo: number;
  commission_with_assistants: number;
  commission_as_assistant: number;
}
interface SimpleProfessional { id: string; name: string }

type CommissionRole = "solo" | "with_assistants" | "as_assistant";

interface ProfessionalEntry {
  professional_id: string;
  role: CommissionRole;
}

const paymentMethods = [
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "Cartão", label: "Cartão" },
  { value: "Pix", label: "Pix" },
  { value: "Transferência", label: "Transferência" },
];

const roleLabels: Record<CommissionRole, string> = {
  solo: "Sozinho",
  with_assistants: "Com assistentes",
  as_assistant: "Como assistente",
};

export default function Sales() {
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Lançar Vendas | Salão PRO";
    const desc = "Cadastrar vendas: cliente, serviço, profissionais e comissões";
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
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalEntries, setProfessionalEntries] = useState<ProfessionalEntry[]>([]);
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
        .select("id, name, price, commission_solo, commission_with_assistants, commission_as_assistant")
        .eq("establishment_id", profile.id)
        .eq("active", true)
        .order("name");
      return ((data ?? []) as any[]).map((s) => ({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        commission_solo: Number(s.commission_solo ?? 0),
        commission_with_assistants: Number(s.commission_with_assistants ?? 0),
        commission_as_assistant: Number(s.commission_as_assistant ?? 0),
      }));
    },
    enabled: !!profile?.id,
  });

  const { data: professionals } = useQuery<SimpleProfessional[]>({
    queryKey: ["professionals", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", profile.id)
        .eq("active", true)
        .order("name");
      return (data ?? []) as SimpleProfessional[];
    },
    enabled: !!profile?.id,
  });

  const selectedServices = useMemo(() => services?.filter(s => serviceIds.includes(s.id)) || [], [services, serviceIds]);
  const totalSelected = useMemo(() => selectedServices.reduce((sum, s) => sum + Number(s.price), 0), [selectedServices]);

  useEffect(() => {
    if (serviceIds.length === 1) {
      const s = services?.find(x => x.id === serviceIds[0]);
      if (s) setAmount(String(Number(s.price)));
    } else {
      setAmount("");
    }
  }, [serviceIds, services]);

  const getCommissionPct = (svc: SimpleService, role: CommissionRole) => {
    if (role === "solo") return svc.commission_solo;
    if (role === "with_assistants") return svc.commission_with_assistants;
    return svc.commission_as_assistant;
  };

  const addProfessionalEntry = (id: string) => {
    if (!id || professionalEntries.some(e => e.professional_id === id)) return;
    setProfessionalEntries([...professionalEntries, { professional_id: id, role: "solo" }]);
  };

  const removeProfessionalEntry = (id: string) => {
    setProfessionalEntries(professionalEntries.filter(e => e.professional_id !== id));
  };

  const updateRole = (id: string, role: CommissionRole) => {
    setProfessionalEntries(professionalEntries.map(e => e.professional_id === id ? { ...e, role } : e));
  };

  const availableProfessionals = (professionals || []).filter(p => !professionalEntries.some(e => e.professional_id === p.id));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!clientId || serviceIds.length === 0 || !date || !paymentMethod) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (professionalEntries.length === 0) {
      toast.error("Selecione ao menos um profissional.");
      return;
    }

    setSubmitting(true);
    try {
      const principal = professionalEntries[0].professional_id;
      const serviceMap = new Map<string, SimpleService>((services || []).map(s => [s.id, s]));

      // Build one sale per selected service
      const salesPayload = serviceIds.map((sid) => {
        const s = serviceMap.get(sid)!;
        const value = serviceIds.length === 1 ? Number(amount || s.price) : Number(s.price);
        return {
          establishment_id: profile.id,
          client_id: clientId,
          service_id: sid,
          professional_id: principal,
          amount: value,
          sale_date: date.toISOString(),
          payment_method: paymentMethod,
          notes: notes || null,
        };
      });

      const { data: insertedSales, error } = await supabase
        .from("sales")
        .insert(salesPayload)
        .select("id, service_id, amount");
      if (error) throw error;

      // Build sale_professionals rows for each sale x professional
      const spRows: any[] = [];
      (insertedSales || []).forEach((sale: any) => {
        const svc = serviceMap.get(sale.service_id);
        if (!svc) return;
        professionalEntries.forEach((entry) => {
          const pct = getCommissionPct(svc, entry.role);
          const commission_amount = Number(sale.amount) * (Number(pct) / 100);
          spRows.push({
            establishment_id: profile.id,
            sale_id: sale.id,
            professional_id: entry.professional_id,
            role: entry.role,
            commission_percentage: pct,
            commission_amount: Number(commission_amount.toFixed(2)),
          });
        });
      });

      if (spRows.length > 0) {
        const { error: spError } = await supabase.from("sale_professionals").insert(spRows);
        if (spError) throw spError;
      }

      toast.success("Venda lançada com sucesso!");
      setServiceIds([]);
      setProfessionalEntries([]);
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
          <p className="text-muted-foreground">Registre serviços realizados, profissionais e comissões</p>
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
            <Label>Serviços</Label>
            <div className="rounded-md border bg-card p-2 max-h-56 overflow-y-auto">
              {services?.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-1">
                  <Checkbox
                    checked={serviceIds.includes(s.id)}
                    onCheckedChange={(checked) => {
                      setServiceIds((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)));
                    }}
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-muted-foreground text-sm">R$ {Number(s.price).toFixed(2)}</span>
                </label>
              ))}
            </div>
            {serviceIds.length > 0 && (
              <p className="text-sm">Selecionados: {serviceIds.length} • Total: R$ {totalSelected.toFixed(2)}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Profissionais do atendimento</Label>
            <div className="rounded-md border bg-card p-3 space-y-3">
              {professionalEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">Adicione um ou mais profissionais que participaram do atendimento.</p>
              )}
              {professionalEntries.map((entry) => {
                const prof = professionals?.find(p => p.id === entry.professional_id);
                return (
                  <div key={entry.professional_id} className="grid grid-cols-1 md:grid-cols-[1fr_240px_auto] gap-2 items-center">
                    <div className="font-medium">{prof?.name || "Profissional"}</div>
                    <Select value={entry.role} onValueChange={(v) => updateRole(entry.professional_id, v as CommissionRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Sozinho</SelectItem>
                        <SelectItem value="with_assistants">Com assistentes</SelectItem>
                        <SelectItem value="as_assistant">Como assistente</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => removeProfessionalEntry(entry.professional_id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {availableProfessionals.length > 0 && (
                <div className="flex gap-2">
                  <Select value="" onValueChange={addProfessionalEntry}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Adicionar profissional..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfessionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {professionalEntries.length > 0 && selectedServices.length > 0 && (() => {
              const perProfessional = professionalEntries.map((e) => {
                const prof = professionals?.find(p => p.id === e.professional_id);
                const commission = selectedServices.reduce((sum, svc) => {
                  const pct = getCommissionPct(svc, e.role);
                  return sum + Number(svc.price) * (pct / 100);
                }, 0);
                return {
                  id: e.professional_id,
                  name: prof?.name || "Profissional",
                  role: e.role,
                  commission,
                };
              });
              const totalCommissions = perProfessional.reduce((s, p) => s + p.commission, 0);
              const equalSplit = totalSelected / professionalEntries.length;
              return (
                <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-accent/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Resumo do fechamento</div>
                    <div className="text-xs text-muted-foreground">
                      {professionalEntries.length} {professionalEntries.length === 1 ? "profissional" : "profissionais"} • {selectedServices.length} {selectedServices.length === 1 ? "serviço" : "serviços"}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-card border p-2">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Total da venda</div>
                      <div className="font-bold">R$ {totalSelected.toFixed(2)}</div>
                    </div>
                    <div className="rounded-md bg-card border p-2">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Comissões</div>
                      <div className="font-bold text-primary">R$ {totalCommissions.toFixed(2)}</div>
                    </div>
                    <div className="rounded-md bg-card border p-2">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Divisão igual</div>
                      <div className="font-bold">R$ {equalSplit.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">Comissão por profissional</div>
                    {perProfessional.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-md bg-card/60 border px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">({roleLabels[p.role]})</span>
                        </div>
                        <span className="font-semibold">R$ {p.commission.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
              placeholder={serviceIds.length === 1 ? "0,00" : "Calculado automaticamente para múltiplos serviços"}
              disabled={serviceIds.length !== 1}
            />
            {serviceIds.length !== 1 && (
              <p className="text-xs text-muted-foreground">Com múltiplos serviços, o valor é somado automaticamente por item.</p>
            )}
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
      </main>
    </div>
  );
}
