import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanceMetrics } from "@/components/metrics/FinanceMetrics";
import { ClientMetrics } from "@/components/metrics/ClientMetrics";
import { OperationMetrics } from "@/components/metrics/OperationMetrics";
import { InsightsMetrics } from "@/components/metrics/InsightsMetrics";

export default function Metrics() {
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Métricas | Salão PRO";
    const desc = "Métricas financeiras, clientes, operação e insights";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = window.location.href;
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  // Período padrão: mês corrente
  const startDefault = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }, []);
  const endDefault = useMemo(() => { const d = new Date(); d.setHours(23,59,59,999); return d; }, []);

  const [startDate, setStartDate] = useState<Date>(startDefault);
  const [endDate, setEndDate] = useState<Date>(endDefault);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Métricas</h1>
          <p className="text-muted-foreground">Acompanhe indicadores-chave por período</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

        <div className="rounded-md border bg-card p-4">
          <Tabs defaultValue="finance">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="finance">Financeiros</TabsTrigger>
              <TabsTrigger value="clients">Clientes</TabsTrigger>
              <TabsTrigger value="ops">Operação</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>
            <TabsContent value="finance" className="mt-4">
              {profile?.id ? (
                <FinanceMetrics establishmentId={profile.id} startDate={startDate} endDate={endDate} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              )}
            </TabsContent>
            <TabsContent value="clients" className="mt-4">
              {profile?.id ? (
                <ClientMetrics establishmentId={profile.id} startDate={startDate} endDate={endDate} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              )}
            </TabsContent>
            <TabsContent value="ops" className="mt-4">
              {profile?.id ? (
                <OperationMetrics establishmentId={profile.id} startDate={startDate} endDate={endDate} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              )}
            </TabsContent>
            <TabsContent value="insights" className="mt-4">
              {profile?.id ? (
                <InsightsMetrics establishmentId={profile.id} startDate={startDate} endDate={endDate} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
