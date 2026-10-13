import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';

export type AuthorizationAction = 'grant' | 'paid' | 'trial' | 'pending' | 'block' | 'cancel' | 'automatic' | 'plan';

export async function setSubscriptionAuthorization(input: {
  establishmentId: string;
  action: AuthorizationAction;
  dueDate?: string;
  amount?: number;
  paymentDate?: string;
  requestId?: string;
  planId?: string;
}) {
  const { data, error } = await supabase.rpc('admin_set_subscription_authorization', {
    p_establishment: input.establishmentId,
    p_action: input.action,
    p_due_date: input.dueDate || undefined,
    p_amount: input.amount,
    p_payment_date: input.paymentDate || undefined,
    p_request_id: input.requestId,
    p_plan_id: input.planId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function refreshSubscriptionQueries(client: QueryClient) {
  await Promise.all([
    'admin-companies', 'admin-subs', 'admin-subscriptions-full', 'admin-metrics-with-potential',
    'admin-finance-subs', 'admin-logs', 'saas-invoices', 'admin-saas-invoices',
    'my-subscription', 'subscription-overview', 'subscription-invoices',
  ].map(key => client.invalidateQueries({ queryKey: [key] })));
}