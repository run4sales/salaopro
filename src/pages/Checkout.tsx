import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.plan_id) {
      toast.error("Selecione um plano antes de continuar");
      navigate("/escolher-plano");
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
          plan_id: data.plan_id,
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

  const plan = data?.plan;

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
            <div className="rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">Plano selecionado</div>
              <div className="text-lg font-semibold">{plan?.name ?? "Nenhum"}</div>
              {plan && (
                <div className="text-2xl font-bold text-primary mt-1">
                  R${Number(plan.monthly_price).toFixed(2).replace(".", ",")}
                  <span className="text-sm text-muted-foreground font-normal">/mês</span>
                </div>
              )}
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
