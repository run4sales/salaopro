import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Smartphone, CreditCard, ArrowLeftRight, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientCreditPrompt } from "@/components/clients/ClientCreditPrompt";
import { useAuth } from "@/hooks/useAuth";
import { insertSalesWithCreatorFallback } from "@/lib/salesInsert";
import { syncSaleCommissions } from "@/lib/commissions";

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
  const { user } = useAuth();
  const [method, setMethod] = useState<typeof methods[number]["value"]>("Dinheiro");
  const [machineId, setMachineId] = useState("");
  const [installments, setInstallments] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [creditAmount, setCreditAmount] = useState("0");
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptShown, setPromptShown] = useState(false);

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

  const { data: clientCredit } = useQuery({
    queryKey: ["client_credit_balance", comanda?.client_id],
    queryFn: async () => {
      if (!comanda?.client_id) return 0;
      const { data } = await supabase.from("clients").select("credit_balance").eq("id", comanda.client_id).single();
      return Number(data?.credit_balance ?? 0);
    },
    enabled: !!comanda?.client_id && open,
  });

  const availableCredit = Number(clientCredit ?? 0);
  const appliedCredit = useCredit ? Math.min(Number(creditAmount) || 0, availableCredit, total) : 0;
  const remainingToPay = Math.max(total - appliedCredit, 0);

  useEffect(() => {
    if (useCredit && (!creditAmount || Number(creditAmount) === 0)) {
      setCreditAmount(Math.min(availableCredit, total).toFixed(2));
    }
  }, [useCredit, availableCredit, total]);

  // Reset prompt state quando o diálogo fecha
  useEffect(() => {
    if (!open) {
      setPromptShown(false);
      setPromptOpen(false);
    }
  }, [open]);

  // Abre prompt automaticamente quando há cliente com saldo
  useEffect(() => {
    if (open && !promptShown && availableCredit > 0 && total > 0 && !useCredit) {
      setPromptOpen(true);
      setPromptShown(true);
    }
  }, [open, promptShown, availableCredit, total, useCredit]);

  const feePct = useMemo(() => {
    if (!isCard || !machineId) return 0;
    const ct = (meta as any).cardType;
    const f = (fees ?? []).find((x: any) =>
      x.card_machine_id === machineId && x.payment_type === ct &&
      (ct !== "credit_installment" || x.installments === parseInt(installments, 10))
    );
    return f ? Number(f.fee_percentage) : 0;
  }, [isCard, machineId, meta, fees, installments]);

  const feeAmount = remainingToPay * (feePct / 100);
  const netTotal = remainingToPay - feeAmount;

  const finalize = async () => {
    if (!user) { toast.error("Faça login para finalizar a venda."); return; }
    if (remainingToPay > 0 && isCard && !machineId) { toast.error("Selecione a maquininha"); return; }
    if (items.length === 0) return;
    if (appliedCredit > availableCredit) { toast.error("Crédito insuficiente"); return; }
    setSubmitting(true);
    try {
      const subtotalSum = items.reduce((s, i) => s + Number(i.total), 0);
      const factor = subtotalSum > 0 ? total / subtotalSum : 1;
      const creditFactor = total > 0 ? appliedCredit / total : 0;
      const feeRatio = feePct / 100;
      const instNum = isCard && (meta as any).cardType === "credit_installment" ? parseInt(installments, 10) : null;

      const salesPayload = items.map((it) => {
        const itemGross = Number((Number(it.total) * factor).toFixed(2));
        const itemCredit = Number((itemGross * creditFactor).toFixed(2));
        const itemCash = Number((itemGross - itemCredit).toFixed(2));
        const itemFee = Number((itemCash * feeRatio).toFixed(2));
        return {
          establishment_id: establishmentId,
          client_id: comanda.client_id,
          service_id: it.service_id,
          professional_id: it.professional_id,
          appointment_id: comanda.appointment_id,
          amount: itemGross,
          gross_amount: itemGross,
          fee_amount: itemFee,
          net_amount: Number((itemCash - itemFee).toFixed(2)),
          credit_used: itemCredit,
          paid_now: itemCash,
          card_machine_id: isCard && itemCash > 0 ? machineId : null,
          installments: itemCash > 0 ? instNum : null,
          sale_date: new Date().toISOString(),
          payment_method: itemCash > 0 ? method : "Crédito do cliente",
          created_by_user_id: user.id,
        };
      });

      const { data: insertedSales, error } = await insertSalesWithCreatorFallback(salesPayload);
      if (error) throw error;

      // Aplica débito de crédito por venda (mantém histórico vinculado ao sale_id para estorno em cancelamento)
      for (const sale of insertedSales ?? []) {
        const credit = Number((sale as any).credit_used ?? 0);
        if (credit > 0) {
          const { error: cErr } = await (supabase as any).rpc("use_client_credit", {
            _client_id: comanda.client_id,
            _amount: credit,
            _origin: "sale_usage",
            _description: "Uso de crédito em venda",
            _source: "sale",
            _source_id: sale.id,
          });
          if (cErr) throw cErr;
        }
      }

      const appointmentProfessionalIds = comanda.appointment_id
        ? await supabase
            .from("appointment_professionals")
            .select("professional_id")
            .eq("appointment_id", comanda.appointment_id)
            .then(({ data, error }) => {
              if (error) throw error;
              return (data ?? []).map((row) => row.professional_id);
            })
        : [];

      await Promise.all((insertedSales ?? []).map((sale: any, index: number) => {
        const item = items[index] ?? items.find((candidate) => candidate.service_id === sale.service_id);
        const professionals = appointmentProfessionalIds.length > 0
          ? appointmentProfessionalIds.map((professionalId) => ({ professional_id: professionalId, role: "solo" }))
          : [{ professional_id: item?.professional_id, role: "solo" }];

        return syncSaleCommissions({
          establishmentId,
          saleId: sale.id,
          serviceCommissionPercentage: Number(item?.commission_percentage ?? 0),
          baseAmount: Number(sale.amount ?? 0),
          professionals,
        });
      }));

      await supabase.from("comandas").update({ status: "paid", closed_at: new Date().toISOString(), total }).eq("id", comanda.id);
      if (comanda.appointment_id) {
        await supabase.from("appointments").update({ status: "completed" }).eq("id", comanda.appointment_id);
      }

      toast.success(`Pagamento confirmado — R$ ${total.toFixed(2)}${appliedCredit > 0 ? ` (R$ ${appliedCredit.toFixed(2)} em crédito)` : ""}`);
      onPaid();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao finalizar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92svh] overflow-y-auto">
        <DialogHeader><DialogTitle>Finalizar pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {availableCredit > 0 && (
            <div className="rounded-lg border bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" /> Crédito do cliente
                </span>
                <span className="text-sm font-semibold text-primary">R$ {availableCredit.toFixed(2)}</span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                Usar crédito do cliente
              </label>
              {useCredit && (
                <div>
                  <Label className="text-xs">Valor a aplicar (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    max={Math.min(availableCredit, total)}
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setCreditAmount(Math.min(availableCredit, total).toFixed(2))}>
                      Usar tudo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {remainingToPay > 0 && (
            <>
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
            </>
          )}

          <div className="rounded-lg border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
            {appliedCredit > 0 && (
              <div className="flex justify-between text-primary"><span>Crédito aplicado</span><span>- R$ {appliedCredit.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1"><span>A pagar agora</span><span>R$ {remainingToPay.toFixed(2)}</span></div>
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
      <ClientCreditPrompt
        open={promptOpen}
        onOpenChange={setPromptOpen}
        availableCredit={availableCredit}
        total={total}
        onConfirm={(amount) => {
          setUseCredit(true);
          setCreditAmount(amount.toFixed(2));
          setPromptOpen(false);
        }}
        onDecline={() => {
          setUseCredit(false);
          setPromptOpen(false);
        }}
      />
    </Dialog>
  );
}
