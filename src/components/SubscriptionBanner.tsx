import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, daysBetween } from "@/hooks/useSubscription";

export default function SubscriptionBanner() {
  const { data } = useSubscription();
  if (!data) return null;

  const { state, trial_ends_at, next_billing_at } = data;
  const trialLeft = daysBetween(trial_ends_at);
  const billingLeft = daysBetween(next_billing_at);

  let tone: "warn" | "danger" | "danger-strong" | null = null;
  let icon = <Clock className="h-4 w-4" />;
  let message = "";
  let cta = "Contratar plano";

  if (state === "trial_expiring") {
    tone = "danger";
    icon = <Sparkles className="h-4 w-4" />;
    message = `Seu teste grátis termina em ${trialLeft ?? 0} dia(s). Evite interrupções no sistema.`;
  } else if (state === "payment_pending") {
    tone = "warn";
    message = `Seu plano vence em ${billingLeft ?? 0} dia(s). Evite bloqueio do sistema realizando o pagamento.`;
    cta = "Pagar agora";
  } else if (state === "overdue") {
    tone = "danger";
    icon = <AlertTriangle className="h-4 w-4" />;
    message = "Seu plano está vencido. Regularize para continuar usando o sistema.";
    cta = "Pagar agora";
  } else if (state === "overdue_partial") {
    tone = "danger-strong";
    icon = <AlertTriangle className="h-4 w-4" />;
    message = "Pagamento em atraso. Novos agendamentos e clientes estão bloqueados.";
    cta = "Regularizar";
  } else if (state === "overdue_blocked" || state === "blocked") {
    tone = "danger-strong";
    icon = <AlertTriangle className="h-4 w-4" />;
    message = "Acesso bloqueado por inadimplência. Realize o pagamento para reativar.";
    cta = "Pagar agora";
  }

  if (!tone) return null;

  const toneClass =
    tone === "warn"
      ? "bg-warning/15 text-warning border-warning/40"
      : tone === "danger"
      ? "bg-destructive/15 text-destructive border-destructive/40"
      : "bg-destructive text-destructive-foreground border-destructive";

  return (
    <div className={`w-full border-b ${toneClass}`}>
      <div className="flex items-center gap-3 px-4 py-2 text-sm">
        {icon}
        <span className="flex-1">{message}</span>
        <Button asChild size="sm" variant={tone === "danger-strong" ? "secondary" : "default"}>
          <Link to="/checkout">{cta}</Link>
        </Button>
      </div>
    </div>
  );
}
