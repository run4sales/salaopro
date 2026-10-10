import { billingDaysLeft } from './subscriptionBilling.ts';

type AdministrativeSubscription = {
  status: string;
  trial_ends_at?: string | null;
  created_at?: string | null;
  manual_blocked_at?: string | null;
  next_billing_at?: string | null;
  current_invoice_due_date?: string | null;
};

/** Reporting only: never use this classification to grant access or cancel billing. */
export function adminSubscriptionStatus(
  subscription: AdministrativeSubscription,
  state: string,
  now = new Date(),
): string {
  if (subscription.status === 'canceled') return 'canceled';
  let blockedDays: number | null = null;
  if (state === 'blocked_manual') {
    const days = billingDaysLeft(subscription.manual_blocked_at, now);
    blockedDays = days === null ? null : -days;
  } else if (state === 'trial_expired') {
    const days = billingDaysLeft(subscription.trial_ends_at, now);
    blockedDays = days === null ? null : -days;
  } else if (state === 'overdue' || state === 'blocked') {
    const days = billingDaysLeft(subscription.current_invoice_due_date ?? subscription.next_billing_at, now);
    blockedDays = days === null ? null : -days - 3;
  }
  return blockedDays !== null && blockedDays > 10 ? 'canceled' : state;
}