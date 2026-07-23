import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodFilter, PeriodPreset, applyPreset } from "@/components/reports/PeriodFilter";
import { RevenueGeneralReport } from "@/components/reports/RevenueGeneralReport";
import { ProfessionalServicesReport } from "@/components/reports/ProfessionalServicesReport";
import { CommissionsReport } from "@/components/reports/CommissionsReport";
import { ExpensesReport } from "@/components/reports/ExpensesReport";
import { CashFlowReport } from "@/components/reports/CashFlowReport";
import { FinancialStrategyReport } from "@/components/reports/FinancialStrategyReport";
import { DollarSign, Users, Wallet, TrendingDown, Banknote, BarChart3 } from "lucide-react";

export default function Reports() {
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Relatórios | Beauty Core";
    const desc = "Relatórios de faturamento, profissionais, comissões e despesas";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = window.location.href;
  }, []);

  const initial = applyPreset("30");
  const [startDate, setStartDate] = useState<Date>(initial.start);
  const [endDate, setEndDate] = useState<Date>(initial.end);
  const [preset, setPreset] = useState<PeriodPreset>("30");

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Inteligência de negócio para decisões mais rápidas</p>
          </div>
          <PeriodFilter
            startDate={startDate}
            endDate={endDate}
            preset={preset}
            onChange={(s, e, p) => { setStartDate(s); setEndDate(e); setPreset(p); }}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="strategic" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="strategic" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Dashboard financeiro
            </TabsTrigger>
            <TabsTrigger value="revenue" className="gap-2">
              <DollarSign className="h-4 w-4" /> Faturamento geral
            </TabsTrigger>
            <TabsTrigger value="pro" className="gap-2">
              <Users className="h-4 w-4" /> Por profissional
            </TabsTrigger>
            <TabsTrigger value="commissions" className="gap-2">
              <Wallet className="h-4 w-4" /> Comissões
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <TrendingDown className="h-4 w-4" /> Despesas
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="gap-2">
              <Banknote className="h-4 w-4" /> Fluxo de caixa
            </TabsTrigger>
          </TabsList>

          {profile?.id ? (
            <>
              <TabsContent value="strategic"><FinancialStrategyReport establishmentId={profile.id} startDate={startDate} endDate={endDate} /></TabsContent>
              <TabsContent value="revenue"><RevenueGeneralReport establishmentId={profile.id} startDate={startDate} endDate={endDate} /></TabsContent>
              <TabsContent value="pro"><ProfessionalServicesReport establishmentId={profile.id} startDate={startDate} endDate={endDate} /></TabsContent>
              <TabsContent value="commissions"><CommissionsReport establishmentId={profile.id} startDate={startDate} endDate={endDate} /></TabsContent>
              <TabsContent value="expenses"><ExpensesReport establishmentId={profile.id} startDate={startDate} endDate={endDate} /></TabsContent>
              <TabsContent value="cashflow"><CashFlowReport establishmentId={profile.id} startDate={startDate} endDate={endDate} /></TabsContent>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Carregando perfil…</div>
          )}
        </Tabs>
      </main>
    </div>
  );
}
