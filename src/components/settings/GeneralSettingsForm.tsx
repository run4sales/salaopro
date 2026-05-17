import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface GeneralSettingsFormProps {
  establishmentId: string;
}

export function GeneralSettingsForm({ establishmentId }: GeneralSettingsFormProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["settings", establishmentId],
    queryFn: async () => {
      const [settingsRes, profileRes] = await Promise.all([
        supabase.from("settings").select("id, inactive_days_threshold").eq("establishment_id", establishmentId).maybeSingle(),
        supabase.from("profiles").select("accepting_bookings").eq("id", establishmentId).maybeSingle(),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      if (profileRes.error) throw profileRes.error;
      return {
        settings: settingsRes.data as { id: string; inactive_days_threshold: number } | null,
        accepting_bookings: (profileRes.data as any)?.accepting_bookings ?? true,
      };
    },
  });

  const [threshold, setThreshold] = useState<number>(20);
  const [accepting, setAccepting] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings?.inactive_days_threshold != null) setThreshold(Number(data.settings.inactive_days_threshold));
    if (data) setAccepting(data.accepting_bookings);
  }, [data]);

  const toggleAccepting = async (next: boolean) => {
    setAccepting(next);
    const { error } = await supabase.from("profiles").update({ accepting_bookings: next } as any).eq("id", establishmentId);
    if (error) {
      toast.error("Não foi possível atualizar.");
      setAccepting(!next);
      return;
    }
    toast.success(next ? "Agendamentos ativados" : "Agendamentos pausados");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (data?.settings?.id) {
        const { error } = await supabase
          .from("settings")
          .update({ inactive_days_threshold: threshold })
          .eq("establishment_id", establishmentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("settings")
          .insert({ establishment_id: establishmentId, inactive_days_threshold: threshold });
        if (error) throw error;
      }
      toast.success("Preferências salvas!");
      await refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível salvar as preferências.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <h3 className="text-base font-semibold">Aceitar agendamentos online</h3>
          <p className="text-sm text-muted-foreground">
            Quando desligado, o link público continua acessível mas exibe aviso de indisponibilidade.
          </p>
        </div>
        <Switch checked={accepting} onCheckedChange={toggleAccepting} disabled={isLoading} />
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <h3 className="text-base font-semibold">Clientes inativos</h3>
          <p className="text-sm text-muted-foreground">
            Número de dias sem retorno para considerar um cliente como inativo.
          </p>
        </div>

        <div className="max-w-xs space-y-2">
          <Label>Dias de inatividade</Label>
          <Input
            type="number"
            min={1}
            value={isLoading ? "" : threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            required
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" className="min-w-40" disabled={saving}>
            {saving ? "Salvando..." : "Salvar preferências"}
          </Button>
        </div>
      </form>
    </div>
  );
}
