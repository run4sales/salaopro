export type LandingPlan = {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  max_clients: number | null;
  max_users: number | null;
  features: unknown;
};

// Auth currently supports these identifiers; never silently preselect another plan.
export function landingSignupUrl(slug?: string) {
  return slug && ['individual', 'profissional', 'empresa'].includes(slug)
    ? `/auth?tab=signup&plan=${encodeURIComponent(slug)}`
    : '/auth?tab=signup';
}

export function supportedLandingPlans(plans: LandingPlan[]) {
  return plans.filter(plan => ['individual', 'profissional', 'empresa'].includes(plan.slug));
}