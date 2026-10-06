import { useEffect, useRef, useState } from "react";
import { createSingleFlight } from "@/lib/singleFlight";
import { getBlockPersistenceErrorMessage } from "@/lib/appointmentBlockErrors";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Professional = { id: string; name: string };
type AppointmentBlock = {
  id: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  reason?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  establishmentId: string;
  professionals: Professional[];
  initialDate?: Date | null;
  initialProfessionalId?: string | null;
  block?: AppointmentBlock | null;
  onSaved?: () => void;
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AppointmentBlockDialog({
  open,
  onOpenChange,
  establishmentId,
  professionals,
  initialDate,
  initialProfessionalId,
  block,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const writeGate = useRef(createSingleFlight());
  const [form, setForm] = useState({ professional_id: "", start_time: "", end_time: "", reason: "" });

  useEffect(() => {
    if (!open) return;
    if (block) {
      setForm({
        professional_id: block.professional_id,
        start_time: toLocalInput(new Date(block.start_time)),
        end_time: toLocalInput(new Date(block.end_time)),
        reason: block.reason ?? "",
      });
      return;
    }

    const start = initialDate ?? new Date();
    const end = new Date(start.getTime() + 60 * 60_000);
    setForm({
      professional_id: professionals.find((professional) => professional.id === initialProfessionalId)?.id ?? professionals[0]?.id ?? "",
      start_time: toLocalInput(start),
      end_time: toLocalInput(end),
      reason: "",
    });
  }, [open, block, initialDate, initialProfessionalId, professionals]);

  const save = async () => {
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    if (!professionals.some(professional => professional.id === form.professional_id) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      toast({ title: "Informe profissional, início e fim válidos", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      establishment_id: establishmentId,
      professional_id: form.professional_id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      reason: form.reason || null,
    };

    const { data, error } = block?.id
      ? await supabase.from("appointment_blocks").update(payload).eq("id", block.id).eq("establishment_id", establishmentId).select("id").single()
      : await supabase.from("appointment_blocks").insert(payload).select("id").single();

    setSaving(false);
    if (error || !data) {
      toast({ title: "Erro ao salvar bloqueio", description: getBlockPersistenceErrorMessage(error), variant: "destructive" });
      return;
    }

    toast({ title: block?.id ? "Bloqueio atualizado" : "Horário bloqueado" });
    onOpenChange(false);
    onSaved?.();
  };

  const remove = async () => {
    if (!block?.id) return;
    setSaving(true);
    const { error } = await supabase.from("appointment_blocks").delete().eq("id", block.id).eq("establishment_id", establishmentId).select("id").single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao excluir bloqueio", description: getBlockPersistenceErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Bloqueio removido" });
    onOpenChange(false);
    onSaved?.();
  };

  const persistOnce = async (action: () => Promise<void>) => {
    await writeGate.current.run(async () => {
      setSaving(true);
      try {
        await action();
      } catch (error) {
        toast({ title: "Não foi possível alterar o bloqueio", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{block?.id ? "Editar bloqueio" : "Bloquear horário"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Profissional *</label>
            <Select value={form.professional_id} onValueChange={(value) => setForm((current) => ({ ...current, professional_id: value }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>{professional.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Início *</label>
              <Input type="datetime-local" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Fim *</label>
              <Input type="datetime-local" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Motivo</label>
            <Input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ex: almoço, reunião, folga..." />
          </div>
          <div className="flex justify-between gap-2 pt-2">
            {block?.id ? <Button type="button" variant="destructive" disabled={saving} onClick={() => void persistOnce(remove)}>Excluir</Button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" disabled={saving} onClick={() => void persistOnce(save)}>{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
