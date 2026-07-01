import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ShoppingBag, Play, UserX } from "lucide-react";
import { ComandaSheet } from "@/components/comanda/ComandaSheet";

function elapsed(from: string) {
  const ms = Date.now() - new Date(from).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function EmployeeAttendances() {
  const { user, profile, establishmentRole, professionalId } = useAuth();
  const establishmentIdFromProfile = profile?.id as string | undefined;
  const isEmployee = establishmentRole === "employee";
  const contextQuery = useQuery({
    queryKey: ["employee-attendance-context", user?.id, establishmentIdFromProfile, professionalId],
    enabled: isEmployee && !!user?.id && (!establishmentIdFromProfile || !professionalId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_users")
        .select("establishment_id, professional_id")
        .eq("user_id", user!.id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data as { establishment_id?: string | null; professional_id?: string | null } | null;
    },
  });

  const establishmentId = establishmentIdFromProfile ?? contextQuery.data?.establishment_id ?? undefined;
  const effectiveProfessionalId = professionalId ?? contextQuery.data?.professional_id ?? null;
  const effectiveEmployeeWithoutProfessional = isEmployee && !effectiveProfessionalId;
  const qc = useQueryClient();
  const [selectedComanda, setSelectedComanda] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { document.title = "Atendimentos | Beauty Core"; }, []);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);

  const { data } = useQuery({
    queryKey: ["attendances", establishmentId, isEmployee, effectiveProfessionalId],
    enabled: !!establishmentId && (!isEmployee || !!effectiveProfessionalId),
    queryFn: async () => {
      const comandasQuery = supabase
        .from("comandas")
        .select("*")
        .eq("establishment_id", establishmentId!)
        .in("status", ["open", "awaiting_payment"])
        .order("opened_at");

      const comandasRes = await comandasQuery;
      const comandas = comandasRes.data ?? [];
      const appointmentIds = [...new Set(comandas.map((c: any) => c.appointment_id).filter(Boolean))];

      const [apptsRes, profsRes] = await Promise.all([
        appointmentIds.length
          ? supabase.from("appointments").select("id, professional_id, service_id, appointment_date").eq("establishment_id", establishmentId!).in("id", appointmentIds)
          : Promise.resolve({ data: [], error: null }),
        isEmployee && effectiveProfessionalId
          ? supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId!).eq("id", effectiveProfessionalId)
          : supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId!),
      ]);

      const apptMap = new Map((apptsRes.data ?? []).map((a: any) => [a.id, a]));
      const filteredComandas = isEmployee && effectiveProfessionalId
        ? comandas.filter((c: any) => {
            if (c.professional_id === effectiveProfessionalId) return true;
            const appt: any = apptMap.get(c.appointment_id);
            return appt?.professional_id === effectiveProfessionalId;
          })
        : comandas;
      const clientIds = [...new Set(filteredComandas.map((c: any) => c.client_id).filter(Boolean))];
      const clientsRes = clientIds.length
        ? await supabase.from("clients").select("id, name").eq("establishment_id", establishmentId!).in("id", clientIds)
        : { data: [], error: null };

      const clientMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
      const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.name]));
      return { comandas: filteredComandas, apptMap, clientMap, profMap };
    },
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
    return data.comandas.map((c: any) => {
      const appt: any = c.appointment_id ? data.apptMap.get(c.appointment_id) : null;
      return {
        ...c,
        clientName: data.clientMap.get(c.client_id) ?? "Cliente",
        professionalName: appt ? data.profMap.get(appt.professional_id) : null,
      };
    });
  }, [data, tick]);

  if (!establishmentId) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

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

      {cards.length === 0 ? (
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
