import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

function getRemaining(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

export default function TrialCountdownBanner() {
  const { data } = useSubscription();
  const { establishmentRole } = useAuth();
  const [closed, setClosed] = useState(false);
  const [remaining, setRemaining] = useState<ReturnType<typeof getRemaining>>(null);

  const isOwner = establishmentRole === "owner" || establishmentRole === null;
  const trialEndsAt = data?.trial_ends_at;
  const inActiveTrial =
    data?.status === "trial" &&
    (data.state === "trial_active" || data.state === "trial_expiring");

  useEffect(() => {
    if (!inActiveTrial || !trialEndsAt) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(getRemaining(trialEndsAt));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [inActiveTrial, trialEndsAt]);

  if (!isOwner || !inActiveTrial || closed || !remaining) return null;

  const dayPart = remaining.days > 0 ? `${remaining.days} dia${remaining.days === 1 ? "" : "s"} e ` : "";
  const hourPart = `${remaining.hours} hora${remaining.hours === 1 ? "" : "s"}`;

  return (
    <div className="sticky top-0 z-[60] w-full bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2.5 text-sm">
        <Sparkles className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium">
            Seu teste termina em <strong>{dayPart}{hourPart}</strong>.
          </span>
        </div>
        <Button asChild size="sm" variant="secondary" className="shrink-0">
          <Link to="/planos">Contratar plano</Link>
        </Button>
        <button
          onClick={() => setClosed(true)}
          aria-label="Fechar"
          className="shrink-0 rounded-md p-1 hover:bg-primary-foreground/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
