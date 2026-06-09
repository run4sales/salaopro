import { Outlet, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import TrialCountdownBanner from "@/components/TrialCountdownBanner";
import TrialExpiredBanner from "@/components/TrialExpiredBanner";
import StoreBlockedGate, { isStoreBlocked } from "@/components/StoreBlockedGate";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppLayout() {
  const location = useLocation();
  const { user, loading: authLoading, establishmentRole } = useAuth();
  const { data: sub, isLoading: subLoading } = useSubscription();

  // Gate: usuário precisa estar autenticado
  if (!authLoading && !user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Apenas owners passam pelo gate de plano (funcionários do estabelecimento não escolhem plano)
  const isOwner = establishmentRole === "owner" || establishmentRole === null;
  const storeBlocked = isStoreBlocked(sub);

  // Gate: dono precisa escolher plano se ainda não escolheu.
  // Se a loja já está bloqueada, o modal obrigatório deve prevalecer nas áreas internas.
  if (
    isOwner &&
    !storeBlocked &&
    !subLoading &&
    sub &&
    !sub.plan_id &&
    location.pathname !== "/escolher-plano" &&
    location.pathname !== "/checkout" &&
    location.pathname !== "/planos"
  ) {
    return <Navigate to="/escolher-plano" replace />;
  }

  return (
    <>
      <StoreBlockedGate subscription={sub} />
      <TrialExpiredBanner />
      <TrialCountdownBanner />
      <SidebarProvider className="flex-col md:flex-row">
        <header className="h-12 flex items-center border-b border-border bg-background md:hidden">
          <SidebarTrigger className="ml-2 text-foreground" />
          <span className="ml-2 text-sm font-bold tracking-tight">
            Beauty<span className="bg-gradient-to-r from-primary-glow to-accent bg-clip-text text-transparent">Core</span>
          </span>
          <ThemeToggle className="ml-auto mr-2" showLabel={false} />
        </header>

        <div className="flex min-h-[calc(100svh-3rem)] w-full min-w-0 bg-background text-foreground md:min-h-svh">
          <AppSidebar />
          <main className="flex min-w-0 flex-1 flex-col">
            <SubscriptionBanner />
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </>
  );
}
