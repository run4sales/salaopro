import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Smartphone, CreditCard, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const methods = [
  { value: "Dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "Pix", label: "Pix", icon: Smartphone },
  { value: "Débito", label: "Débito", icon: CreditCard, isCard: true, cardType: "debit" },
  { value: "Crédito", label: "Crédito", icon: CreditCard, isCard: true, cardType: "credit" },
  { value: "Crédito parcelado", label: "Parcelado", icon: CreditCard, isCard: true, cardType: "credit_installment" },
  { value: "Transferência", label: "Transf.", icon: ArrowLeftRight },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  comanda: any;
  items: any[];
  establishmentId: string;
  total: number;
  onPaid: () => void;
}

export function PdvDialog({ open, onOpenChange, comanda, items, establishmentId, total, onPaid }: Props) {
  const [method, setMethod] = useState<typeof methods[number]["value"]>("Dinheiro");
  const [machineId, setMachineId] = useState("");
  const [installments, setInstallments] = useState("2");
  const [submitting, setSubmitting] = useState(false);

  const meta = methods.find((m) => m.value === method);
  const isCard = !!(meta as any)?.isCard;

  const { data: machines } = useQuery({
    queryKey: ["card_machines", establishmentId],
    queryFn: async () => {
      const { data } = await supabase.from("card_machines").select("id, name").eq("establishment_id", establishmentId).eq("active", true);
      return data ?? [];
    },
  });

  const { data: fees } = useQuery({
    queryKey: ["card_machine_fees", establishmentId],
    queryFn: async () => {
      const { data } = await supabase.from("card_machine_fees").select("*").eq("establishment_id", establishmentId);
      return data ?? [];
    },
  });

  const feePct = useMemo(() => {
    if (!isCard || !machineId) return 0;
    const ct = (meta as any).cardType;
    const f = (fees ?? []).find((x: any) =>
      x.card_machine_id === machineId && x.payment_type === ct &&
      (ct !== "credit_installment" || x.installments === parseInt(installments, 10))
    );
    return f ? Number(f.fee_percentage) : 0;
  }, [isCard, machineId, meta, fees, installments]);

  const feeAmount = total * (feePct / 100);
  const netTotal = total - feeAmount;

  const finalize = async () => {
    if (isCard && !machineId) { toast.error("Selecione a maquininha"); return; }
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const subtotalSum = items.reduce((s, i) => s + Number(i.total), 0);
      const factor = subtotalSum > 0 ? total / subtotalSum : 1;
      const feeRatio = feePct / 100;
      const instNum = isCard && (meta as any).cardType === "credit_installment" ? parseInt(installments, 10) : null;

      const salesPayload = items.map((it) => {
        const itemGross = Number((Number(it.total) * factor).toFixed(2));
        const itemFee = Number((itemGross * feeRatio).toFixed(2));
        return {
          establishment_id: establishmentId,
          client_id: comanda.client_id,
          service_id: it.service_id,
          professional_id: it.professional_id,
          appointment_id: comanda.appointment_id,
          amount: itemGross,
          gross_amount: itemGross,
          fee_amount: itemFee,
          net_amount: Number((itemGross - itemFee).toFixed(2)),
          card_machine_id: isCard ? machineId : null,
          installments: instNum,
          sale_date: new Date().toISOString(),
          payment_method: method,
        };
      });

      const { data: insertedSales, error } = await supabase.from("sales").insert(salesPayload).select("id, service_id, amount");
      if (error) throw error;

      const sp = (insertedSales ?? []).map((sale: any) => {
        const it = items.find((i) => i.service_id === sale.service_id);
        return {
          establishment_id: establishmentId,
          sale_id: sale.id,
          professional_id: it?.professional_id,
          role: "solo",
          commission_percentage: Number(it?.commission_percentage ?? 0),
          commission_amount: Number((Number(sale.amount) * Number(it?.commission_percentage ?? 0) / 100).toFixed(2)),
        };
      }).filter((r) => r.professional_id);
      if (sp.length) await supabase.from("sale_professionals").insert(sp);

      await supabase.from("comandas").update({ status: "paid", closed_at: new Date().toISOString(), total }).eq("id", comanda.id);
      if (comanda.appointment_id) {
        await supabase.from("appointments").update({ status: "completed" }).eq("id", comanda.appointment_id);
      }

      toast.success(`Pagamento confirmado — R$ ${total.toFixed(2)}`);
      onPaid();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao finalizar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Finalizar pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => {
              const I = m.icon;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "rounded-lg border p-2 flex flex-col items-center gap-1 text-xs hover:border-primary transition",
                    method === m.value && "border-primary bg-primary/10"
                  )}
                >
                  <I className="h-4 w-4" />{m.label}
                </button>
              );
            })}
          </div>

          {isCard && (
            <div className="space-y-2">
              <Label className="text-xs">Maquininha</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(machines ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {(meta as any).cardType === "credit_installment" && (
                <>
                  <Label className="text-xs">Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}

          <div className="rounded-lg border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
            {feeAmount > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground"><span>Taxa ({feePct}%)</span><span>- R$ {feeAmount.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold text-primary border-t pt-1"><span>Líquido</span><span>R$ {netTotal.toFixed(2)}</span></div>
              </>
            )}
          </div>

          <Button className="w-full" onClick={finalize} disabled={submitting}>
            {submitting ? "Processando..." : "Confirmar pagamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
