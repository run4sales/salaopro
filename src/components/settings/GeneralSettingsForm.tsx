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
        (supabase as any).from("settings").select("id, inactive_days_threshold, business_open_time, business_close_time").eq("establishment_id", establishmentId).maybeSingle(),
        supabase.from("profiles").select("accepting_bookings").eq("id", establishmentId).maybeSingle(),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      if (profileRes.error) throw profileRes.error;
      return {
        settings: settingsRes.data as { id: string; inactive_days_threshold: number; business_open_time: string | null; business_close_time: string | null } | null,
        accepting_bookings: (profileRes.data as any)?.accepting_bookings ?? true,
      };
    },
  });

  const [threshold, setThreshold] = useState<number>(20);
  const [openTime, setOpenTime] = useState<string>("08:00");
  const [closeTime, setCloseTime] = useState<string>("19:00");
  const [accepting, setAccepting] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings?.inactive_days_threshold != null) setThreshold(Number(data.settings.inactive_days_threshold));
    if (data?.settings?.business_open_time) setOpenTime(String(data.settings.business_open_time).slice(0, 5));
    if (data?.settings?.business_close_time) setCloseTime(String(data.settings.business_close_time).slice(0, 5));
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
      const payload = {
        inactive_days_threshold: threshold,
        business_open_time: openTime,
        business_close_time: closeTime,
      };
      if (data?.settings?.id) {
        const { error } = await (supabase as any)
          .from("settings")
          .update(payload)
          .eq("establishment_id", establishmentId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("settings")
          .insert({ establishment_id: establishmentId, ...payload });
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
          <h3 className="text-base font-semibold">Horário de funcionamento</h3>
          <p className="text-sm text-muted-foreground">
            Define o intervalo exibido na agenda. Horários fora desse intervalo ficam ocultos.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <div className="space-y-2">
            <Label>Abertura</Label>
            <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Fechamento</Label>
            <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} required />
          </div>
        </div>

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
