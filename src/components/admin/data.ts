import { supabase } from "@/integrations/supabase/client";

export type AdminPlan = {
  id: string;
  name: string;
  slug: string | null;
  monthly_price: number;
  active: boolean;
  display_order: number;
};

export type AdminProfile = {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_access_at: string | null;
  selected_plan_slug: string | null;
};

export type AdminSubscription = {
  id: string;
  establishment_id: string;
  status: string;
  plan_id: string | null;
  monthly_amount: number;
  started_at: string;
  trial_ends_at: string | null;
  next_billing_at: string | null;
  canceled_at: string | null;
  asaas_subscription_id: string | null;
  plan: { id: string; name: string; slug: string | null; monthly_price: number } | null;
};

export type AdminOverview = {
  profiles: AdminProfile[];
  subscriptions: AdminSubscription[];
  plans: AdminPlan[];
};

const normalizeOverview = (value: any): AdminOverview => ({
  profiles: (value?.profiles ?? []) as AdminProfile[],
  subscriptions: (value?.subscriptions ?? []).map((s: any) => ({
    ...s,
    monthly_amount: Number(s.monthly_amount || s.plan?.monthly_price || 0),
  })) as AdminSubscription[],
  plans: (value?.plans ?? []).map((p: any) => ({
    ...p,
    monthly_price: Number(p.monthly_price || 0),
    display_order: Number(p.display_order || 0),
  })) as AdminPlan[],
});

async function fetchAdminOverviewFallback(): Promise<AdminOverview> {
  const profilesWithPlan = await (supabase as any)
    .from("profiles")
    .select("id, business_name, owner_name, email, phone, created_at, last_access_at, selected_plan_slug")
    .order("created_at", { ascending: false });
  const profilesResult = profilesWithPlan.error
    ? await (supabase as any)
        .from("profiles")
        .select("id, business_name, owner_name, email, phone, created_at, last_access_at")
        .order("created_at", { ascending: false })
    : profilesWithPlan;

  const [{ data: subscriptions, error: subscriptionsError }, { data: plans, error: plansError }] = await Promise.all([
    (supabase as any)
      .from("subscriptions")
      .select("id, establishment_id, status, plan_id, monthly_amount, started_at, trial_ends_at, next_billing_at, canceled_at, asaas_subscription_id, subscription_plans(id, name, slug, monthly_price)"),
    (supabase as any)
      .from("subscription_plans")
      .select("id, name, slug, monthly_price, active, display_order")
      .order("display_order"),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (subscriptionsError) throw subscriptionsError;
  if (plansError) throw plansError;

  return normalizeOverview({
    profiles: (profilesResult.data ?? []).map((profile: any) => ({
      ...profile,
      selected_plan_slug: profile.selected_plan_slug ?? null,
    })),
    plans,
    subscriptions: (subscriptions ?? []).map((s: any) => ({
      ...s,
      plan: s.subscription_plans,
    })),
  });
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await (supabase as any).rpc("get_super_admin_overview");
  if (!error && data) return normalizeOverview(data);
  return fetchAdminOverviewFallback();
}
