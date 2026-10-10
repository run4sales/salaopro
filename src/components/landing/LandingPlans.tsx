import { useQuery } from '@tanstack/react-query';
import { Check, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { landingSignupUrl, supportedLandingPlans, VERIFIED_PUBLIC_PLANS, type LandingPlan } from '@/lib/landingPlans';

export default function LandingPlans() {
  const plans = useQuery({
    queryKey: ['landing-public-plans'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('subscription_plans')
        .select('id, slug, name, monthly_price, max_clients, max_users, features')
        .eq('active', true).order('display_order');
      if (error) throw error;
      return supportedLandingPlans((data ?? []) as LandingPlan[]);
    },
  });
  const displayedPlans = plans.data?.length ? plans.data : VERIFIED_PUBLIC_PLANS;

  return <section id="planos" className="landing-section scroll-mt-24">
    <div className="landing-container">
      <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="landing-eyebrow">Planos para a sua rotina</p><h2 className="landing-heading">Seu próximo passo.<br />No tamanho do seu negócio.</h2></div>
        <p className="max-w-sm text-muted-foreground">Teste por 10 dias corridos, sem cartão de crédito. Escolha o plano e conheça o sistema na prática.</p>
      </div>
      {plans.isPending ? <div role="status" className="grid gap-5 md:grid-cols-3">{[1, 2, 3].map(n => <div key={n} className="h-80 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}<span className="sr-only">Carregando planos</span></div>
        : <div className="grid gap-5 md:grid-cols-3">{displayedPlans.map(plan => {
          const features = Array.isArray(plan.features) ? plan.features.filter((feature): feature is string => typeof feature === 'string') : [];
          return <article key={plan.id} className="flex flex-col rounded-lg border bg-card p-6 lg:p-8">
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <p className="mt-5 text-3xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.monthly_price)}<span className="ml-1 text-sm font-normal text-muted-foreground">/mês</span></p>
            <p className="mb-6 mt-2 text-sm text-muted-foreground">Assinatura da plataforma</p>
            <ul className="mb-8 space-y-3 text-sm">
              {[plan.max_clients === null ? 'Clientes ilimitados' : `Até ${plan.max_clients} clientes`, plan.max_users === null ? 'Usuários ilimitados' : `Até ${plan.max_users} ${plan.max_users === 1 ? 'usuário' : 'usuários'}`, ...features].map((feature, i) => <li key={`${i}-${feature}`} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}
            </ul>
            <Button className="mt-auto w-full" asChild><a href={landingSignupUrl(plan.slug)} aria-label={`Começar 10 dias grátis com ${plan.name}`}>Começar 10 dias grátis<ArrowRight className="ml-2 h-4 w-4" /></a></Button>
          </article>;
        })}</div>}
      <p className="mt-5 text-sm text-muted-foreground">Depois do teste, contrate um plano para continuar usando a Beauty Core. A cobrança e a assinatura ficam disponíveis na sua conta.</p>
      {!plans.isPending && !plans.data?.length && <p className="mt-2 text-xs text-muted-foreground">Valores oficiais conferidos em 10/10/2026. Confirme as condições na contratação.{plans.isError && <Button variant="link" size="sm" onClick={() => plans.refetch()} disabled={plans.isFetching}><RefreshCw className="mr-1 h-3 w-3" />Atualizar consulta</Button>}</p>}
    </div>
  </section>;
}