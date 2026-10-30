import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertCircle, ArrowUpRight, Pencil } from "lucide-react";
import { EditProfessionalDialog } from "@/components/users/EditProfessionalDialog";
import { EditUserDialog } from "@/components/users/EditUserDialog";
import { checkEmailDomain, validateEmail } from "@/lib/contactValidation";
import { ProfessionalColorPicker } from "@/components/users/ProfessionalColorPicker";

export default function StaffUsers() {
  const { profile, establishmentRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const subscription = useSubscription();
  const establishmentId = profile?.id;

  // Cadastro unificado da equipe
  const [name, setName] = useState("");
  const [withAccess, setWithAccess] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [onAgenda, setOnAgenda] = useState(true);
  const [calendarColor, setCalendarColor] = useState<string>("");
  const [commission, setCommission] = useState("40");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [editProf, setEditProf] = useState<any | null>(null);
  const [editUser, setEditUser] = useState<any | null>(null);

  const isAdmin = establishmentRole === "owner" || establishmentRole === "admin";
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const usersQuery = useQuery({
    queryKey: ["establishment-users", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_users")
        .select("id, user_id, role, active, professional_id, email, created_at")
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const servicesQuery = useQuery({
    queryKey: ["services-lite", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("kind", "service")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const professionalsQuery = useQuery({
    queryKey: ["professionals-manage", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, active, commission_percentage, commission_type, custom_percentage, daily_amount, calendar_color")
        .eq("establishment_id", establishmentId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const maxUsers = subscription.data?.plan?.max_users ?? null;
  const users = usersQuery.data ?? [];
  const professionalsList = professionalsQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const activeUserCount = users.filter((u: any) => u.active).length;
  const reachedUserLimit = maxUsers != null && activeUserCount >= maxUsers;

  const resetForm = () => {
    setName("");
    setEmail("");
    setEmailError("");
    setPassword("");
    setRole("employee");
    setWithAccess(true);
    setOnAgenda(true);
    setCalendarColor("");
    setCommission("40");
    setSelectedServices([]);
  };

  const invalidateTeam = () => {
    qc.invalidateQueries({ queryKey: ["establishment-users"] });
    qc.invalidateQueries({ queryKey: ["professionals-manage"] });
    qc.invalidateQueries({ queryKey: ["professionals"] });
    qc.invalidateQueries({ queryKey: ["agenda-professionals"] });
    qc.invalidateQueries({ queryKey: ["service_professionals"] });
  };

  const onCreate = async () => {
    if (!establishmentId || !name.trim()) return;

    if (withAccess) {
      const emailValidation = validateEmail(email, { required: true });
      if (!emailValidation.valid) { setEmailError(emailValidation.message ?? "E-mail inválido."); return; }
      if (reachedUserLimit) {
        toast({
          title: "Limite de usuários atingido",
          description: `Seu plano permite até ${maxUsers} usuário${maxUsers! > 1 ? "s" : ""}. Faça upgrade para adicionar mais.`,
          variant: "destructive",
        });
        return;
      }
      if (password.trim().length < 6) {
        toast({ title: "Senha inválida", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      if (withAccess) {
        const domainValidation = await checkEmailDomain(email);
        if (!domainValidation.valid) { setEmailError(domainValidation.message ?? "E-mail inválido."); return; }
        const { error } = await supabase.functions.invoke("create-staff-user", {
          body: {
            establishment_id: establishmentId,
            email: email.trim().toLowerCase(),
            password: password.trim(),
            name: name.trim(),
            role,
            service_ids: onAgenda ? selectedServices : [],
            calendar_color: onAgenda && calendarColor ? calendarColor : undefined,
          },
        });
        if (error) throw error;
        toast({ title: "Pessoa cadastrada", description: `${name.trim()} já pode acessar o sistema.` });
      } else {
        const { data: prof, error } = await supabase.from("professionals").insert({
          establishment_id: establishmentId,
          name: name.trim(),
          active: true,
          commission_percentage: Number(commission) || 0,
          ...(calendarColor ? { calendar_color: calendarColor } : {}),
        } as any).select("id").single();
        if (error) throw error;
        if (onAgenda && selectedServices.length && prof?.id) {
          const { error: spErr } = await supabase.from("service_professionals").insert(
            selectedServices.map((service_id) => ({ establishment_id: establishmentId, service_id, professional_id: prof.id })) as any
          );
          if (spErr) throw spErr;
        }
        toast({ title: "Profissional cadastrado", description: `${name.trim()} aparece na agenda, sem acesso ao sistema.` });
      }
      resetForm();
      invalidateTeam();
    } catch (e: any) {
      const msg = await extractEdgeFunctionError(e);
      if (/Limite de .* usu/i.test(msg)) {
        toast({ title: "Limite de usuários atingido", description: "Faça upgrade do seu plano para adicionar mais usuários.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao cadastrar", description: msg, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleUserActive = async (id: string, active: boolean) => {
    const { error } = await (supabase as any)
      .from("establishment_users")
      .update({ active: !active })
      .eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["establishment-users"] });
  };

  const removeUser = async (id: string) => {
    const { error } = await (supabase as any).from("establishment_users").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    invalidateTeam();
  };

  const toggleProfessional = async (id: string, active: boolean) => {
    const { error } = await supabase.from("professionals").update({ active: !active }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    invalidateTeam();
  };

  const removeProfessional = async (id: string) => {
    const linkedUser = users.find((u: any) => u.professional_id === id);
    if (linkedUser) {
      return toast({
        title: "Profissional vinculado a um usuário",
        description: "Remova primeiro o acesso ao sistema vinculado a este profissional.",
        variant: "destructive",
      });
    }
    if (!confirm("Excluir este profissional? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("professionals").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    invalidateTeam();
  };

  // Lista unificada: cada profissional uma vez, com o acesso vinculado (se houver)
  const teamRows = professionalsList.map((p: any) => ({
    professional: p,
    user: users.find((u: any) => u.professional_id === p.id) ?? null,
  }));
  const usersWithoutProfessional = users.filter((u: any) => !u.professional_id);

  return (
    <div className="space-y-6">
      {reachedUserLimit && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Limite de usuários atingido</p>
            <p className="text-sm text-muted-foreground">
              Você atingiu o limite de {maxUsers} usuário{maxUsers! > 1 ? "s" : ""} do seu plano. Faça upgrade para adicionar mais.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("/planos")}>
            Fazer upgrade <ArrowUpRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Adicionar pessoa à equipe</span>
            {maxUsers != null && (
              <span className="text-xs font-normal text-muted-foreground">
                {activeUserCount} / {maxUsers} acessos
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cadastre quem trabalha no salão em um único lugar: defina se a pessoa acessa o sistema,
            se atende na agenda e quais serviços ela executa.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Maria Silva" />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Dar acesso ao sistema</span>
              <Switch checked={withAccess} onCheckedChange={setWithAccess} />
            </label>
            {withAccess && (
              <div className="grid md:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label>Email de acesso</Label>
                  <Input
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                    placeholder="maria@exemplo.com"
                    type="email"
                    aria-invalid={!!emailError}
                  />
                  {emailError && <p className="mt-1 text-sm text-destructive">{emailError}</p>}
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6+ caracteres, letras e números"
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Evite senhas comuns ou fáceis de adivinhar.</p>
                </div>
                <div>
                  <Label>Perfil de acesso</Label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Funcionário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Funcionário vê apenas a própria agenda e atendimentos. Administrador gerencia o salão.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Atende na agenda (executa serviços)</span>
              <Switch checked={onAgenda} onCheckedChange={setOnAgenda} />
            </label>
            {onAgenda && (
              <div className="space-y-3 pt-1">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Comissão padrão (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      disabled={withAccess}
                    />
                    {withAccess && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        A comissão pode ser ajustada depois, em Editar.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="mb-2 block">Cor na agenda</Label>
                    <ProfessionalColorPicker value={calendarColor} onChange={setCalendarColor} />
                  </div>
                </div>
                <div>
                  <Label>Serviços que executa</Label>
                  <div className="grid sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                    {services.map((s: any) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedServices.includes(s.id)}
                          onCheckedChange={(v) =>
                            setSelectedServices((prev) =>
                              v ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                            )
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                    {!services.length && (
                      <p className="text-sm text-muted-foreground">Nenhum serviço ativo cadastrado.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button onClick={onCreate} disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Cadastrar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
          <p className="text-sm text-muted-foreground">
            Todas as pessoas do salão: com ou sem acesso ao sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamRows.map(({ professional: p, user: u }: any) => (
            <div key={p.id} className="border rounded p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.calendar_color }} />
                  {p.name}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                  {u ? (
                    <>
                      <Badge variant="secondary">{u.role === "admin" ? "Administrador" : "Funcionário"}</Badge>
                      <span>{u.email ?? "Email não disponível"}</span>
                      <span>•</span>
                      <span>{u.active ? "Acesso ativo" : "Acesso bloqueado"}</span>
                    </>
                  ) : (
                    <Badge variant="outline">Sem acesso ao sistema</Badge>
                  )}
                  <span>•</span>
                  <span>{p.active ? "Na agenda" : "Fora da agenda"}</span>
                  <span>•</span>
                  <span>Comissão {Number(p.commission_percentage ?? 0)}%</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {u ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditUser({ ...u, professional: p })}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleUserActive(u.id, u.active)}>
                      {u.active ? "Bloquear acesso" : "Desbloquear acesso"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeUser(u.id)}>
                      Remover acesso
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditProf(p)}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleProfessional(p.id, p.active)}>
                      {p.active ? "Inativar" : "Ativar"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeProfessional(p.id)}>
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {usersWithoutProfessional.map((u: any) => (
            <div key={u.id} className="border rounded p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-medium">{u.email ?? "Usuário sem profissional"}</div>
                <div className="text-sm text-muted-foreground">
                  {u.role === "admin" ? "Administrador" : "Funcionário"} • {u.active ? "Acesso ativo" : "Acesso bloqueado"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleUserActive(u.id, u.active)}>
                  {u.active ? "Bloquear acesso" : "Desbloquear acesso"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => removeUser(u.id)}>
                  Remover acesso
                </Button>
              </div>
            </div>
          ))}

          {!teamRows.length && !usersWithoutProfessional.length && (
            <div className="text-sm text-muted-foreground">Ninguém cadastrado na equipe ainda.</div>
          )}
        </CardContent>
      </Card>

      <EditProfessionalDialog
        open={!!editProf}
        onOpenChange={(v) => !v && setEditProf(null)}
        professional={editProf}
      />
      <EditUserDialog
        open={!!editUser}
        onOpenChange={(v) => !v && setEditUser(null)}
        establishmentId={establishmentId ?? ""}
        user={editUser}
      />
    </div>
  );
}
