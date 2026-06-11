import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logAdminAction } from "./shared";

type SyncResult = {
  status?: string;
  error?: string;
};

type SyncResponse = {
  synced?: number;
  failed?: number;
  skipped?: number;
  message?: string;
  results?: SyncResult[];
};

export default function AdminAgendorSync() {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  async function syncExistingCompaniesToAgendor() {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("agendor-sync-all-companies", {
        body: { force: false },
      });

      if (error) throw error;

      const response = (data ?? {}) as SyncResponse;
      const synced = Number(response.synced ?? 0);
      const failed = Number(response.failed ?? 0);
      const skipped = Number(response.skipped ?? 0);
      const firstFailure = response.results?.find((result) => result.status === "failed");

      if (failed > 0) {
        toast.warning(
          `Agendor: ${synced} sincronizadas, ${failed} com erro e ${skipped} ignoradas.${
            firstFailure?.error ? ` Primeiro erro: ${firstFailure.error}` : ""
          }`,
        );
      } else if (synced === 0) {
        toast.info(response.message ?? "Nenhuma empresa pendente para sincronizar com o Agendor.");
      } else {
        toast.success(response.message ?? `${synced} empresa(s) sincronizada(s) com o Agendor.`);
      }

      if (user?.id) {
        await logAdminAction(user.id, "agendor_sync_existing_companies_clicked", undefined, {
          synced,
          failed,
          skipped,
        });
      }
    } catch (error) {
      console.error("agendor-sync-all-companies invoke error", error);
      toast.error("Não foi possível sincronizar com o Agendor.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Card className="bg-card/60 border-border/60">
      <CardHeader>
        <CardTitle>Sincronização Agendor</CardTitle>
        <CardDescription>
          Envia para o Agendor todas as empresas cadastradas que ainda não possuem negócio sincronizado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={syncExistingCompaniesToAgendor} disabled={isSyncing}>
          <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Sincronizando..." : "Sincronizar empresas no Agendor"}
        </Button>
      </CardContent>
    </Card>
  );
}
