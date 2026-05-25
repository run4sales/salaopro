import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LABELS, STATUS_VARIANTS, normalizeStatus } from "@/lib/appointmentStatus";

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
  if (!appointment) return null;
  const key = normalizeStatus(appointment.status);

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status atualizado" });
    onChanged();
    onOpenChange(false);
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
            <Button size="sm" onClick={() => setStatus("in_service")}><Play className="h-3.5 w-3.5 mr-1" />Iniciar</Button>
          )}
          {key !== "canceled" && (
            <Button variant="destructive" size="sm" onClick={() => setStatus("canceled")}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
