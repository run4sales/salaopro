import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logAdminAction } from "../shared";

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

async function getFunctionErrorMessage(error: unknown) {
  if (!error) return "Erro desconhecido ao chamar a função do Agendor.";

  const context = (error as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } }).context;
  if (context?.json) {
    try {
      const payload = await context.json() as { error?: string; message?: string };
      if (payload?.error || payload?.message) return payload.error ?? payload.message!;
    } catch {
      // Fall through to text/message fallback.
    }
  }

  if (context?.text) {
    try {
      const text = await context.text();
      if (text) return text;
    } catch {
      // Fall through to Error.message fallback.
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return "Erro desconhecido ao chamar a função do Agendor.";
}

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
      const message = await getFunctionErrorMessage(error);
      toast.error(`Não foi possível sincronizar com o Agendor: ${message}`);
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
