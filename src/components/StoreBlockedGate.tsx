import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, MessageCircle, Clock, Loader2 } from "lucide-react";
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
import { toast } from "@/components/ui/use-toast";
import {
  isFullyBlocked,
  canRequestGrace,
  isHardBlocked,
  requestGraceUnlock,
  useSubscription,
  type SubscriptionInfo,
} from "@/hooks/useSubscription";

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
  const { data } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const blocked = isStoreBlocked(data);
  if (!blocked) return null;
  if (ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  const state = data?.state;
  const canGrace = canRequestGrace(state);
  const hard = isHardBlocked(state);

  const handleGrace = async () => {
    setLoading(true);
    try {
      await requestGraceUnlock();
      toast({ title: "Acesso liberado por 48h", description: "Realize o pagamento antes do prazo para evitar o bloqueio." });
      await qc.invalidateQueries({ queryKey: ["my-subscription"] });
    } catch (e: any) {
      toast({ title: "Não foi possível liberar", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const title = hard
    ? "Ops! Algo deu errado com o seu pagamento."
    : state === "trial_expired"
    ? "Seu período de teste acabou."
    : "Seu pagamento está vencido.";

  const description = hard
    ? "O seu pagamento não foi identificado, e isso levou à suspensão temporária do seu acesso ao sistema."
    : state === "trial_expired"
    ? "Para continuar usando, contrate um plano agora ou libere o acesso por mais 48 horas."
    : "Para evitar o bloqueio total, realize o pagamento ou libere o acesso por mais 48 horas.";

  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent className="max-w-md border-0 bg-card p-8 text-center shadow-2xl sm:rounded-3xl [&>button]:hidden">
        <AlertDialogHeader className="items-center space-y-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CreditCard className="h-8 w-8" />
          </div>
          <AlertDialogTitle className="text-center text-2xl font-bold leading-tight text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base leading-relaxed text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2 flex-col gap-3 sm:flex-col sm:space-x-0">
          <AlertDialogAction
            className="h-12 w-full rounded-full text-base font-semibold"
            onClick={() => navigate("/planos")}
          >
            Realizar pagamento
          </AlertDialogAction>

          {canGrace && (
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-full text-base font-semibold gap-2"
              onClick={handleGrace}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Liberar acesso por 48h
            </Button>
          )}

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
