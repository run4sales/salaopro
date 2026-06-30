import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import StableAgendaContent from "@/components/agenda/StableAgendaContent";
import EmployeeAgendaContent from "@/components/agenda/EmployeeAgendaContent";

export default function StableAgenda() {
  const { user, establishmentRole } = useAuth();

  useEffect(() => {
    document.title = "Agenda | Beauty Core";
    const desc = "Agenda de atendimentos do salão";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">Gerencie seus agendamentos</p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-10 space-y-6">
        {establishmentRole === "employee" ? <EmployeeAgendaContent /> : <StableAgendaContent />}
      </main>
    </div>
  );
}
