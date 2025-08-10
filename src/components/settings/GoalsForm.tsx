import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface GoalsFormProps { establishmentId: string }

export function GoalsForm({ establishmentId }: GoalsFormProps) {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<number>(now.getMonth()+1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["goal", establishmentId, month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals").select("id, target_amount, current_amount")
        .eq("establishment_id", establishmentId).eq("month", month).eq("year", year).maybeSingle();
      if (error) throw error;
      return data as { id: string; target_amount: number; current_amount: number } | null;
    }
  });

  useEffect(() => {
    if (data) setTarget(String(Number(data.target_amount||0)));
    else setTarget("");
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (data?.id) {
        const { error } = await supabase.from("goals").update({ target_amount: Number(target||0) }).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert({ establishment_id: establishmentId, month, year, target_amount: Number(target||0) });
        if (error) throw error;
      }
      toast.success("Meta salva!"); await refetch();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao salvar meta."); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Mês</Label>
          <Select value={String(month)} onValueChange={(v)=>setMonth(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({length:12}).map((_,i)=> (
                <SelectItem key={i+1} value={String(i+1)}>{String(i+1).padStart(2,'0')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ano</Label>
          <Select value={String(year)} onValueChange={(v)=>setYear(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({length:5}).map((_,i)=> {
                const y = now.getFullYear()-1 + i; return (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Meta (R$)</Label>
          <Input type="number" step="0.01" min="0" value={target} onChange={(e)=>setTarget(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border p-3 text-sm">
        <div className="text-muted-foreground">Realizado no mês</div>
        <div className="text-lg font-semibold">{isLoading || !data ? "R$ 0,00" : (Number(data.current_amount||0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" className="min-w-40" disabled={saving}>{saving ? "Salvando..." : "Salvar meta"}</Button>
      </div>
    </form>
  );
}
