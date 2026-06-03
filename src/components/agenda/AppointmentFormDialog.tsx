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

type Service = { id: string; name: string; duration_minutes?: number | null; price?: number | null };
type AppointmentBlock = { id: string; professional_id: string; start_time: string; end_time: string; reason?: string | null };
type Professional = { id: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  services: Service[];
  professionals: Professional[];
  blocks?: AppointmentBlock[];
  initialDate?: Date | null;
  appointment?: any | null;
  onSaved?: () => void;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


function formatDurationInput(minutes: number | string | null | undefined) {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseDurationInput(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
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
        <Button variant="outline" className="w-full justify-between mt-1 font-normal">
          <span className={selected.length ? "" : "text-muted-foreground"}>{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-2 max-h-72 overflow-auto" align="start">
        {options.length === 0 && <p className="text-sm text-muted-foreground p-2">Nenhuma opção</p>}
        {options.map(opt => (
          <label key={opt.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer">
            <Checkbox checked={selected.includes(opt.id)} onCheckedChange={() => toggle(opt.id)} />
            <span className="text-sm">{opt.name}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function AppointmentFormDialog({
  open, onOpenChange, establishmentId, services, professionals, blocks = [], initialDate, appointment, onSaved,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    service_ids: [] as string[],
    professional_ids: [] as string[],
    appointment_date: "",
    duration_minutes: "",
    service_amount: "",
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
          duration_minutes: appointment.duration_minutes
            ? formatDurationInput(appointment.duration_minutes)
            : formatDurationInput(services.filter(s => svcIds.includes(s.id)).reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0)),
          service_amount: appointment.service_amount != null
            ? String(appointment.service_amount)
            : services.filter(s => svcIds.includes(s.id)).reduce((sum, s) => sum + (Number(s.price) || 0), 0).toFixed(2),
          notes: appointment.notes ?? "",
          status: appointment.status ?? "scheduled",
        });
      } else {
        setForm({
          client_id: "", service_ids: [], professional_ids: [],
          appointment_date: initialDate ? toLocalInput(initialDate) : "",
          duration_minutes: "",
          service_amount: "",
          notes: "", status: "scheduled",
        });
      }
    };
    load();
  }, [open, appointment, initialDate, services]);

  const totalDuration = useMemo(() => {
    return services
      .filter(s => form.service_ids.includes(s.id))
      .reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
  }, [services, form.service_ids]);

  const totalAmount = useMemo(() => {
    return services
      .filter(s => form.service_ids.includes(s.id))
      .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  }, [services, form.service_ids]);

  useEffect(() => {
    if (!open || appointment?.id) return;
    setForm(f => ({
      ...f,
      duration_minutes: totalDuration > 0 ? formatDurationInput(totalDuration) : f.duration_minutes,
      service_amount: totalAmount > 0 ? totalAmount.toFixed(2) : f.service_amount,
    }));
  }, [open, appointment?.id, totalDuration, totalAmount]);

  const handleSave = async () => {
    const durationMinutes = parseDurationInput(form.duration_minutes);
    if (!form.client_id || form.service_ids.length === 0 || form.professional_ids.length === 0 || !form.appointment_date || durationMinutes <= 0) {
      toast({ title: "Preencha cliente, serviço(s), profissional(is), data/hora e duração", variant: "destructive" });
      return;
    }

    const start = new Date(form.appointment_date);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const blocked = blocks.find((block) =>
      form.professional_ids.includes(block.professional_id) &&
      new Date(block.start_time) < end &&
      new Date(block.end_time) > start
    );

    if (blocked) {
      toast({
        title: "Horário bloqueado",
        description: blocked.reason || "Existe um bloqueio para este profissional no horário selecionado.",
        variant: "destructive",
      });
      return;
    }

    const { data: conflictingBlocks, error: blocksError } = await (supabase as any)
      .from("appointment_blocks")
      .select("id, reason")
      .eq("establishment_id", establishmentId)
      .in("professional_id", form.professional_ids)
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString())
      .limit(1);

    if (blocksError) {
      toast({ title: "Erro ao validar bloqueios", description: blocksError.message, variant: "destructive" });
      return;
    }

    if ((conflictingBlocks ?? []).length > 0) {
      toast({
        title: "Horário bloqueado",
        description: conflictingBlocks[0].reason || "Existe um bloqueio para este profissional no horário selecionado.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      establishment_id: establishmentId,
      client_id: form.client_id,
      service_id: form.service_ids[0],
      professional_id: form.professional_ids[0],
      appointment_date: start.toISOString(),
      duration_minutes: durationMinutes,
      service_amount: Number(form.service_amount) || 0,
      status: form.status,
      notes: form.notes || null,
    };

    let appointmentId = appointment?.id as string | undefined;
    if (appointmentId) {
      const { error } = await (supabase as any).from("appointments").update(payload).eq("id", appointmentId);
      if (error) { setSaving(false); toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    } else {
      const { data, error } = await (supabase as any).from("appointments").insert(payload).select("id").single();
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
              onChange={(value) => {
                const selectedServices = services.filter(service => value.includes(service.id));
                const nextDuration = selectedServices.reduce((sum, service) => sum + (Number(service.duration_minutes) || 0), 0);
                const nextAmount = selectedServices.reduce((sum, service) => sum + (Number(service.price) || 0), 0);
                setForm(f => ({
                  ...f,
                  service_ids: value,
                  duration_minutes: nextDuration > 0 ? formatDurationInput(nextDuration) : f.duration_minutes,
                  service_amount: nextAmount > 0 ? nextAmount.toFixed(2) : f.service_amount,
                }));
              }}
              placeholder="Selecione os serviços"
            />
            {totalDuration > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Duração padrão dos serviços: {formatDurationInput(totalDuration)}</p>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Data e hora *</label>
              <Input type="datetime-local" value={form.appointment_date} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Duração *</label>
              <Input type="time" step="60" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Valor do serviço (R$)</label>
            <Input type="number" min="0" step="0.01" value={form.service_amount} onChange={e => setForm(f => ({ ...f, service_amount: e.target.value }))} placeholder="0,00" />
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
