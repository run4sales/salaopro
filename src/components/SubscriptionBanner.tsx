import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

import { subscriptionAccessNotice } from "@/lib/subscriptionBilling";

export default function SubscriptionBanner() {
  const { data } = useSubscription();
  if (!data) return null;

  const { state } = data;
  if (["trial_active", "trial_expiring", "trial_expired", "blocked_manual", "no_subscription"].includes(state)) return null;
  const notice = subscriptionAccessNotice(data);
  if (!notice) return null;
  const tones = {
    upcoming: "bg-billing-upcoming text-billing-foreground border-billing-upcoming",
    due: "bg-billing-due text-billing-foreground border-billing-due",
    late: "bg-destructive text-destructive-foreground border-destructive",
  };

  return (
    <div role="status" className={`w-full border-b ${tones[notice.tone]}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">
          {notice.message}
        </span>
        <Button asChild size="sm" variant="secondary" className="shrink-0">
          <Link to="/planos">{data.manual_access_due_date ? "Ver assinatura" : "Pagar agora"}</Link>
        </Button>
      </div>
    </div>
  );
}
