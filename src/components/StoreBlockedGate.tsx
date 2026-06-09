import { useLocation, useNavigate } from "react-router-dom";
import { CreditCard, MessageCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { isFullyBlocked, useSubscription, type SubscriptionInfo } from "@/hooks/useSubscription";

// Rotas permitidas mesmo com a loja bloqueada
const ALLOWED_PATHS = ["/escolher-plano", "/checkout", "/planos"];
const SUPPORT_WHATSAPP_URL = "https://wa.me/5511917506368";

export function isStoreBlocked(subscription: SubscriptionInfo | null | undefined) {
  if (!subscription) return false;
  return isFullyBlocked(subscription.state);
}

export function useStoreBlocked() {
  const { data } = useSubscription();
  return isStoreBlocked(data);
}

export default function StoreBlockedGate() {
  const blocked = useStoreBlocked();
  const location = useLocation();
  const navigate = useNavigate();

  if (!blocked) return null;
  if (ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent className="max-w-md border-0 bg-card p-8 text-center shadow-2xl sm:rounded-3xl [&>button]:hidden">
        <AlertDialogHeader className="items-center space-y-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CreditCard className="h-8 w-8" />
          </div>
          <AlertDialogTitle className="text-center text-2xl font-bold leading-tight text-foreground">
            Ops! Algo deu errado com o seu pagamento.
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base leading-relaxed text-muted-foreground">
            O seu pagamento não foi identificado, e isso levou à suspensão temporária do seu acesso ao sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2 flex-col gap-3 sm:flex-col sm:space-x-0">
          <AlertDialogAction
            className="h-12 w-full rounded-full text-base font-semibold"
            onClick={() => navigate("/planos")}
          >
            Pagar boleto
          </AlertDialogAction>
          <Button
            type="button"
            variant="link"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => window.open(SUPPORT_WHATSAPP_URL, "_blank", "noopener,noreferrer")}
          >
            <MessageCircle className="h-4 w-4" />
            Conversar com o suporte
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
