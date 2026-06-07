import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

const EXPIRED_STATES = new Set([
  "overdue",
  "overdue_partial",
  "overdue_blocked",
  "blocked",
  "no_subscription",
]);

export default function TrialExpiredBanner() {
  const { data } = useSubscription();
  const { establishmentRole } = useAuth();

  const isOwner = establishmentRole === "owner" || establishmentRole === null;
  if (!isOwner || !data) return null;

  // Considera trial expirado / inadimplente quando não há assinatura ativa
  const isActivePaid = data.status === "active" && !!data.plan_id;
  const shouldShow = !isActivePaid && EXPIRED_STATES.has(data.state);
  if (!shouldShow) return null;

  return (
    <div className="sticky top-0 z-[70] w-full bg-destructive text-destructive-foreground border-b border-destructive shadow-md">
      <div className="flex flex-col sm:flex-row items-center gap-3 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            Seu teste acabou, escolha um plano para continuar
          </span>
        </div>
        <Button asChild size="sm" variant="secondary" className="shrink-0">
          <Link to="/escolher-plano">Escolher plano</Link>
        </Button>
      </div>
    </div>
  );
}
