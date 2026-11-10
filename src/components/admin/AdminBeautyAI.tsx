import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type BeautyAIRow = {
  establishment_id: string;
  business_name: string;
  plan_slug: string | null;
  subscription_state: string | null;
  enabled: boolean;
  monthly_limit: number;
  usage_count: number;
  total_messages: number;
  last_used_at: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  individual: "Individual",
  profissional: "Profissional",
  empresa: "Empresa",
};

const ELIGIBLE_PLANS = new Set(["profissional", "empresa"]);

export default function AdminBeautyAI() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [limits, setLimits] = useState<Record<string, string>>({});

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-beauty-ai"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_beauty_ai_report");
      if (error) throw error;
      return (data ?? []) as unknown as BeautyAIRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: { establishmentId: string; enabled: boolean; monthlyLimit?: number }) => {
      const { error } = await supabase.rpc("admin_set_beauty_ai_access", {
        p_establishment: input.establishmentId,
        p_enabled: input.enabled,
        p_monthly_limit: input.monthlyLimit ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-beauty-ai"] });
      toast({ title: "Acesso à Beauty IA atualizado" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary-glow" />
        <div>
          <h2 className="text-lg font-semibold">Acesso à Beauty IA</h2>
          <p className="text-sm text-muted-foreground">
            Libere o copiloto por estabelecimento e defina o limite mensal de interações. Disponível apenas para os
            planos Profissional e Empresa.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estabelecimento</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Beauty IA</TableHead>
              <TableHead>Limite mensal</TableHead>
              <TableHead>Consumo</TableHead>
              <TableHead>Último uso</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((row) => {
              const eligible = row.plan_slug ? ELIGIBLE_PLANS.has(row.plan_slug) : false;
              const limitValue = limits[row.establishment_id] ?? String(row.monthly_limit);
              const limitChanged = Number(limitValue) !== row.monthly_limit && limitValue !== "";
              return (
                <TableRow key={row.establishment_id}>
                  <TableCell className="font-medium">{row.business_name}</TableCell>
                  <TableCell>
                    <Badge variant={eligible ? "default" : "outline"}>
                      {row.plan_slug ? PLAN_LABELS[row.plan_slug] ?? row.plan_slug : "Sem plano"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.subscription_state ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={row.enabled}
                      disabled={!eligible || saveMutation.isPending}
                      onCheckedChange={(checked) =>
                        saveMutation.mutate({ establishmentId: row.establishment_id, enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={limitValue}
                      onChange={(e) => setLimits((prev) => ({ ...prev, [row.establishment_id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.usage_count} / {row.monthly_limit}
                    <span className="block text-xs text-muted-foreground">{row.total_messages} mensagens</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.last_used_at ? new Date(row.last_used_at).toLocaleString("pt-BR") : "Nunca usou"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!limitChanged || saveMutation.isPending}
                      onClick={() =>
                        saveMutation.mutate({
                          establishmentId: row.establishment_id,
                          enabled: row.enabled,
                          monthlyLimit: Number(limitValue),
                        })
                      }
                    >
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!rows?.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum estabelecimento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
