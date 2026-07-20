import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string | null;
  onDeleted?: () => void;
}

export function DeleteSaleDialog({ open, onOpenChange, saleId, onDeleted }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const onConfirm = async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("admin_soft_delete_sale", { _sale_id: saleId, _reason: reason || null });
      if (error) throw error;
      toast.success("Venda excluída. Estoque, crédito, comissões e fluxo de caixa foram revertidos.");
      qc.invalidateQueries();
      onDeleted?.();
      onOpenChange(false);
      setReason("");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao excluir venda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá alterar os registros financeiros, estoque, crédito e comissões relacionados a esta venda.
            A operação será registrada no log de auditoria e pode ser consultada posteriormente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: lançamento em duplicidade" rows={2} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-destructive hover:bg-destructive/90">
            {loading ? "Excluindo…" : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
