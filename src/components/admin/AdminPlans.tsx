import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "./shared";

type Plan = {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  max_clients: number | null;
  max_users: number | null;
  active: boolean;
  display_order: number;
};

export default function AdminPlans() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);

  const plans = useQuery({
    queryKey: ["admin-plans-full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_plans")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as Plan[];
    },
  });

  async function save() {
    if (!editing?.name || editing.monthly_price == null) {
      toast.error("Preencha nome e preço.");
      return;
    }
    const payload: any = {
      name: editing.name,
      slug: (editing.slug || editing.name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      monthly_price: Number(editing.monthly_price),
      max_clients: editing.max_clients ?? null,
      max_users: editing.max_users ?? null,
      active: editing.active ?? true,
      display_order: editing.display_order ?? 0,
    };
    const res = editing.id
      ? await (supabase as any).from("subscription_plans").update(payload).eq("id", editing.id)
      : await (supabase as any).from("subscription_plans").insert(payload);
    if (res.error) {
      toast.error("Não foi possível salvar o plano.");
      return;
    }
    toast.success("Plano salvo");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-plans-full"] });
    qc.invalidateQueries({ queryKey: ["admin-plans"] });
  }

  async function toggleActive(p: Plan) {
    await (supabase as any).from("subscription_plans").update({ active: !p.active }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["admin-plans-full"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Catálogo de planos disponíveis para empresas.</p>
        <Button onClick={() => setEditing({ active: true, display_order: (plans.data?.length ?? 0) + 1 })}>
          <Plus className="h-4 w-4 mr-1" /> Novo plano
        </Button>
      </div>

      <Card className="bg-card/60 border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Preço/mês</TableHead>
                  <TableHead>Máx. clientes</TableHead>
                  <TableHead>Máx. usuários</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.data?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{fmtBRL(p.monthly_price)}</TableCell>
                    <TableCell>{p.max_clients ?? "Ilimitado"}</TableCell>
                    <TableCell>{p.max_users ?? "Ilimitado"}</TableCell>
                    <TableCell><Switch checked={p.active} onCheckedChange={() => toggleActive(p)} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label>Preço mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editing?.monthly_price ?? ""}
                onChange={(e) => setEditing({ ...editing, monthly_price: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Máx. clientes (vazio = ilimitado)</Label>
                <Input
                  type="number"
                  value={editing?.max_clients ?? ""}
                  onChange={(e) => setEditing({ ...editing, max_clients: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Máx. usuários</Label>
                <Input
                  type="number"
                  value={editing?.max_users ?? ""}
                  onChange={(e) => setEditing({ ...editing, max_users: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div>
              <Label>Ordem de exibição</Label>
              <Input
                type="number"
                value={editing?.display_order ?? 0}
                onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing?.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              <Label>Plano ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
