import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CreditCard, FileText, QrCode, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type BillingType = "CREDIT_CARD" | "BOLETO" | "PIX";

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  max_clients: number | null;
  max_users: number | null;
  display_order: number;
};

export default function Checkout() {
  const navigate = useNavigate();
  const { data, refetch } = useSubscription();
  const { profile, user } = useAuth();
  const [billingType, setBillingType] = useState<BillingType>("CREDIT_CARD");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [name, setName] = useState(profile?.owner_name ?? "");
  const [email, setEmail] = useState(user?.email ?? profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [postalCode, setPostalCode] = useState(profile?.cep ?? "");
  const [addressNumber, setAddressNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(data?.payment_link ?? null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(data?.plan_id ?? null);

  const plansQuery = useQuery({
    queryKey: ["checkout-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("id, slug, name, monthly_price, max_clients, max_users, display_order")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data as PlanRow[];
    },
  });

  useEffect(() => {
    if (!selectedPlanId && data?.plan_id) setSelectedPlanId(data.plan_id);
  }, [data?.plan_id, selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId && plansQuery.data?.length) {
      const fallback =
        plansQuery.data.find((p) => p.slug === "profissional") ?? plansQuery.data[0];
      setSelectedPlanId(fallback.id);
    }
  }, [plansQuery.data, selectedPlanId]);

  const plan = plansQuery.data?.find((p) => p.id === selectedPlanId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlanId) {
      toast.error("Selecione um plano para continuar");
      return;
    }
    if (cpfCnpj.replace(/\D/g, "").length < 11) {
      toast.error("Informe um CPF ou CNPJ válido");
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("asaas-create-subscription", {
        body: {
          plan_id: selectedPlanId,
          billing_type: billingType,
          cpf_cnpj: cpfCnpj,
          name,
          email,
          phone,
          postal_code: postalCode,
          address_number: addressNumber,
        },
      });
      if (error) throw error;
      if (!res?.ok) throw new Error(res?.error ?? "Falha ao gerar cobrança");
      setPaymentLink(res.payment_link);
      toast.success("Cobrança gerada com sucesso!");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        <Card className="bg-card/60 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pagamento da assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Escolha o plano</div>
                <div className="text-lg font-semibold">{plan?.name ?? "Selecione..."}</div>
                {plan && (
                  <div className="text-2xl font-bold text-primary mt-1">
                    R${Number(plan.monthly_price).toFixed(2).replace(".", ",")}
                    <span className="text-sm text-muted-foreground font-normal">/mês</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {plansQuery.data?.map((p) => {
                  const active = selectedPlanId === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`text-left rounded-lg border p-3 transition ${
                        active
                          ? "border-primary bg-primary/10 shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-sm font-bold text-primary">
                        R${Number(p.monthly_price).toFixed(2).replace(".", ",")}
                        <span className="text-[10px] text-muted-foreground font-normal">/mês</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {p.max_clients ? `${p.max_clients} clientes` : "Clientes ilimitados"} •{" "}
                        {p.max_users ? `${p.max_users} usuários` : "Usuários ilimitados"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentLink ? (
              <div className="rounded-lg border border-success/40 bg-success/10 p-6 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <p className="text-sm">
                  Sua cobrança foi gerada. Acesse o link abaixo para concluir o pagamento.
                </p>
                <Button asChild className="w-full">
                  <a href={paymentLink} target="_blank" rel="noreferrer">
                    Abrir fatura <ExternalLink className="h-4 w-4 ml-2" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPaymentLink(null)}>
                  Gerar nova cobrança
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Forma de pagamento</Label>
                  <RadioGroup
                    value={billingType}
                    onValueChange={(v) => setBillingType(v as BillingType)}
                    className="grid grid-cols-3 gap-2 mt-2"
                  >
                    {[
                      { v: "CREDIT_CARD", label: "Cartão", Icon: CreditCard },
                      { v: "PIX", label: "Pix", Icon: QrCode },
                      { v: "BOLETO", label: "Boleto", Icon: FileText },
                    ].map(({ v, label, Icon }) => (
                      <label
                        key={v}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-3 cursor-pointer transition ${
                          billingType === v ? "border-primary bg-primary/10" : "border-border/60"
                        }`}
                      >
                        <RadioGroupItem value={v} className="sr-only" />
                        <Icon className="h-5 w-5" />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="name">Nome completo / Razão social</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF ou CNPJ</Label>
                    <Input
                      id="cpf"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="Somente números"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="phone">Celular</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Input id="cep" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="num">Número do endereço</Label>
                    <Input id="num" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Gerando cobrança..." : "Gerar cobrança"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Cobrança processada via Asaas. Você será redirecionado para a fatura.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
