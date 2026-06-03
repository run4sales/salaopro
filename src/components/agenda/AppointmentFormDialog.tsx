import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { useToast } from "@/hooks/use-toast";
import { STATUS_OPTIONS } from "@/lib/appointmentStatus";
import { ChevronDown } from "lucide-react";

type Service = { id: string; name: string; duration_minutes?: number | null };
type Professional = { id: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  services: Service[];
  professionals: Professional[];
  initialDate?: Date | null;
  appointment?: any | null;
  onSaved?: () => void;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MultiSelect({
  options, selected, onChange, placeholder,
}: {
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const label = useMemo(() => {
    if (!selected.length) return placeholder;
    const names = options.filter(o => selected.includes(o.id)).map(o => o.name);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [options, selected, placeholder]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="mt-1 w-full min-w-0 justify-between font-normal">
          <span className={selected.length ? "truncate" : "truncate text-muted-foreground"}>{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        collisionPadding={16}
        className="z-[70] w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-2 [max-height:min(var(--radix-popover-content-available-height),20rem)] [-webkit-overflow-scrolling:touch]"
      >
        {options.length === 0 && <p className="text-sm text-muted-foreground p-2">Nenhuma opção</p>}
        {options.map(opt => (
          <label key={opt.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded p-3 hover:bg-accent sm:p-2">
            <Checkbox checked={selected.includes(opt.id)} onCheckedChange={() => toggle(opt.id)} />
            <span className="min-w-0 flex-1 break-words text-sm leading-snug">{opt.name}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function AppointmentFormDialog({
  open, onOpenChange, establishmentId, services, professionals, initialDate, appointment, onSaved,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    service_ids: [] as string[],
    professional_ids: [] as string[],
    appointment_date: "",
    notes: "",
    status: "scheduled",
  });

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      if (appointment?.id) {
        const [{ data: svc }, { data: prof }] = await Promise.all([
          supabase.from("appointment_services").select("service_id").eq("appointment_id", appointment.id),
          supabase.from("appointment_professionals").select("professional_id").eq("appointment_id", appointment.id),
        ]);
        const svcIds = (svc ?? []).map((r: any) => r.service_id);
        const profIds = (prof ?? []).map((r: any) => r.professional_id);
        setForm({
          client_id: appointment.client_id ?? "",
          service_ids: svcIds.length ? svcIds : (appointment.service_id ? [appointment.service_id] : []),
          professional_ids: profIds.length ? profIds : (appointment.professional_id ? [appointment.professional_id] : []),
          appointment_date: appointment.appointment_date ? toLocalInput(new Date(appointment.appointment_date)) : "",
          notes: appointment.notes ?? "",
          status: appointment.status ?? "scheduled",
        });
      } else {
        setForm({
          client_id: "", service_ids: [], professional_ids: [],
          appointment_date: initialDate ? toLocalInput(initialDate) : "",
          notes: "", status: "scheduled",
        });
      }
    };
    load();
  }, [open, appointment, initialDate]);

  const totalDuration = useMemo(() => {
    return services
      .filter(s => form.service_ids.includes(s.id))
      .reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
  }, [services, form.service_ids]);

  const handleSave = async () => {
    if (!form.client_id || form.service_ids.length === 0 || form.professional_ids.length === 0 || !form.appointment_date) {
      toast({ title: "Preencha cliente, serviço(s), profissional(is) e data/hora", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      establishment_id: establishmentId,
      client_id: form.client_id,
      service_id: form.service_ids[0],
      professional_id: form.professional_ids[0],
      appointment_date: new Date(form.appointment_date).toISOString(),
      status: form.status,
      notes: form.notes || null,
    };

    let appointmentId = appointment?.id as string | undefined;
    if (appointmentId) {
      const { error } = await supabase.from("appointments").update(payload).eq("id", appointmentId);
      if (error) { setSaving(false); toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    } else {
      const { data, error } = await supabase.from("appointments").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }); return; }
      appointmentId = data.id;
    }

    // Replace join rows
    await supabase.from("appointment_services").delete().eq("appointment_id", appointmentId);
    await supabase.from("appointment_professionals").delete().eq("appointment_id", appointmentId);
    if (form.service_ids.length) {
      await supabase.from("appointment_services").insert(
        form.service_ids.map(sid => ({ appointment_id: appointmentId!, service_id: sid, establishment_id: establishmentId }))
      );
    }
    if (form.professional_ids.length) {
      await supabase.from("appointment_professionals").insert(
        form.professional_ids.map(pid => ({ appointment_id: appointmentId!, professional_id: pid, establishment_id: establishmentId }))
      );
    }

    setSaving(false);
    toast({ title: appointment?.id ? "Agendamento atualizado" : "Agendamento criado" });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{appointment?.id ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Cliente *</label>
            <div className="mt-1">
              <ClientCombobox
                establishmentId={establishmentId}
                value={form.client_id}
                onChange={(id) => setForm(f => ({ ...f, client_id: id }))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Serviços *</label>
            <MultiSelect
              options={services.map(s => ({ id: s.id, name: s.name }))}
              selected={form.service_ids}
              onChange={(v) => setForm(f => ({ ...f, service_ids: v }))}
              placeholder="Selecione os serviços"
            />
            {totalDuration > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Duração total: {totalDuration} min</p>
            )}
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Profissionais *</label>
            <MultiSelect
              options={professionals}
              selected={form.professional_ids}
              onChange={(v) => setForm(f => ({ ...f, professional_ids: v }))}
              placeholder="Selecione os profissionais"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Data e hora *</label>
            <Input type="datetime-local" value={form.appointment_date} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Status</label>
            <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Observações</label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
          </div>
          <Button className="w-full" disabled={saving} onClick={handleSave}>
            {saving ? "Salvando..." : appointment?.id ? "Salvar alterações" : "Confirmar agendamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
