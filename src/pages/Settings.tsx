import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { GeneralSettingsForm } from "@/components/settings/GeneralSettingsForm";

export default function Settings() {
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Configurações | Salão PRO";
    const desc = "Configurações do estabelecimento e preferências";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = window.location.href;
  }, []);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie dados do salão e preferências</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="rounded-md border bg-card p-4">
          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="general">Preferências</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4">
              {profile ? (
                <ProfileForm profile={profile} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando perfil...</div>
              )}
            </TabsContent>

            <TabsContent value="general" className="mt-4">
              {profile ? (
                <GeneralSettingsForm establishmentId={profile.id} />
              ) : (
                <div className="text-sm text-muted-foreground">Carregando preferências...</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
