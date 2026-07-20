import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { recalcComandaTotals } from "@/lib/comanda";
import { PdvDialog } from "./PdvDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  comandaId: string | null;
  establishmentId: string;
  onClosed?: () => void;
}

export function ComandaSheet({ open, onOpenChange, comandaId, establishmentId, onClosed }: Props) {
  const qc = useQueryClient();
  const [discount, setDiscount] = useState("0");
  const [addServiceId, setAddServiceId] = useState("");
  const [pdvOpen, setPdvOpen] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["comanda", comandaId],
    enabled: !!comandaId && open,
    queryFn: async () => {
      const [c, items, services, professionals, clients] = await Promise.all([
        supabase.from("comandas").select("*").eq("id", comandaId!).single(),
        supabase.from("comanda_items").select("*").eq("comanda_id", comandaId!).order("created_at"),
        supabase.from("services").select("id, name, price, commission_solo").eq("establishment_id", establishmentId).eq("active", true).order("name"),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId).eq("active", true).order("name"),
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId),
      ]);
      return {
        comanda: c.data,
        items: items.data ?? [],
        services: services.data ?? [],
        professionals: professionals.data ?? [],
        clientName: (clients.data ?? []).find((cl: any) => cl.id === c.data?.client_id)?.name ?? "Cliente",
      };
    },
  });

  useEffect(() => {
    if (data?.comanda) setDiscount(String(data.comanda.discount ?? 0));
  }, [data?.comanda?.id]);

  const refresh = async () => {
    if (comandaId) await recalcComandaTotals(comandaId);
    refetch();
    qc.invalidateQueries({ queryKey: ["attendances"] });
  };

  const addItem = async () => {
    if (!addServiceId || !comandaId) return;
    const svc = (data?.services ?? []).find((s: any) => s.id === addServiceId);
    if (!svc) return;
    const unit_price = Number(svc.price ?? 0);
    const pct = Number(svc.commission_solo ?? 0);
    const { error } = await supabase.from("comanda_items").insert({
      establishment_id: establishmentId,
      comanda_id: comandaId,
      kind: "service",
      service_id: svc.id,
      name: svc.name,
      qty: 1,
      unit_price,
      total: unit_price,
      commission_percentage: pct,
      commission_amount: unit_price * (pct / 100),
    });
    if (error) { toast.error(error.message); return; }
    setAddServiceId("");
    refresh();
  };

  const updateItem = async (id: string, patch: any) => {
    const next: any = { ...patch };
    if (patch.qty !== undefined || patch.unit_price !== undefined) {
      const item = (data?.items ?? []).find((i: any) => i.id === id);
      const qty = Number(patch.qty ?? item?.qty ?? 1);
      const unit = Number(patch.unit_price ?? item?.unit_price ?? 0);
      next.total = qty * unit;
      next.commission_amount = next.total * (Number(item?.commission_percentage ?? 0) / 100);
    }
    await supabase.from("comanda_items").update(next).eq("id", id);
    refresh();
  };

  const removeItem = async (id: string) => {
    await supabase.from("comanda_items").delete().eq("id", id);
    refresh();
  };

  const saveDiscount = async () => {
    if (!comandaId) return;
    const v = Math.max(0, Number(discount) || 0);
    await supabase.from("comandas").update({ discount: v }).eq("id", comandaId);
    refresh();
  };

  const cancelComanda = async () => {
    if (!comandaId) return;
    if (!confirm("Cancelar comanda? O agendamento voltará para 'Agendado'.")) return;
    await supabase.from("comandas").update({ status: "canceled", closed_at: new Date().toISOString() }).eq("id", comandaId);
    if (data?.comanda?.appointment_id) {
      await supabase.from("appointments").update({ status: "scheduled" }).eq("id", data.comanda.appointment_id);
    }
    onOpenChange(false);
    onClosed?.();
  };

  const subtotal = useMemo(() => (data?.items ?? []).reduce((s: number, i: any) => s + Number(i.total ?? 0), 0), [data?.items]);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Comanda aberta</SheetTitle>
            <SheetDescription>{data?.clientName}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Itens</Label>
              {(data?.items ?? []).map((item: any) => (
                <div key={item.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm flex-1">{item.name}</div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                      <Input type="number" min="1" defaultValue={item.qty} className="h-8" onBlur={(e) => updateItem(item.id, { qty: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Preço</Label>
                      <Input type="number" step="0.01" defaultValue={item.unit_price} className="h-8" onBlur={(e) => updateItem(item.id, { unit_price: Number(e.target.value) })} />
                    </div>
                    <div className="text-right">
                      <Label className="text-[10px] text-muted-foreground">Total</Label>
                      <div className="h-8 flex items-center justify-end font-semibold">R$ {Number(item.total).toFixed(2)}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Profissional</Label>
                    <Select value={item.professional_id ?? ""} onValueChange={(v) => updateItem(item.id, { professional_id: v })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {(data?.professionals ?? []).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Adicionar item</Label>
              <ServiceSearchSelect
                services={(data?.services ?? []) as any}
                value=""
                onChange={async (id, svc) => {
                  if (!id || !svc || !comandaId) return;
                  const unit_price = Number(svc.price ?? 0);
                  const pct = Number((svc as any).commission_solo ?? 0);
                  const { error } = await supabase.from("comanda_items").insert({
                    establishment_id: establishmentId,
                    comanda_id: comandaId,
                    kind: "service",
                    service_id: svc.id,
                    name: svc.name,
                    qty: 1,
                    unit_price,
                    total: unit_price,
                    commission_percentage: pct,
                    commission_amount: unit_price * (pct / 100),
                  });
                  if (error) { toast.error(error.message); return; }
                  refresh();
                }}
                placeholder="Digite o nome do serviço..."
              />
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm flex-1">Desconto</Label>
                <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} onBlur={saveDiscount} className="h-8 w-28" />
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={cancelComanda}>Cancelar comanda</Button>
              <Button onClick={() => setPdvOpen(true)} disabled={(data?.items ?? []).length === 0}>
                <CreditCard className="h-4 w-4 mr-1" />Finalizar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {data?.comanda && (
        <PdvDialog
          open={pdvOpen}
          onOpenChange={setPdvOpen}
          comanda={data.comanda}
          items={data.items}
          establishmentId={establishmentId}
          total={total}
          onPaid={() => {
            setPdvOpen(false);
            onOpenChange(false);
            onClosed?.();
          }}
        />
      )}
    </>
  );
}
