import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { ArrowLeft, CreditCard, Lock } from "lucide-react";

export default function Checkout() {
  const navigate = useNavigate();
  const { data } = useSubscription();

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
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="text-sm text-muted-foreground">Plano selecionado</div>
              <div className="text-lg font-semibold">
                {data?.plan?.name ?? "Nenhum plano selecionado"}
              </div>
              {data?.plan && (
                <div className="text-2xl font-bold text-primary mt-1">
                  R${Number(data.plan.monthly_price).toFixed(2).replace(".", ",")}
                  <span className="text-sm text-muted-foreground font-normal">/mês</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
              <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Integração de pagamento (Stripe) será habilitada em breve.
                <br />
                Enquanto isso, entre em contato para ativar manualmente.
              </p>
              <Button className="mt-4" disabled>
                Pagar com cartão
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
