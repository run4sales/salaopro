import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClientCombobox } from "@/components/ClientCombobox";
import { ServiceSearchSelect } from "@/components/ServiceSearchSelect";
import { syncSaleCommissions } from "@/lib/commissions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string | null;
  establishmentId: string;
  onSaved?: () => void;
}

const PAYMENT_METHODS = ["Dinheiro", "Pix", "Débito", "Crédito", "Crédito parcelado", "Transferência"];

export function EditSaleDialog({ open, onOpenChange, saleId, establishmentId, onSaved }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [profs, setProfs] = useState<Array<{ id: string; role: "solo" | "with_assistants" | "as_assistant" }>>([]);

  const { data } = useQuery({
    queryKey: ["edit-sale", saleId],
    enabled: !!saleId && open,
    queryFn: async () => {
      const [sale, services, professionals, machines, salePros] = await Promise.all([
        supabase.from("sales").select("*").eq("id", saleId!).single(),
        supabase.from("services").select("id, name, price, commission_solo").eq("establishment_id", establishmentId).eq("active", true).order("name"),
        supabase.from("professionals").select("id, name, commission_type, custom_percentage").eq("establishment_id", establishmentId).eq("active", true).order("name"),
        supabase.from("card_machines").select("id, name").eq("establishment_id", establishmentId).eq("active", true).order("name"),
        supabase.from("sale_professionals").select("*").eq("sale_id", saleId!),
      ]);
      return {
        sale: sale.data as any,
        services: (services.data ?? []) as any[],
        professionals: (professionals.data ?? []) as any[],
        machines: (machines.data ?? []) as any[],
        salePros: (salePros.data ?? []) as any[],
      };
    },
  });

  useEffect(() => {
    if (!data?.sale) return;
    const s = data.sale;
    setForm({
      client_id: s.client_id,
      service_id: s.service_id,
      amount: String(s.amount ?? ""),
      payment_method: s.payment_method ?? "Dinheiro",
      installments: s.installments != null ? String(s.installments) : "",
      card_machine_id: s.card_machine_id ?? "",
      fee_amount: String(s.fee_amount ?? "0"),
      notes: s.notes ?? "",
    });
    const initial = (data.salePros ?? []).map((sp: any) => ({ id: sp.professional_id, role: sp.role ?? "solo" }));
    if (initial.length === 0 && s.professional_id) initial.push({ id: s.professional_id, role: "solo" as const });
    setProfs(initial);
  }, [data?.sale?.id]);

  const service = useMemo(() => (data?.services ?? []).find((s: any) => s.id === form.service_id), [data, form.service_id]);
  const isInstallment = form.payment_method === "Crédito parcelado";

  const addProf = (id: string) => {
    if (!id || profs.some(p => p.id === id)) return;
    setProfs([...profs, { id, role: profs.length === 0 ? "solo" : "with_assistants" }]);
  };
  const removeProf = (id: string) => setProfs(profs.filter(p => p.id !== id));
  const updateProfRole = (id: string, role: any) => setProfs(profs.map(p => p.id === id ? { ...p, role } : p));

  const onSubmit = async () => {
    if (!saleId || !data?.sale) return;
    if (profs.length === 0) { toast.error("Selecione ao menos um profissional."); return; }
    const amount = Number(form.amount);
    if (!(amount > 0)) { toast.error("Valor inválido."); return; }

    setSaving(true);
    try {
      const fee = Number(form.fee_amount || 0);
      const credit = Number(data.sale.credit_used || 0);
      const cash = Math.max(0, amount - credit);
      const patch: any = {
        client_id: form.client_id,
        service_id: form.service_id,
        professional_id: profs[0].id,
        amount,
        gross_amount: amount,
        fee_amount: fee,
        net_amount: Number((cash - fee).toFixed(2)),
        paid_now: cash,
        payment_method: cash > 0 ? form.payment_method : "Crédito do cliente",
        installments: cash > 0 && isInstallment ? Number(form.installments || 0) || null : null,
        card_machine_id: cash > 0 && (form.payment_method || "").includes("Débito") || (form.payment_method || "").includes("Crédito") ? (form.card_machine_id || null) : null,
        notes: form.notes || null,
      };

      const { error } = await (supabase as any).rpc("admin_update_sale", { _sale_id: saleId, _patch: patch });
      if (error) throw error;

      // Re-sync commission split
      const svc = service;
      await syncSaleCommissions({
        establishmentId,
        saleId,
        serviceCommissionPercentage: Number(svc?.commission_solo ?? 0),
        baseAmount: amount,
        professionals: profs.map(p => ({ professional_id: p.id, role: p.role })),
      });

      toast.success("Venda atualizada.");
      qc.invalidateQueries();
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao atualizar venda.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar venda</DialogTitle>
          <DialogDescription>Alterações recalculam estoque, crédito, comissões e fluxo de caixa.</DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <div className="mt-1">
                <ClientCombobox
                  establishmentId={establishmentId}
                  value={form.client_id}
                  onChange={(id) => setForm({ ...form, client_id: id })}
                />
              </div>
            </div>

            <div>
              <Label>Serviço / Produto</Label>
              <ServiceSearchSelect
                services={data.services as any}
                value={form.service_id}
                onChange={(id, svc) => setForm({ ...form, service_id: id, amount: svc ? String(svc.price ?? form.amount) : form.amount })}
                placeholder="Buscar serviço ou produto..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isInstallment && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Parcelas</Label>
                  <Input type="number" min="2" max="24" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} />
                </div>
                <div>
                  <Label>Maquininha</Label>
                  <Select value={form.card_machine_id} onValueChange={(v) => setForm({ ...form, card_machine_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {data.machines.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label>Taxa (R$)</Label>
              <Input type="number" step="0.01" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Profissionais (comissão)</Label>
              {profs.map((p) => {
                const prof = data.professionals.find((x: any) => x.id === p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded border p-2">
                    <span className="text-sm flex-1 truncate">{prof?.name ?? p.id}</span>
                    <Select value={p.role} onValueChange={(v) => updateProfRole(p.id, v)}>
                      <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Sozinho</SelectItem>
                        <SelectItem value="with_assistants">Com assistentes</SelectItem>
                        <SelectItem value="as_assistant">Como assistente</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => removeProf(p.id)}>Remover</Button>
                  </div>
                );
              })}
              <Select value="" onValueChange={addProf}>
                <SelectTrigger><SelectValue placeholder="+ Adicionar profissional" /></SelectTrigger>
                <SelectContent>
                  {data.professionals.filter((p: any) => !profs.some(x => x.id === p.id)).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving || !data}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
