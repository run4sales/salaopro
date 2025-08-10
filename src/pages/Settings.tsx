import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export default function Settings() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Configurações | Salão PRO";
    const desc = "Configurações do estabelecimento";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Ajustes gerais do sistema</p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-10">
        <div className="rounded-md border p-6 bg-card">
          Em breve: preferências, usuários e integrações.
        </div>
      </main>
    </div>
  );
}
