import { Link } from "react-router-dom";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, daysBetween } from "@/hooks/useSubscription";

export default function SubscriptionBanner() {
  const { data } = useSubscription();
  if (!data) return null;

  const { state, next_billing_at } = data;
  const billingLeft = daysBetween(next_billing_at);

  // Apenas estados intermediários (não bloqueio nem grace, que têm UI dedicada)
  if (state !== "payment_pending") return null;

  return (
    <div className="w-full border-b bg-warning/15 text-warning border-warning/40">
      <div className="flex items-center gap-3 px-4 py-2 text-sm">
        <Clock className="h-4 w-4" />
        <span className="flex-1">
          Seu plano vence em {billingLeft ?? 0} dia(s). Evite o bloqueio realizando o pagamento.
        </span>
        <Button asChild size="sm">
          <Link to="/planos">Pagar agora</Link>
        </Button>
      </div>
    </div>
  );
}
