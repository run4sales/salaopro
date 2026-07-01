import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, ShoppingBag, Play, UserX } from "lucide-react";
import { ComandaSheet } from "@/components/comanda/ComandaSheet";

function elapsed(from: string) {
  const ms = Date.now() - new Date(from).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

const EMPLOYEE_QUERY_TIMEOUT_MS = 12000;

function withTimeout<T = any>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} demorou para responder`)), EMPLOYEE_QUERY_TIMEOUT_MS);
    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

export default function EmployeeAttendances() {
  const { user, profile, establishmentRole, professionalId } = useAuth();
  const establishmentIdFromProfile = profile?.id as string | undefined;
  const isEmployee = establishmentRole === "employee";
  const contextQuery = useQuery({
    queryKey: ["employee-attendance-context", user?.id, establishmentIdFromProfile, professionalId],
    enabled: isEmployee && !!user?.id && !establishmentIdFromProfile,
    queryFn: async () => {
      const { data, error } = await withTimeout<any>(
        (supabase as any).rpc("get_my_employee_context"),
        "Busca do vínculo do funcionário"
      );
      if (error) throw error;
      return data as { establishment_id?: string | null; professional_id?: string | null } | null;
    },
    retry: false,
  });

  const establishmentId = establishmentIdFromProfile ?? contextQuery.data?.establishment_id ?? undefined;
  const effectiveProfessionalId = professionalId ?? contextQuery.data?.professional_id ?? null;
  const effectiveEmployeeWithoutProfessional = isEmployee && !effectiveProfessionalId;
  const qc = useQueryClient();
  const [selectedComanda, setSelectedComanda] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { document.title = "Atendimentos | Beauty Core"; }, []);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);

  const { data, isLoading: attendancesLoading, isError: attendancesError } = useQuery({
    queryKey: ["attendances", establishmentId, isEmployee, effectiveProfessionalId],
    enabled: !!establishmentId && (!isEmployee || !!effectiveProfessionalId),
    queryFn: async () => {
      const { data: payload, error } = await withTimeout<any>(
        (supabase as any).rpc("get_my_employee_attendances"),
        "Busca dos atendimentos do funcionário"
      );
      if (error) throw error;
      return { attendances: payload?.attendances ?? [] };
    },
    retry: false,
  });

  // Realtime subscription
  useEffect(() => {
    if (!establishmentId) return;
    const channel = supabase
      .channel("attendances-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, () => qc.invalidateQueries({ queryKey: ["attendances"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => qc.invalidateQueries({ queryKey: ["attendances"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [establishmentId, qc]);

  const cards = useMemo(() => {
    if (!data) return [];
    return data.attendances.map((c: any) => ({
      ...c,
      clientName: c.client_name ?? "Cliente",
      professionalName: c.professional_name ?? null,
    }));
  }, [data, tick]);

  if (contextQuery.isError) {
    return (
      <main className="container mx-auto px-4 py-6">
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <div className="font-medium text-foreground">Não foi possível carregar seu vínculo</div>
          <p className="mt-1">Tente atualizar a tela. Se continuar, peça para a administração revisar seu usuário profissional.</p>
        </CardContent></Card>
      </main>
    );
  }

  if (!establishmentId) return <div className="p-6 text-sm text-muted-foreground">Carregando vínculo do funcionário...</div>;

  if (effectiveEmployeeWithoutProfessional) {
    return (
      <main className="container mx-auto px-4 py-6">
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <UserX className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <div className="font-medium text-foreground">Perfil funcionário sem profissional vinculado</div>
          <p className="mt-1">Peça para a administração vincular seu usuário a um profissional para visualizar seus atendimentos.</p>
        </CardContent></Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Atendimentos em andamento</h1>
        <p className="text-sm text-muted-foreground">Comandas abertas, prontas para adição de itens e pagamento.</p>
      </header>

      {attendancesLoading ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando seus atendimentos...</CardContent></Card>
      ) : attendancesError ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <div className="font-medium text-foreground">Não foi possível carregar seus atendimentos</div>
          <p className="mt-1">Atualize a tela ou avise a administração caso o problema continue.</p>
        </CardContent></Card>
      ) : cards.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-60" />
          {isEmployee ? "Você ainda não possui atendimentos agendados." : "Nenhum atendimento em andamento."}<br />
          {!isEmployee && "Inicie um atendimento na Agenda para abrir uma comanda."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((c: any) => (
            <Card key={c.id} className="hover:border-primary transition cursor-pointer" onClick={() => setSelectedComanda(c.id)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.clientName}</div>
                    {c.professionalName && <div className="text-xs text-muted-foreground truncate">com {c.professionalName}</div>}
                  </div>
                  <Badge variant={c.status === "awaiting_payment" ? "default" : "secondary"}>
                    {c.status === "awaiting_payment" ? "Aguard. pagto." : "Em atendimento"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {elapsed(c.opened_at)}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-bold text-primary">R$ {Number(c.total ?? 0).toFixed(2)}</div>
                </div>
                <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); setSelectedComanda(c.id); }}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Abrir comanda
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ComandaSheet
        open={!!selectedComanda}
        onOpenChange={(v) => !v && setSelectedComanda(null)}
        comandaId={selectedComanda}
        establishmentId={establishmentId}
        onClosed={() => qc.invalidateQueries({ queryKey: ["attendances"] })}
      />
    </main>
  );
}
