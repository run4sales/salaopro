import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Professional {
  id: string;
  name: string;
  active: boolean;
  commission_percentage?: number | null;
  commission_type?: string | null;
  custom_percentage?: number | null;
  daily_amount?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  professional: Professional | null;
}

export function EditProfessionalDialog({ open, onOpenChange, professional }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [commissionType, setCommissionType] = useState("per_service");
  const [commissionPercentage, setCommissionPercentage] = useState("0");
  const [customPercentage, setCustomPercentage] = useState("0");
  const [dailyAmount, setDailyAmount] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!professional) return;
    setName(professional.name ?? "");
    setActive(professional.active ?? true);
    setCommissionType(professional.commission_type ?? "per_service");
    setCommissionPercentage(String(professional.commission_percentage ?? 0));
    setCustomPercentage(String(professional.custom_percentage ?? 0));
    setDailyAmount(String(professional.daily_amount ?? 0));
  }, [professional]);

  const onSave = async () => {
    if (!professional) return;
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("professionals")
      .update({
        name: name.trim(),
        active,
        commission_type: commissionType,
        commission_percentage: Number(commissionPercentage) || 0,
        custom_percentage: Number(customPercentage) || 0,
        daily_amount: Number(dailyAmount) || 0,
      } as any)
      .eq("id", professional.id);
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Profissional atualizado" });
    qc.invalidateQueries({ queryKey: ["professionals-manage"] });
    qc.invalidateQueries({ queryKey: ["professionals"] });
    qc.invalidateQueries({ queryKey: ["agenda-professionals"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar profissional</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="font-medium text-sm">Ativo</div>
              <div className="text-xs text-muted-foreground">Aparece na agenda e relatórios</div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div>
            <Label>Tipo de comissão</Label>
            <Select value={commissionType} onValueChange={setCommissionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_service">Por serviço (% padrão)</SelectItem>
                <SelectItem value="custom">Personalizada (%)</SelectItem>
                <SelectItem value="daily">Diária (valor fixo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Comissão %</Label>
              <Input type="number" min="0" max="100" step="0.01"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(e.target.value)} />
            </div>
            <div>
              <Label>% personalizada</Label>
              <Input type="number" min="0" max="100" step="0.01"
                value={customPercentage}
                onChange={(e) => setCustomPercentage(e.target.value)} />
            </div>
            <div>
              <Label>Diária R$</Label>
              <Input type="number" min="0" step="0.01"
                value={dailyAmount}
                onChange={(e) => setDailyAmount(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
