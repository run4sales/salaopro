import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientCombobox } from "@/components/ClientCombobox";
import { useToast } from "@/hooks/use-toast";
import { STATUS_OPTIONS } from "@/lib/appointmentStatus";

type Service = { id: string; name: string };
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

export function AppointmentFormDialog({
  open, onOpenChange, establishmentId, services, professionals, initialDate, appointment, onSaved,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: "", service_id: "", professional_id: "",
    appointment_date: "", notes: "", status: "scheduled",
  });

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setForm({
        client_id: appointment.client_id ?? "",
        service_id: appointment.service_id ?? "",
        professional_id: appointment.professional_id ?? "",
        appointment_date: appointment.appointment_date ? toLocalInput(new Date(appointment.appointment_date)) : "",
        notes: appointment.notes ?? "",
        status: appointment.status ?? "scheduled",
      });
    } else {
      setForm({
        client_id: "", service_id: "", professional_id: "",
        appointment_date: initialDate ? toLocalInput(initialDate) : "",
        notes: "", status: "scheduled",
      });
    }
  }, [open, appointment, initialDate]);

  const handleSave = async () => {
    if (!form.client_id || !form.service_id || !form.appointment_date) {
      toast({ title: "Preencha cliente, serviço e data/hora", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      establishment_id: establishmentId,
      client_id: form.client_id,
      service_id: form.service_id,
      professional_id: form.professional_id || null,
      appointment_date: new Date(form.appointment_date).toISOString(),
      status: form.status,
      notes: form.notes || null,
    };
    const { error } = appointment?.id
      ? await supabase.from("appointments").update(payload).eq("id", appointment.id)
      : await supabase.from("appointments").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
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
            <label className="text-sm text-muted-foreground">Serviço *</label>
            <Select value={form.service_id} onValueChange={(v) => setForm(f => ({ ...f, service_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Profissional</label>
            <Select value={form.professional_id} onValueChange={(v) => setForm(f => ({ ...f, professional_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
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
