import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkEmailDomain, validateEmail } from "@/lib/contactValidation";
import { ProfessionalColorPicker } from "@/components/users/ProfessionalColorPicker";
import { DEFAULT_PROFESSIONAL_CALENDAR_COLOR } from "@/lib/professionalCalendarColors";

interface UserRow {
  id: string;
  user_id: string;
  role: "admin" | "employee" | string;
  professional_id?: string | null;
  professional?: { name?: string; calendar_color?: string | null } | null;
  email?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  user: UserRow | null;
}

export function EditUserDialog({ open, onOpenChange, establishmentId, user }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [calendarColor, setCalendarColor] = useState<string>(DEFAULT_PROFESSIONAL_CALENDAR_COLOR);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const servicesQuery = useQuery({
    queryKey: ["services-lite", establishmentId],
    enabled: open && !!establishmentId,
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

  useEffect(() => {
    if (!user || !open) return;
    setName(user.professional?.name ?? "");
    setRole((user.role as any) === "admin" ? "admin" : "employee");
    setEmail(user.email ?? "");
    setEmailError("");
    setPassword("");
    setCalendarColor(user.professional?.calendar_color ?? DEFAULT_PROFESSIONAL_CALENDAR_COLOR);
    setSelectedServices([]);
    if (user.professional_id) {
      supabase
        .from("service_professionals")
        .select("service_id")
        .eq("establishment_id", establishmentId)
        .eq("professional_id", user.professional_id)
        .then(({ data }) => setSelectedServices((data ?? []).map((r: any) => r.service_id)));
    }
  }, [user, open, establishmentId]);

  const onSave = async () => {
    if (!user) return;
    const emailValidation = validateEmail(email, { required: true });
    if (!emailValidation.valid) { setEmailError(emailValidation.message ?? "E-mail inválido."); return; }
    if (password && password.length < 6) {
      toast({ title: "Senha inválida", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const domainValidation = await checkEmailDomain(email);
      if (!domainValidation.valid) { setEmailError(domainValidation.message ?? "E-mail inválido."); return; }
      const { error } = await supabase.functions.invoke("update-staff-user", {
        body: {
          establishment_id: establishmentId,
          membership_id: user.id,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          password: password || undefined,
          role,
          calendar_color: calendarColor,
          service_ids: selectedServices,
        },
      });
      if (error) throw error;
      toast({ title: "Usuário atualizado" });
      qc.invalidateQueries({ queryKey: ["establishment-users"] });
      qc.invalidateQueries({ queryKey: ["professionals-manage"] });
      qc.invalidateQueries({ queryKey: ["service_professionals"] });
      onOpenChange(false);
    } catch (e: any) {
      const msg = await extractEdgeFunctionError(e);
      toast({ title: "Erro ao atualizar usuário", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome do profissional</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <ProfessionalColorPicker value={calendarColor} onChange={setCalendarColor} />

          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="usuario@exemplo.com"
              aria-invalid={!!emailError}
            />
            {emailError && <p className="mt-1 text-sm text-destructive">{emailError}</p>}
          </div>

          <div>
            <Label>Nova senha (opcional)</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
            />
          </div>

          <div>
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Funcionário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {user?.professional_id && (
            <div>
              <Label>Serviços que este profissional executa</Label>
              <div className="grid sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                {(servicesQuery.data ?? []).map((s: any) => (
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
                {!servicesQuery.isLoading && !(servicesQuery.data ?? []).length && (
                  <p className="text-sm text-muted-foreground">Nenhum serviço ativo cadastrado.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
