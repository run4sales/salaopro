import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function Users() {
  const { profile, establishmentRole } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const establishmentId = profile?.id;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isAdmin = establishmentRole === "owner" || establishmentRole === "admin";
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const usersQuery = useQuery({
    queryKey: ["establishment-users", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_users")
        .select("id, user_id, role, active, professional_id, created_at")
        .eq("establishment_id", establishmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const profIds = (data ?? []).map((u: any) => u.professional_id).filter(Boolean);
      const { data: profs } = await supabase
        .from("professionals")
        .select("id, name, active")
        .in("id", profIds.length ? profIds : ["00000000-0000-0000-0000-000000000000"]);

      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((u: any) => ({
        ...u,
        professional: u.professional_id ? profMap.get(u.professional_id) : null,
      }));
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
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const onCreate = async () => {
    if (!establishmentId || !email.trim() || !name.trim()) return;
    if (password.trim().length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: created, error } = await supabase.functions.invoke("create-staff-user", {
        body: {
          establishment_id: establishmentId,
          email: email.trim().toLowerCase(),
          password: password.trim(),
          name: name.trim(),
          role,
        },
      });
      if (error) throw error;

      if (created?.professional_id && selectedServices.length) {
        const rows = selectedServices.map((service_id) => ({
          establishment_id: establishmentId,
          service_id,
          professional_id: created.professional_id,
        }));
        await supabase.from("service_professionals").insert(rows as any);
      }

      toast({ title: "Usuário vinculado" });
      setEmail("");
      setName("");
      setPassword("");
      setRole("employee");
      setSelectedServices([]);
      qc.invalidateQueries({ queryKey: ["establishment-users"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await (supabase as any)
      .from("establishment_users")
      .update({ active: !active })
      .eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["establishment-users"] });
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("establishment_users").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["establishment-users"] });
  };

  const services = servicesQuery.data ?? [];
  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Email do usuário</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
            />
          </div>

          <div>
            <Label>Nome profissional</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          </div>

          <div>
            <Label>Senha do usuário</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Funcionário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Serviços vinculados</Label>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
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
            </div>
          </div>

          <div className="md:col-span-2">
            <Button onClick={onCreate} disabled={saving}>
              {saving ? "Salvando..." : "Criar usuário"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((u: any) => (
            <div key={u.id} className="border rounded p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{u.professional?.name ?? "Sem profissional"}</div>
                <div className="text-sm text-muted-foreground">
                  Perfil: {u.role === "admin" ? "Administrador" : "Funcionário"} •{" "}
                  {u.active ? "Ativo" : "Bloqueado"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleActive(u.id, u.active)}>
                  {u.active ? "Bloquear" : "Desbloquear"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(u.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}

          {!users.length && (
            <div className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}