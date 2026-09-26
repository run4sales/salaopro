import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Play, X, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ComandaSheet } from "@/components/comanda/ComandaSheet";
import { useState } from "react";
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
  canManage?: boolean;
  canOperate?: boolean;
  onEdit: () => void;
  onChanged: () => void;
}

export function AppointmentDetailsDialog({
  open, onOpenChange, appointment, clientName, serviceName, professionalName, canManage = false, canOperate = false, onEdit, onChanged,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [comandaOpen, setComandaOpen] = useState(false);
  const { data: billing, refetch } = useQuery({
    queryKey: ["appointment-billing", appointment?.id],
    enabled: open && !!appointment?.id && canOperate,
    queryFn: async () => {
      const [comandas, sales] = await Promise.all([
        supabase.from("comandas").select("id, status, total").eq("appointment_id", appointment.id).eq("establishment_id", appointment.establishment_id).order("opened_at", { ascending: false }),
        supabase.from("sales").select("id").eq("appointment_id", appointment.id).eq("establishment_id", appointment.establishment_id).is("deleted_at", null).limit(1),
      ]);
      if (comandas.error) throw comandas.error;
      if (sales.error) throw sales.error;
      const paid = (sales.data ?? []).length > 0 || (comandas.data ?? []).some(c => c.status === "paid");
      return { paid, active: (comandas.data ?? []).find(c => ["open", "awaiting_payment"].includes(c.status)), total: (comandas.data ?? []).find(c => c.status === "paid")?.total };
    },
  });
  if (!appointment) return null;
  const key = normalizeStatus(appointment.status);
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const amount = Number(appointment.service_amount ?? 0);
  const deposit = Number(appointment.deposit_amount ?? 0);

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status atualizado" });
    onChanged();
    onOpenChange(false);
  };

  const startService = async () => {
    try {
      const { error: statusError } = await supabase.from("appointments").update({ status: "in_service" }).eq("id", appointment.id);
      if (statusError) throw statusError;
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

  const end = new Date(new Date(appointment.appointment_date).getTime() + Number(appointment.duration_minutes || 30) * 60_000);
  return (<>
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
           <div className="flex justify-between gap-3"><span className="text-muted-foreground">Data e horário</span><span className="text-right">{new Date(appointment.appointment_date).toLocaleString("pt-BR")}–{end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{clientName ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span>{serviceName ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Profissional</span><span>{professionalName ?? "-"}</span></div>
          {appointment.duration_minutes && <div className="flex justify-between"><span className="text-muted-foreground">Duração</span><span>{appointment.duration_minutes} min</span></div>}
           {appointment.service_amount != null && <div className="flex justify-between"><span className="text-muted-foreground">Valor do serviço</span><span>{money(amount)}</span></div>}
           {deposit > 0 && <><div className="flex justify-between"><span className="text-muted-foreground">Sinal</span><span>{money(deposit)}</span></div><div className="flex justify-between font-medium"><span>Restante</span><span>{money(Math.max(0, amount - deposit))}</span></div></>}
           {canManage && <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Faturamento</span><Badge variant={billing?.paid ? "default" : "secondary"}>{billing?.paid ? "Faturado" : "Não faturado"}</Badge></div>}
           {billing?.paid && billing.total != null && <div className="flex justify-between"><span className="text-muted-foreground">Comanda</span><span>{money(Number(billing.total))}</span></div>}
          {appointment.notes && (
            <div className="pt-2 border-t">
              <div className="text-muted-foreground mb-1">Observações</div>
              <div>{appointment.notes}</div>
            </div>
          )}
        </div>
         <div className="flex flex-wrap gap-2 pt-2">
            {canOperate && <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>}
            {canOperate && !billing?.paid && !billing?.active && key !== "in_service" && key !== "completed" && key !== "canceled" && key !== "cancelled" && (
            <Button size="sm" onClick={startService}><Play className="h-3.5 w-3.5 mr-1" />Iniciar</Button>
          )}
            {canOperate && billing?.active && !billing.paid && <Button size="sm" onClick={() => { onOpenChange(false); setComandaOpen(true); }}><CreditCard className="mr-1 h-4 w-4" />Faturar comanda</Button>}
            {canOperate && key !== "canceled" && key !== "cancelled" && (
            <Button variant="destructive" size="sm" onClick={() => setStatus("canceled")}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {canOperate && appointment && <ComandaSheet open={comandaOpen} onOpenChange={setComandaOpen} comandaId={billing?.active?.id ?? null} establishmentId={appointment.establishment_id} onClosed={() => { void refetch(); onChanged(); }} />}
  </>);
}
