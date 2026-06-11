import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Banknote,
  TrendingUp,
  ShieldAlert,
  Settings as SettingsIcon,
  RefreshCw,
} from "lucide-react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminCompanies from "@/components/admin/AdminCompanies";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";
import AdminSaaSFinance from "@/components/admin/AdminSaaSFinance";
import AdminControl from "@/components/admin/AdminControl";
import AdminPlans from "@/components/admin/AdminPlans";
import AdminMetrics from "@/components/admin/AdminMetrics";
import AdminAgendorSync from "@/components/admin/agendor/SyncPanel";

type Tab = "dashboard" | "companies" | "subscriptions" | "finance" | "metrics" | "control" | "plans" | "agendor";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard Geral", icon: LayoutDashboard },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "subscriptions", label: "Assinaturas", icon: CreditCard },
  { id: "finance", label: "Financeiro SaaS", icon: Banknote },
  { id: "metrics", label: "Métricas", icon: TrendingUp },
  { id: "control", label: "Controle", icon: ShieldAlert },
  { id: "plans", label: "Planos", icon: SettingsIcon },
  { id: "agendor", label: "Agendor", icon: RefreshCw },
];

export default function SuperAdmin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    document.title = "Painel Super Admin | Beauty Core";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !loading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });

  if (loading || isLoading) {
    return (
      <main className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </main>
    );
  }

  const isSuperAdmin = roles?.includes("super_admin");


  if (!isSuperAdmin) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Esta área é exclusiva para Super Admin.
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Painel Super Admin</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Controle total da plataforma Beauty Core — empresas, assinaturas e receita.
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-primary text-primary-glow"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "dashboard" && <AdminDashboard />}
      {tab === "companies" && <AdminCompanies />}
      {tab === "subscriptions" && <AdminSubscriptions />}
      {tab === "finance" && <AdminSaaSFinance />}
      {tab === "metrics" && <AdminMetrics />}
      {tab === "control" && <AdminControl />}
      {tab === "plans" && <AdminPlans />}
      {tab === "agendor" && <AdminAgendorSync />}
    </main>
  );
}
