import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SubscriptionState =
  | "no_subscription"
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "active_paid"
  | "payment_pending"
  | "overdue"
  | "grace_active"
  | "blocked"
  | "blocked_manual";

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
  created_at?: string | null;
  last_payment_at?: string | null;
  asaas_subscription_id?: string | null;
  manual_blocked_at?: string | null;
  payment_link?: string | null;
  grace_started_at?: string | null;
  grace_ends_at?: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
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

/** Estados em que a loja pode operar normalmente (criar/editar/usar) */
export function canCreateAppointments(state?: SubscriptionState) {
  if (!state) return true;
  return ["trial_active", "trial_expiring", "active_paid", "payment_pending", "grace_active"].includes(state);
}

export function canCreateClients(state?: SubscriptionState) {
  return canCreateAppointments(state);
}

/** Loja totalmente bloqueada (não pode usar nada) */
export function isFullyBlocked(state?: SubscriptionState) {
  return ["blocked", "blocked_manual", "no_subscription", "trial_expired", "overdue"].includes(
    state ?? "no_subscription"
  );
}

/** Loja em estado bloqueado em que ainda pode pedir liberação de 48h */
export function canRequestGrace(state?: SubscriptionState) {
  return state === "trial_expired" || state === "overdue";
}

/** Bloqueio definitivo, sem possibilidade de liberação */
export function isHardBlocked(state?: SubscriptionState) {
  return state === "blocked" || state === "blocked_manual";
}

export async function requestGraceUnlock() {
  const { data, error } = await (supabase as any).rpc("request_grace_unlock");
  if (error) throw error;
  return data as { ok: boolean; grace_started_at: string; grace_ends_at: string };
}
