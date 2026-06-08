import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSubscription, type SubscriptionState } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

const BLOCKED_STATES = new Set<SubscriptionState>([
  "overdue",
  "overdue_partial",
  "overdue_blocked",
  "blocked",
  "no_subscription",
]);

// Rotas permitidas mesmo com a loja bloqueada
const ALLOWED_PATHS = ["/escolher-plano", "/checkout", "/planos"];

export function useStoreBlocked() {
  const { data } = useSubscription();
  if (!data) return false;
  const isActivePaid = data.status === "active" && !!data.plan_id;
  return !isActivePaid && BLOCKED_STATES.has(data.state);
}

export default function StoreBlockedGate() {
  const blocked = useStoreBlocked();
  const location = useLocation();
  const navigate = useNavigate();

  if (!blocked) return null;
  if (ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent className="border-destructive/40">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-center">Loja bloqueada</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Sua loja foi bloqueada porque não encontramos um pagamento ativo.
            Assine ou reative seu plano para continuar usando o sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={() => navigate("/escolher-plano")}>
            Ver planos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
