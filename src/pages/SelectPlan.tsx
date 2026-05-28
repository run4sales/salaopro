import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

type Plan = {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  max_clients: number | null;
  max_users: number | null;
  features: string[] | any;
};

export default function SelectPlan() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data as Plan[];
    },
  });

  async function selectPlan(plan: Plan) {
    if (!profile?.id) return;
    setSaving(plan.id);
    const { error } = await (supabase as any)
      .from("subscriptions")
      .update({ plan_id: plan.id, monthly_amount: plan.monthly_price })
      .eq("establishment_id", profile.id);
    setSaving(null);
    if (error) {
      toast.error("Não foi possível selecionar o plano");
      return;
    }
    toast.success(`Plano ${plan.name} ativado em modo teste por 10 dias`);
    qc.invalidateQueries({ queryKey: ["my-subscription"] });
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-sm text-accent mb-3">
            <Sparkles className="h-4 w-4" /> 10 dias grátis em qualquer plano
          </div>
          <h1 className="text-3xl font-bold">Qual plano você deseja escolher?</h1>
          <p className="text-muted-foreground mt-2">
            Comece o teste agora. Sem cartão de crédito.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {plans.data?.map((plan) => {
            const features: string[] = Array.isArray(plan.features) ? plan.features : [];
            return (
              <Card key={plan.id} className="bg-card/60 border-border/60 hover:border-primary/40 transition">
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between">
                    <span>{plan.name}</span>
                    <span className="text-2xl font-bold text-primary">
                      R${plan.monthly_price.toFixed(2).replace(".", ",")}
                      <span className="text-xs text-muted-foreground font-normal">/mês</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2 items-center">
                      <Check className="h-4 w-4 text-success" />
                      {plan.max_clients ? `Até ${plan.max_clients} clientes` : "Clientes ilimitados"}
                    </li>
                    <li className="flex gap-2 items-center">
                      <Check className="h-4 w-4 text-success" />
                      {plan.max_users ? `Até ${plan.max_users} usuários` : "Usuários ilimitados"}
                    </li>
                    {features.map((f) => (
                      <li key={f} className="flex gap-2 items-center">
                        <Check className="h-4 w-4 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    disabled={saving === plan.id}
                    onClick={() => selectPlan(plan)}
                  >
                    {saving === plan.id ? "Ativando..." : `Começar com ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
