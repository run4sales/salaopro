import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LABELS, STATUS_VARIANTS, normalizeStatus } from "@/lib/appointmentStatus";
import { ensureComandaForAppointment } from "@/lib/comanda";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointment: any | null;
  clientName?: string;
  serviceName?: string;
  professionalName?: string;
  onEdit: () => void;
  onChanged: () => void;
}

export function AppointmentDetailsDialog({
  open, onOpenChange, appointment, clientName, serviceName, professionalName, onEdit, onChanged,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  if (!appointment) return null;
  const key = normalizeStatus(appointment.status);

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status atualizado" });
    onChanged();
    onOpenChange(false);
  };

  const startService = async () => {
    try {
      await supabase.from("appointments").update({ status: "in_service" }).eq("id", appointment.id);
      await ensureComandaForAppointment({
        establishment_id: appointment.establishment_id,
        appointment_id: appointment.id,
        client_id: appointment.client_id,
        service_id: appointment.service_id,
        professional_id: appointment.professional_id,
      });
      toast({ title: "Atendimento iniciado", description: "Comanda aberta." });
      onChanged();
      onOpenChange(false);
      navigate("/atendimentos");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={STATUS_VARIANTS[key] ?? "secondary"}>{STATUS_LABELS[key] ?? "Agendado"}</Badge>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{new Date(appointment.appointment_date).toLocaleString("pt-BR")}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{clientName ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span>{serviceName ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Profissional</span><span>{professionalName ?? "-"}</span></div>
          {appointment.duration_minutes && <div className="flex justify-between"><span className="text-muted-foreground">Duração</span><span>{appointment.duration_minutes} min</span></div>}
          {appointment.service_amount != null && <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span>{Number(appointment.service_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>}
          {appointment.notes && (
            <div className="pt-2 border-t">
              <div className="text-muted-foreground mb-1">Observações</div>
              <div>{appointment.notes}</div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
          {key !== "in_service" && key !== "completed" && (
            <Button size="sm" onClick={startService}><Play className="h-3.5 w-3.5 mr-1" />Iniciar</Button>
          )}
          {key !== "canceled" && (
            <Button variant="destructive" size="sm" onClick={() => setStatus("canceled")}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
