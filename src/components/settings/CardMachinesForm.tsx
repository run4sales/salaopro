import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface Props { establishmentId: string }

interface Machine { id: string; name: string; active: boolean }
interface Fee { id: string; card_machine_id: string; payment_type: string; installments: number | null; fee_percentage: number }

const PAYMENT_LABEL: Record<string, string> = {
  debit: "Débito",
  credit: "Crédito à vista",
  credit_installment: "Crédito parcelado",
};

export function CardMachinesForm({ establishmentId }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [feeForm, setFeeForm] = useState({ payment_type: "debit", installments: "", fee_percentage: "" });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["card_machines", establishmentId],
    queryFn: async () => {
      const { data } = await supabase.from("card_machines").select("id, name, active").eq("establishment_id", establishmentId).order("name");
      return (data ?? []) as Machine[];
    },
  });

  const { data: fees } = useQuery<Fee[]>({
    queryKey: ["card_machine_fees", establishmentId, selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from("card_machine_fees").select("id, card_machine_id, payment_type, installments, fee_percentage").eq("card_machine_id", selected).order("payment_type").order("installments");
      return (data ?? []) as Fee[];
    },
  });

  const addMachine = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("card_machines").insert({ establishment_id: establishmentId, name: name.trim() });
    if (error) { toast.error(error.message); return; }
    setName(""); qc.invalidateQueries({ queryKey: ["card_machines"] }); toast.success("Maquininha cadastrada");
  };

  const removeMachine = async (id: string) => {
    if (!confirm("Remover maquininha e todas as taxas?")) return;
    const { error } = await supabase.from("card_machines").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selected === id) setSelected("");
    qc.invalidateQueries({ queryKey: ["card_machines"] });
  };

  const addFee = async () => {
    const pct = Number(feeForm.fee_percentage);
    if (!selected || isNaN(pct) || pct < 0) return;
    const inst = feeForm.payment_type === "credit_installment"
      ? (feeForm.installments ? parseInt(feeForm.installments, 10) : null)
      : null;
    if (feeForm.payment_type === "credit_installment" && !inst) {
      toast.error("Informe número de parcelas"); return;
    }
    const { error } = await supabase.from("card_machine_fees").insert({
      establishment_id: establishmentId,
      card_machine_id: selected,
      payment_type: feeForm.payment_type,
      installments: inst,
      fee_percentage: pct,
    });
    if (error) { toast.error(error.message); return; }
    setFeeForm({ payment_type: "debit", installments: "", fee_percentage: "" });
    qc.invalidateQueries({ queryKey: ["card_machine_fees"] });
  };

  const removeFee = async (id: string) => {
    const { error } = await supabase.from("card_machine_fees").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["card_machine_fees"] });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Maquininhas</CardTitle>
          <CardDescription>Cadastre adquirentes (Stone, PagSeguro, Cielo...)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nome da maquininha" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={addMachine}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="rounded-md border divide-y">
            {(machines ?? []).map(m => (
              <div key={m.id} className={`flex items-center justify-between px-3 py-2 cursor-pointer ${selected === m.id ? "bg-primary/5" : ""}`} onClick={() => setSelected(m.id)}>
                <span className="font-medium text-sm">{m.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeMachine(m.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(!machines || machines.length === 0) && (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">Nenhuma maquininha cadastrada.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas {selected ? `· ${machines?.find(m => m.id === selected)?.name}` : ""}</CardTitle>
          <CardDescription>Selecione uma maquininha para gerenciar suas taxas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selected ? (
            <div className="text-sm text-muted-foreground text-center py-8">Selecione uma maquininha à esquerda</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Modalidade</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={feeForm.payment_type}
                    onChange={(e) => setFeeForm(f => ({ ...f, payment_type: e.target.value, installments: "" }))}
                  >
                    <option value="debit">Débito</option>
                    <option value="credit">Crédito à vista</option>
                    <option value="credit_installment">Crédito parcelado</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    type="number"
                    min="2"
                    max="12"
                    disabled={feeForm.payment_type !== "credit_installment"}
                    value={feeForm.installments}
                    onChange={(e) => setFeeForm(f => ({ ...f, installments: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Taxa (%)</Label>
                  <Input type="number" min="0" step="0.01" value={feeForm.fee_percentage} onChange={(e) => setFeeForm(f => ({ ...f, fee_percentage: e.target.value }))} />
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={addFee}><Plus className="h-4 w-4 mr-1" /> Adicionar taxa</Button>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fees ?? []).map(f => (
                    <TableRow key={f.id}>
                      <TableCell>{PAYMENT_LABEL[f.payment_type]}</TableCell>
                      <TableCell>{f.installments ? `${f.installments}x` : "—"}</TableCell>
                      <TableCell>{Number(f.fee_percentage).toFixed(2)}%</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFee(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!fees || fees.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma taxa cadastrada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
