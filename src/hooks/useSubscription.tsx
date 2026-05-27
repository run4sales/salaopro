import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SubscriptionState =
  | "no_subscription"
  | "trial_active"
  | "trial_expiring"
  | "active_paid"
  | "payment_pending"
  | "overdue"
  | "overdue_partial"
  | "overdue_blocked"
  | "blocked";

export interface SubscriptionInfo {
  establishment_id: string;
  state: SubscriptionState;
  status: string;
  plan_id: string | null;
  plan: {
    id: string;
    slug: string;
    name: string;
    monthly_price: number;
    max_clients: number | null;
    max_users: number | null;
  } | null;
  trial_ends_at: string | null;
  next_billing_at: string | null;
  monthly_amount: number;
}

export function useSubscription() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_subscription");
      if (error) throw error;
      return data as SubscriptionInfo | null;
    },
  });
}

export function daysBetween(target: string | null | undefined): number | null {
  if (!target) return null;
  return Math.ceil((new Date(target).getTime() - Date.now()) / 86_400_000);
}

export function canCreateAppointments(state?: SubscriptionState) {
  if (!state) return true;
  return !["overdue_partial", "overdue_blocked", "blocked", "no_subscription"].includes(state);
}

export function canCreateClients(state?: SubscriptionState) {
  return canCreateAppointments(state);
}

export function isFullyBlocked(state?: SubscriptionState) {
  return state === "overdue_blocked" || state === "blocked";
}
