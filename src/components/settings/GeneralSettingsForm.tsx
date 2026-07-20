import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  areBusinessHoursValid,
  BUSINESS_HOURS_SELECT,
  DEFAULT_CLOSING_TIME,
  DEFAULT_OPENING_TIME,
  DEFAULT_WORKING_DAYS,
  WEEKDAY_LABELS,
  buildDefaultWeeklyHours,
  deriveLegacyFromWeekly,
  normalizeTimeValue,
  normalizeWeeklyHours,
  normalizeWorkingDays,
  type WeeklyHours,
} from "@/lib/businessHours";

interface GeneralSettingsFormProps {
  establishmentId: string;
}

export function GeneralSettingsForm({ establishmentId }: GeneralSettingsFormProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["settings", establishmentId],
    queryFn: async () => {
      const [settingsRes, profileRes] = await Promise.all([
        (supabase as any).from("settings").select(BUSINESS_HOURS_SELECT).eq("establishment_id", establishmentId).maybeSingle(),
        supabase.from("profiles").select("accepting_bookings").eq("id", establishmentId).maybeSingle(),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      if (profileRes.error) throw profileRes.error;
      return {
        settings: settingsRes.data as any,
        accepting_bookings: (profileRes.data as any)?.accepting_bookings ?? true,
      };
    },
  });

  const [threshold, setThreshold] = useState<number>(20);
  const [weekly, setWeekly] = useState<WeeklyHours>(() => buildDefaultWeeklyHours());
  const [accepting, setAccepting] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const s = data.settings;
    if (s?.inactive_days_threshold != null) setThreshold(Number(s.inactive_days_threshold));
    const legacyOpen = normalizeTimeValue(s?.opening_time, DEFAULT_OPENING_TIME);
    const legacyClose = normalizeTimeValue(s?.closing_time, DEFAULT_CLOSING_TIME);
    const legacyDays = normalizeWorkingDays(s?.working_days ?? DEFAULT_WORKING_DAYS);
    setWeekly(normalizeWeeklyHours(s?.weekly_hours, {
      openingTime: legacyOpen,
      closingTime: legacyClose,
      workingDays: legacyDays,
    }));
    setAccepting(data.accepting_bookings);
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

  const setDayOpen = (day: number, open: boolean) => {
    setWeekly(prev => {
      const key = String(day);
      const current = prev[key] ?? { open: false, intervals: [] };
      if (open && current.intervals.length === 0) {
        return { ...prev, [key]: { open: true, intervals: [{ open: DEFAULT_OPENING_TIME, close: DEFAULT_CLOSING_TIME }] } };
      }
      return { ...prev, [key]: { ...current, open } };
    });
  };

  const updateInterval = (day: number, idx: number, field: "open" | "close", value: string) => {
    setWeekly(prev => {
      const key = String(day);
      const current = prev[key] ?? { open: true, intervals: [] };
      const intervals = current.intervals.slice();
      intervals[idx] = { ...intervals[idx], [field]: value };
      return { ...prev, [key]: { ...current, intervals } };
    });
  };

  const addInterval = (day: number) => {
    setWeekly(prev => {
      const key = String(day);
      const current = prev[key] ?? { open: true, intervals: [] };
      return {
        ...prev,
        [key]: {
          open: true,
          intervals: [...current.intervals, { open: DEFAULT_OPENING_TIME, close: DEFAULT_CLOSING_TIME }],
        },
      };
    });
  };

  const removeInterval = (day: number, idx: number) => {
    setWeekly(prev => {
      const key = String(day);
      const current = prev[key] ?? { open: true, intervals: [] };
      const intervals = current.intervals.filter((_, i) => i !== idx);
      return {
        ...prev,
        [key]: { open: intervals.length > 0 ? current.open : false, intervals },
      };
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (const d of WEEKDAY_LABELS) {
      const cfg = weekly[String(d.value)];
      if (!cfg?.open) continue;
      if (cfg.intervals.length === 0) {
        toast.error(`${d.label}: adicione pelo menos um intervalo ou marque como fechado.`);
        return;
      }
      for (const iv of cfg.intervals) {
        if (!areBusinessHoursValid(iv.open, iv.close)) {
          toast.error(`${d.label}: horário inválido (abertura deve ser menor que fechamento).`);
          return;
        }
      }
    }

    const anyOpen = WEEKDAY_LABELS.some(d => weekly[String(d.value)]?.open);
    if (!anyOpen) {
      toast.error("Selecione pelo menos um dia de funcionamento.");
      return;
    }

    setSaving(true);
    try {
      const legacy = deriveLegacyFromWeekly(weekly);
      const payload = {
        inactive_days_threshold: threshold,
        opening_time: legacy.openingTime,
        closing_time: legacy.closingTime,
        working_days: legacy.workingDays,
        weekly_hours: weekly,
      };
      const { error } = await (supabase as any)
        .from("settings")
        .upsert(
          { establishment_id: establishmentId, ...payload },
          { onConflict: "establishment_id" }
        );
      if (error) throw error;
      toast.success("Preferências salvas!");
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["agenda"] }),
        queryClient.invalidateQueries({ queryKey: ["business-hours"] }),
      ]);
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
          <h3 className="text-base font-semibold">Horário de funcionamento por dia</h3>
          <p className="text-sm text-muted-foreground">
            Defina para cada dia se o salão abre e em quais intervalos. Dias fechados não recebem agendamentos.
          </p>
        </div>

        <div className="space-y-3">
          {WEEKDAY_LABELS.map((d) => {
            const cfg = weekly[String(d.value)] ?? { open: false, intervals: [] };
            return (
              <div key={d.value} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={cfg.open} onCheckedChange={(v) => setDayOpen(d.value, v)} />
                    <div>
                      <p className="font-medium">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{cfg.open ? "Aberto" : "Fechado"}</p>
                    </div>
                  </div>
                  {cfg.open && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addInterval(d.value)}>
                      <Plus className="mr-1 h-4 w-4" /> Adicionar intervalo
                    </Button>
                  )}
                </div>

                {cfg.open && (
                  <div className="mt-3 space-y-2">
                    {cfg.intervals.map((iv, idx) => (
                      <div key={idx} className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Abertura</Label>
                          <Input
                            type="time"
                            value={iv.open}
                            onChange={(e) => updateInterval(d.value, idx, "open", e.target.value)}
                            className="w-32"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fechamento</Label>
                          <Input
                            type="time"
                            value={iv.close}
                            onChange={(e) => updateInterval(d.value, idx, "close", e.target.value)}
                            className="w-32"
                          />
                        </div>
                        {cfg.intervals.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInterval(d.value, idx)}
                            aria-label="Remover intervalo"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
