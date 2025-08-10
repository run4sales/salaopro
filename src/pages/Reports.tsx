import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { RevenueReport } from "@/components/reports/RevenueReport";
import { ServicesReport } from "@/components/reports/ServicesReport";

export default function Reports() {
  const { user, profile } = useAuth();

  // SEO
  useEffect(() => {
    document.title = "Relatórios | Salão PRO";
    const desc = "Relatórios de faturamento e serviços por período";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = window.location.href;
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  // Período padrão: últimos 30 dias
  const today = useMemo(() => new Date(), []);
  const startDefault = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; }, []);
  const endDefault = useMemo(() => { const d = new Date(); d.setHours(23,59,59,999); return d; }, []);

  const [startDate, setStartDate] = useState<Date>(startDefault);
  const [endDate, setEndDate] = useState<Date>(endDefault);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Acompanhe seu desempenho por período</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <section className="mb-6">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          />
        </section>

        <section className="rounded-md border bg-card p-4">
          <Tabs defaultValue="revenue">
            <TabsList>
              <TabsTrigger value="revenue">Faturamento</TabsTrigger>
              <TabsTrigger value="services">Serviços</TabsTrigger>
            </TabsList>
            <TabsContent value="revenue" className="mt-4">
              {profile?.id ? (
                <RevenueReport establishmentId={profile.id} startDate={startDate} endDate={endDate} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando perfil...</div>
              )}
            </TabsContent>
            <TabsContent value="services" className="mt-4">
              {profile?.id ? (
                <ServicesReport establishmentId={profile.id} startDate={startDate} endDate={endDate} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando perfil...</div>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}
