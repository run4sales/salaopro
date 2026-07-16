import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  ShoppingCart,
  UserCircle2,
  Users,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowLeftRight,
  Percent,
  Tag,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientCombobox } from "@/components/ClientCombobox";
import { ClientCreditPrompt } from "@/components/clients/ClientCreditPrompt";
import { insertSalesWithCreatorFallback } from "@/lib/salesInsert";
import { syncSaleCommissions } from "@/lib/commissions";
import { Wallet } from "lucide-react";

interface SimpleClient { id: string; name: string }
interface SimpleService {
  id: string;
  name: string;
  price: number;
  commission_solo: number;
}
interface SimpleProfessional {
  id: string;
  name: string;
  commission_type: 'per_service' | 'custom_percentage' | 'fixed_daily';
  custom_percentage: number;
}
interface Machine { id: string; name: string }
interface MachineFee { card_machine_id: string; payment_type: string; installments: number | null; fee_percentage: number }

type CommissionRole = "solo" | "with_assistants" | "as_assistant";

interface CartItem {
  service: SimpleService;
  qty: number;
  customPrice?: number;
}

interface ProfessionalEntry {
  professional_id: string;
  role: CommissionRole;
}

type AdjustmentMode = "discount" | "surcharge";
type AdjustmentType = "value" | "percent";

type PaymentMethodKey = "Dinheiro" | "Pix" | "Débito" | "Crédito" | "Crédito parcelado" | "Transferência";

const paymentMethods: { value: PaymentMethodKey; label: string; icon: any; isCard?: boolean; cardType?: 'debit' | 'credit' | 'credit_installment' }[] = [
  { value: "Dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "Pix", label: "Pix", icon: Smartphone },
  { value: "Débito", label: "Débito", icon: CreditCard, isCard: true, cardType: 'debit' },
  { value: "Crédito", label: "Crédito", icon: CreditCard, isCard: true, cardType: 'credit' },
  { value: "Crédito parcelado", label: "Parcelado", icon: CreditCard, isCard: true, cardType: 'credit_installment' },
  { value: "Transferência", label: "Transf.", icon: ArrowLeftRight },
];

const roleLabels: Record<CommissionRole, string> = {
  solo: "Sozinho",
  with_assistants: "Com assistentes",
  as_assistant: "Como assistente",
};

export default function Sales() {
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "PDV de Vendas | Beauty Core";
  }, []);

  // PDV state
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [professionalEntries, setProfessionalEntries] = useState<ProfessionalEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>("Dinheiro");
  const [cardMachineId, setCardMachineId] = useState<string>("");
  const [installments, setInstallments] = useState<string>("2");
  const [notes, setNotes] = useState<string>("");
  const [adjMode, setAdjMode] = useState<AdjustmentMode>("discount");
  const [adjType, setAdjType] = useState<AdjustmentType>("value");
  const [adjValue, setAdjValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [creditAmount, setCreditAmount] = useState<string>("0");
  const [creditPromptOpen, setCreditPromptOpen] = useState(false);
  const [creditPromptShownFor, setCreditPromptShownFor] = useState<string>("");

  const { data: services } = useQuery<SimpleService[]>({
    queryKey: ["services", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("services")
        .select("id, name, price, commission_solo")
        .eq("establishment_id", profile.id)
        .eq("active", true)
        .order("name");
      return ((data ?? []) as any[]).map((s) => ({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        commission_solo: Number(s.commission_solo ?? 0),
      }));
    },
    enabled: !!profile?.id,
  });

  const { data: professionals } = useQuery<SimpleProfessional[]>({
    queryKey: ["professionals-full", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("professionals")
        .select("id, name, commission_type, custom_percentage")
        .eq("establishment_id", profile.id)
        .eq("active", true)
        .order("name");
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        commission_type: (p.commission_type ?? 'per_service') as SimpleProfessional['commission_type'],
        custom_percentage: Number(p.custom_percentage ?? 0),
      }));
    },
    enabled: !!profile?.id,
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["card_machines", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase.from("card_machines").select("id, name").eq("establishment_id", profile.id).eq("active", true).order("name");
      return (data ?? []) as Machine[];
    },
    enabled: !!profile?.id,
  });

  const { data: machineFees } = useQuery<MachineFee[]>({
    queryKey: ["card_machine_fees-all", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase.from("card_machine_fees").select("card_machine_id, payment_type, installments, fee_percentage").eq("establishment_id", profile.id);
      return (data ?? []) as MachineFee[];
    },
    enabled: !!profile?.id,
  });

  const { data: clientCreditBalance } = useQuery<number>({
    queryKey: ["client_credit_balance", clientId],
    queryFn: async () => {
      if (!clientId) return 0;
      const { data } = await supabase
        .from("clients")
        .select("credit_balance")
        .eq("id", clientId)
        .single();
      return Number(data?.credit_balance ?? 0);
    },
    enabled: !!clientId,
  });

  const availableCredit = Number(clientCreditBalance ?? 0);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services ?? [];
    return (services ?? []).filter((s) => s.name.toLowerCase().includes(q));
  }, [services, search]);

  const subtotal = useMemo(
    () => cart.reduce((s, item) => s + (item.customPrice ?? item.service.price) * item.qty, 0),
    [cart]
  );

  const adjustmentAmount = useMemo(() => {
    const v = Number(adjValue) || 0;
    if (v <= 0) return 0;
    const base = adjType === "percent" ? subtotal * (v / 100) : v;
    return adjMode === "discount" ? -Math.min(base, subtotal) : base;
  }, [adjValue, adjType, adjMode, subtotal]);

  const grossTotal = Math.max(0, subtotal + adjustmentAmount);

  // Card fee calculation
  const currentPaymentMeta = paymentMethods.find(m => m.value === paymentMethod);
  const isCard = !!currentPaymentMeta?.isCard;
  const feePercentage = useMemo(() => {
    if (!isCard || !cardMachineId) return 0;
    const cardType = currentPaymentMeta?.cardType;
    if (!cardType) return 0;
    const fee = (machineFees ?? []).find(f =>
      f.card_machine_id === cardMachineId &&
      f.payment_type === cardType &&
      (cardType !== 'credit_installment' || f.installments === parseInt(installments, 10))
    );
    return fee ? Number(fee.fee_percentage) : 0;
  }, [isCard, cardMachineId, currentPaymentMeta, machineFees, installments]);

  const appliedCredit = useCredit
    ? Math.min(Number(creditAmount) || 0, availableCredit, grossTotal)
    : 0;
  const remainingToPay = Math.max(grossTotal - appliedCredit, 0);
  const feeAmount = (remainingToPay * feePercentage) / 100;
  const netTotal = remainingToPay - feeAmount;

  // Auto-prompt quando cliente com saldo é selecionado e há itens no carrinho
  useEffect(() => {
    if (!clientId || availableCredit <= 0 || grossTotal <= 0) return;
    const key = `${clientId}:${grossTotal.toFixed(2)}`;
    if (creditPromptShownFor === key || useCredit) return;
    setCreditPromptOpen(true);
    setCreditPromptShownFor(key);
  }, [clientId, availableCredit, grossTotal, useCredit, creditPromptShownFor]);

  // Reset quando muda cliente
  useEffect(() => {
    setUseCredit(false);
    setCreditAmount("0");
    setCreditPromptShownFor("");
  }, [clientId]);

  const addToCart = (svc: SimpleService) => {
    setCart((prev) => {
      const exist = prev.find((i) => i.service.id === svc.id);
      if (exist) {
        return prev.map((i) => i.service.id === svc.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { service: svc, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.service.id === id ? { ...i, qty: i.qty + delta } : i)
        .filter((i) => i.qty > 0)
    );
  };

  const updateItemPrice = (id: string, price: string) => {
    const v = Number(price);
    setCart(prev => prev.map(i => i.service.id === id ? { ...i, customPrice: isNaN(v) || v < 0 ? undefined : v } : i));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.service.id !== id));
  };

  const addProfessionalEntry = (id: string) => {
    if (!id || professionalEntries.some(e => e.professional_id === id)) return;
    setProfessionalEntries([...professionalEntries, { professional_id: id, role: professionalEntries.length === 0 ? "solo" : "with_assistants" }]);
  };

  const removeProfessionalEntry = (id: string) => {
    setProfessionalEntries(professionalEntries.filter(e => e.professional_id !== id));
  };

  const updateRole = (id: string, role: CommissionRole) => {
    setProfessionalEntries(professionalEntries.map(e => e.professional_id === id ? { ...e, role } : e));
  };

  const availableProfessionals = (professionals || []).filter(p => !professionalEntries.some(e => e.professional_id === p.id));

  const resetSale = () => {
    setCart([]);
    setProfessionalEntries([]);
    setClientId("");
    setAdjValue("");
    setAdjMode("discount");
    setAdjType("value");
    setNotes("");
    setPaymentMethod("Dinheiro");
    setCardMachineId("");
    setInstallments("2");
    setUseCredit(false);
    setCreditAmount("0");
    setCreditPromptShownFor("");
  };

  const onFinalize = async () => {
    if (!profile?.id) return;
    if (!clientId) { toast.error("Selecione o cliente."); return; }
    if (cart.length === 0) { toast.error("Adicione ao menos um serviço."); return; }
    if (professionalEntries.length === 0) { toast.error("Selecione ao menos um profissional."); return; }
    if (remainingToPay > 0 && isCard && !cardMachineId) { toast.error("Selecione a maquininha."); return; }
    if (appliedCredit > availableCredit) { toast.error("Crédito insuficiente."); return; }

    setSubmitting(true);
    try {
      const principal = professionalEntries[0].professional_id;
      const flatItems: { svc: SimpleService; baseAmount: number }[] = [];
      cart.forEach((item) => {
        const price = item.customPrice ?? item.service.price;
        for (let i = 0; i < item.qty; i++) {
          flatItems.push({ svc: item.service, baseAmount: price });
        }
      });

      const factor = subtotal > 0 ? grossTotal / subtotal : 1;
      const feePct = feePercentage / 100;
      const creditFactor = grossTotal > 0 ? appliedCredit / grossTotal : 0;
      const instNum = (isCard && currentPaymentMeta?.cardType === 'credit_installment') ? parseInt(installments, 10) : null;

      const salesPayload = flatItems.map(({ svc, baseAmount }) => {
        const itemGross = Number((baseAmount * factor).toFixed(2));
        const itemCredit = Number((itemGross * creditFactor).toFixed(2));
        const itemCash = Number((itemGross - itemCredit).toFixed(2));
        const itemFee = Number((itemCash * feePct).toFixed(2));
        return {
          establishment_id: profile.id,
          client_id: clientId,
          service_id: svc.id,
          professional_id: principal,
          amount: itemGross,
          gross_amount: itemGross,
          fee_amount: itemFee,
          net_amount: Number((itemCash - itemFee).toFixed(2)),
          credit_used: itemCredit,
          paid_now: itemCash,
          card_machine_id: isCard && itemCash > 0 ? cardMachineId : null,
          installments: itemCash > 0 ? instNum : null,
          sale_date: new Date().toISOString(),
          payment_method: itemCash > 0 ? paymentMethod : "Crédito do cliente",
          notes: notes || null,
          created_by_user_id: user.id,
        };
      });

      const { data: insertedSales, error } = await insertSalesWithCreatorFallback(salesPayload);
      if (error) throw error;

      // Debita o crédito por venda (vinculado para estorno em cancelamento)
      for (const sale of insertedSales ?? []) {
        const credit = Number((sale as any).credit_used ?? 0);
        if (credit > 0) {
          const { error: cErr } = await (supabase as any).rpc("use_client_credit", {
            _client_id: clientId,
            _amount: credit,
            _origin: "sale_usage",
            _description: "Uso de crédito em venda",
            _source: "sale",
            _source_id: sale.id,
          });
          if (cErr) throw cErr;
        }
      }

      await Promise.all((insertedSales || []).map((sale: any) => {
        const svc = flatItems.find(f => f.svc.id === sale.service_id)?.svc;
        if (!svc) return Promise.resolve();

        return syncSaleCommissions({
          establishmentId: profile.id,
          saleId: sale.id,
          serviceCommissionPercentage: Number(svc.commission_solo ?? 0),
          baseAmount: Number(sale.amount ?? 0),
          professionals: professionalEntries,
        });
      }));

      toast.success(
        `Venda finalizada • R$ ${grossTotal.toFixed(2)}` +
        (appliedCredit > 0 ? ` (R$ ${appliedCredit.toFixed(2)} em crédito)` : '') +
        (feeAmount > 0 ? ` • líquido R$ ${netTotal.toFixed(2)}` : '')
      );
      resetSale();
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível finalizar a venda.");
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
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              PDV — Nova venda
            </h1>
            <p className="text-xs text-muted-foreground">Selecione serviços, profissionais e finalize em poucos cliques</p>
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetSale} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        {/* LEFT: Catalog */}
        <section className="space-y-4">
          <div className="rounded-xl border bg-card p-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cliente *</Label>
            <div className="mt-2">
              {profile?.id && (
                <ClientCombobox
                  establishmentId={profile.id}
                  value={clientId}
                  onChange={(id) => setClientId(id)}
                />
              )}
            </div>
          </div>

          {/* Services catalog */}
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Serviços</Label>
              <div className="relative w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar serviço..."
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {filteredServices.map((s) => {
                const inCart = cart.find(i => i.service.id === s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addToCart(s)}
                    className={cn(
                      "group relative text-left rounded-lg border bg-card p-3 hover:border-primary hover:shadow-sm transition-all duration-200",
                      inCart && "border-primary bg-primary/5"
                    )}
                  >
                    {inCart && (
                      <Badge className="absolute -top-2 -right-2 h-6 min-w-6 px-1.5 rounded-full">
                        {inCart.qty}
                      </Badge>
                    )}
                    <div className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">{s.name}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-primary">R$ {s.price.toFixed(2)}</span>
                      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </button>
                );
              })}
              {filteredServices.length === 0 && (
                <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
                  Nenhum serviço encontrado
                </div>
              )}
            </div>
          </div>

          {/* Professionals */}
          <div className="rounded-xl border bg-card p-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Profissionais do atendimento
            </Label>
            <div className="mt-2 space-y-2">
              {professionalEntries.map((entry) => {
                const prof = professionals?.find(p => p.id === entry.professional_id);
                return (
                  <div key={entry.professional_id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                    <div className="font-medium text-sm flex-1">{prof?.name || "Profissional"}</div>
                    <Select value={entry.role} onValueChange={(v) => updateRole(entry.professional_id, v as CommissionRole)}>
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Sozinho</SelectItem>
                        <SelectItem value="with_assistants">Com assistentes</SelectItem>
                        <SelectItem value="as_assistant">Como assistente</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeProfessionalEntry(entry.professional_id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {availableProfessionals.length > 0 && (
                <Select value="" onValueChange={addProfessionalEntry}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={professionalEntries.length === 0 ? "Adicionar profissional..." : "+ Adicionar outro profissional"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfessionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: Cart / Checkout */}
        <aside className="space-y-4 lg:sticky lg:top-[88px] lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-semibold text-sm">Comanda</span>
              </div>
              <Badge variant="secondary">{cart.reduce((s, i) => s + i.qty, 0)} {cart.reduce((s, i) => s + i.qty, 0) === 1 ? "item" : "itens"}</Badge>
            </div>

            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
              {cart.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Toque em um serviço para adicionar
                </div>
              )}
              {cart.map((item) => (
                <div key={item.service.id} className="flex items-center gap-2 rounded-lg border bg-background px-2 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.service.name}</div>
                    <div className="text-xs text-muted-foreground">R$ {item.service.price.toFixed(2)} cada</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(item.service.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center font-semibold text-sm">{item.qty}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(item.service.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="w-20 text-right font-bold text-sm">
                    R$ {(item.service.price * item.qty).toFixed(2)}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => removeFromCart(item.service.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Adjustment */}
            <div className="px-3 py-3 border-t bg-muted/20 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Desconto / Acréscimo
              </Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={adjMode === "discount" ? "default" : "outline"}
                  className="flex-1 h-8"
                  onClick={() => setAdjMode("discount")}
                >
                  <Minus className="h-3 w-3 mr-1" /> Desconto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={adjMode === "surcharge" ? "default" : "outline"}
                  className="flex-1 h-8"
                  onClick={() => setAdjMode("surcharge")}
                >
                  <Plus className="h-3 w-3 mr-1" /> Acréscimo
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAdjType("value")}
                    className={cn("px-2.5 text-xs font-semibold transition", adjType === "value" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType("percent")}
                    className={cn("px-2.5 text-xs font-semibold transition border-l", adjType === "percent" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
                  >
                    <Percent className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={adjValue}
                  onChange={(e) => setAdjValue(e.target.value)}
                  placeholder="0,00"
                  className="h-9 flex-1"
                />
              </div>
            </div>

            {/* Credit panel */}
            {clientId && availableCredit > 0 && (
              <div className="px-4 py-3 border-t bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" /> Crédito disponível
                  </span>
                  <span className="text-sm font-semibold text-primary">R$ {availableCredit.toFixed(2)}</span>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useCredit}
                    onChange={(e) => {
                      setUseCredit(e.target.checked);
                      if (e.target.checked) {
                        setCreditAmount(Math.min(availableCredit, grossTotal).toFixed(2));
                      }
                    }}
                  />
                  Usar crédito do cliente
                </label>
                {useCredit && (
                  <div className="space-y-1">
                    <Label className="text-xs">Valor a aplicar (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      max={Math.min(availableCredit, grossTotal)}
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCreditAmount(Math.min(availableCredit, grossTotal).toFixed(2))}
                    >
                      Usar tudo (R$ {Math.min(availableCredit, grossTotal).toFixed(2)})
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="px-4 py-3 border-t space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {adjustmentAmount !== 0 && (
                <div className={cn("flex justify-between", adjustmentAmount < 0 ? "text-emerald-600" : "text-amber-600")}>
                  <span>{adjustmentAmount < 0 ? "Desconto" : "Acréscimo"}</span>
                  <span>{adjustmentAmount < 0 ? "-" : "+"} R$ {Math.abs(adjustmentAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1.5 border-t">
                <span className="font-semibold">Total bruto</span>
                <span className="text-xl font-bold">R$ {grossTotal.toFixed(2)}</span>
              </div>
              {appliedCredit > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Crédito aplicado</span>
                  <span>- R$ {appliedCredit.toFixed(2)}</span>
                </div>
              )}
              {appliedCredit > 0 && (
                <div className="flex justify-between font-semibold border-t pt-1.5">
                  <span>A pagar agora</span>
                  <span>R$ {remainingToPay.toFixed(2)}</span>
                </div>
              )}
              {feeAmount > 0 && (
                <>
                  <div className="flex justify-between text-amber-600">
                    <span>Taxa ({feePercentage.toFixed(2)}%)</span>
                    <span>- R$ {feeAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1.5 border-t">
                    <span className="font-semibold">Líquido</span>
                    <span className="text-2xl font-bold text-primary">R$ {netTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Payment */}
            <div className="px-3 py-3 border-t bg-muted/20 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Forma de pagamento</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {paymentMethods.map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPaymentMethod(m.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-all duration-150",
                        active ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/50 text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {isCard && (
                <div className="space-y-2 pt-2">
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={cardMachineId}
                    onChange={(e) => setCardMachineId(e.target.value)}
                  >
                    <option value="">Selecione a maquininha...</option>
                    {(machines ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {currentPaymentMeta?.cardType === 'credit_installment' && (
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                    >
                      {Array.from({ length: 11 }, (_, i) => i + 2).map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                  )}
                  {isCard && cardMachineId && feePercentage === 0 && (
                    <p className="text-xs text-amber-600">⚠ Sem taxa cadastrada para esta modalidade. Configure em Configurações → Maquininhas.</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-3 py-3 border-t">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações (opcional)"
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="p-3 border-t bg-card">
              <Button
                size="lg"
                className="w-full h-12 text-base font-bold"
                onClick={onFinalize}
                disabled={submitting || cart.length === 0}
              >
                <Check className="h-5 w-5 mr-2" />
                {submitting ? "Finalizando..." : `Finalizar • R$ ${(feeAmount > 0 ? netTotal : grossTotal).toFixed(2)}`}
              </Button>
            </div>
          </div>
        </aside>
      </main>
      <ClientCreditPrompt
        open={creditPromptOpen}
        onOpenChange={setCreditPromptOpen}
        availableCredit={availableCredit}
        total={grossTotal}
        onConfirm={(amount) => {
          setUseCredit(true);
          setCreditAmount(amount.toFixed(2));
          setCreditPromptOpen(false);
        }}
        onDecline={() => {
          setUseCredit(false);
          setCreditPromptOpen(false);
        }}
      />
    </div>
  );
}
