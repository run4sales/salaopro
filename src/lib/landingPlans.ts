export type LandingPlan = {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  max_clients: number | null;
  max_users: number | null;
  features: unknown;
};

// Public reads are unavailable under current RLS. Verified from official records
// on 2026-10-10; update this snapshot when commercial plans change.
export const VERIFIED_PUBLIC_PLANS: LandingPlan[] = [
  { id: 'individual', slug: 'individual', name: 'Individual', monthly_price: 29.90, max_clients: 300, max_users: 1, features: ['Agenda inteligente', 'Comissões automáticas', 'Relatórios completos'] },
  { id: 'profissional', slug: 'profissional', name: 'Profissional', monthly_price: 69.90, max_clients: null, max_users: 4, features: ['Agenda inteligente', 'Comissões automáticas', 'Relatórios avançados'] },
  { id: 'empresa', slug: 'empresa', name: 'Empresa', monthly_price: 109.90, max_clients: null, max_users: 20, features: ['Agenda inteligente', 'Comissões automáticas', 'Relatórios avançados', 'Suporte prioritário'] },
];

// Auth currently supports these identifiers; never silently preselect another plan.
export function landingSignupUrl(slug?: string) {
  return slug && ['individual', 'profissional', 'empresa'].includes(slug)
    ? `/auth?tab=signup&plan=${encodeURIComponent(slug)}`
    : '/auth?tab=signup';
}

export function supportedLandingPlans(plans: LandingPlan[]) {
  return plans.filter(plan => ['individual', 'profissional', 'empresa'].includes(plan.slug));
}