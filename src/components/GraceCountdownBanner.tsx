import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

function getHoursLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { hours, minutes };
}

export default function GraceCountdownBanner() {
  const { data } = useSubscription();
  const [left, setLeft] = useState<ReturnType<typeof getHoursLeft>>(null);

  const active = data?.state === "grace_active" && data?.grace_ends_at;

  useEffect(() => {
    if (!active || !data?.grace_ends_at) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(getHoursLeft(data.grace_ends_at!));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [active, data?.grace_ends_at]);

  if (!active || !left) return null;

  return (
    <div className="sticky top-0 z-[65] w-full bg-destructive text-destructive-foreground shadow-md">
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2.5 text-sm">
        <Clock className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold">
            Faltam <strong>{left.hours}h{String(left.minutes).padStart(2, "0")}m</strong> para o bloqueio do sistema.
          </span>
        </div>
        <Button asChild size="sm" variant="secondary" className="shrink-0">
          <Link to="/planos">Realizar pagamento</Link>
        </Button>
      </div>
    </div>
  );
}
