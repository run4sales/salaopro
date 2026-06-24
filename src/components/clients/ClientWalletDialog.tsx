import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: { id: string; name: string; credit_balance?: number | null } | null;
}

const ORIGIN_LABELS: Record<string, string> = {
  manual: "Crédito manual",
  appointment_deposit: "Sinal de agendamento",
  sale_usage: "Uso em venda",
  sale_refund: "Estorno de venda",
  deposit_refund: "Estorno de sinal",
  adjustment: "Ajuste",
  other: "Outro",
};

const PAYMENT_METHODS = ["Dinheiro", "Pix", "Débito", "Crédito", "Transferência"];

export function ClientWalletDialog({ open, onOpenChange, client }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [origin, setOrigin] = useState("manual");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: txns, isLoading } = useQuery({
    queryKey: ["client_credit_txns", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from("client_credit_transactions")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!client?.id && open,
  });

  const { data: balanceData } = useQuery({
    queryKey: ["client_credit_balance", client?.id],
    queryFn: async () => {
      if (!client?.id) return 0;
      const { data } = await supabase.from("clients").select("credit_balance").eq("id", client.id).single();
      return Number(data?.credit_balance ?? 0);
    },
    enabled: !!client?.id && open,
  });

  const balance = balanceData ?? Number(client?.credit_balance ?? 0);

  const submitCredit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("add_client_credit", {
      _client_id: client!.id,
      _amount: value,
      _origin: origin,
      _payment_method: paymentMethod,
      _description: description || null,
      _source: null,
      _source_id: null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao adicionar crédito", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Crédito adicionado", description: `R$ ${value.toFixed(2)} adicionado à carteira de ${client?.name}` });
    setAmount("");
    setDescription("");
    qc.invalidateQueries({ queryKey: ["client_credit_txns", client?.id] });
    qc.invalidateQueries({ queryKey: ["client_credit_balance", client?.id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Carteira do Cliente
          </DialogTitle>
          <DialogDescription>{client?.name}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold text-primary">R$ {balance.toFixed(2)}</p>
          </div>
          <Wallet className="h-8 w-8 text-primary/40" />
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar crédito</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Crédito manual</SelectItem>
                  <SelectItem value="appointment_deposit">Sinal de agendamento</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <Button onClick={submitCredit} disabled={submitting} className="w-full">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adicionando...</> : "Adicionar crédito"}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Histórico de movimentações</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Carregando...</p>
          ) : !txns || txns.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center border rounded">Nenhuma movimentação ainda.</p>
          ) : (
            <div className="border rounded divide-y max-h-72 overflow-y-auto">
              {txns.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.type === "credit" ? (
                      <ArrowUpCircle className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ORIGIN_LABELS[t.origin] ?? t.origin}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}
                        {t.payment_method ? ` • ${t.payment_method}` : ""}
                        {t.description ? ` • ${t.description}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={t.type === "credit" ? "default" : "secondary"} className="shrink-0">
                    {t.type === "credit" ? "+" : "-"} R$ {Number(t.amount).toFixed(2)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
