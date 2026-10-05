import { Outlet, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import EmployeeSidebar from "@/components/EmployeeSidebar";
import EmployeeAttendances from "@/pages/EmployeeAttendances";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import TrialCountdownBanner from "@/components/TrialCountdownBanner";
import GraceCountdownBanner from "@/components/GraceCountdownBanner";
import StoreBlockedGate, { isStoreBlocked } from "@/components/StoreBlockedGate";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function AppLayout() {
  const location = useLocation();
  const { user, loading: authLoading, establishmentRole, profileError, retryProfile } = useAuth();
  const isOwner = establishmentRole === "owner";
  const managesEstablishment = isOwner || establishmentRole === "admin";
  const { data: sub, isLoading: subLoading } = useSubscription(managesEstablishment);

  // Gate: usuário precisa estar autenticado e com contexto de estabelecimento carregado.
  if (authLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando permissões...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (profileError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-md border bg-card p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-9 w-9 text-destructive" />
          <h1 className="font-semibold">Não foi possível carregar seu acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">{profileError}</p>
          <Button className="mt-5" onClick={() => void retryProfile()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  // Proprietários e gestores passam pelo gate de plano; funcionários operacionais não escolhem plano.
  // Nunca trate role null como owner, pois funcionários chegam com role async durante o login.
  const isEmployee = establishmentRole === "employee";
  const employeeAllowedRoutes = new Set(["/agenda", "/atendimentos", "/services", "/products", "/sales"]);
  const storeBlocked = isStoreBlocked(sub);

  if (isEmployee && !employeeAllowedRoutes.has(location.pathname)) {
    return <Navigate to="/agenda" replace />;
  }

  // Gate: dono precisa escolher plano se ainda não escolheu.
  // Se a loja já está bloqueada, o modal obrigatório deve prevalecer nas áreas internas.
  if (
    managesEstablishment &&
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
      <StoreBlockedGate />
      <GraceCountdownBanner />
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
          {isEmployee ? <EmployeeSidebar /> : <AppSidebar />}
          <main className="flex min-w-0 flex-1 flex-col">
            <SubscriptionBanner />
            <div className="min-w-0 flex-1">
              {isEmployee && location.pathname === "/atendimentos" ? <EmployeeAttendances /> : <Outlet />}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </>
  );
}
