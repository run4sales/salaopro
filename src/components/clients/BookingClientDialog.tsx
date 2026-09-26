import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkEmailDomain, normalizeEmail, normalizePhone, validateEmail, validatePhone } from "@/lib/contactValidation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  onCreated: (client: { id: string; name: string; phone: string | null }) => void;
}

const fields = [
  ["phone", "Telefone"], ["whatsapp", "WhatsApp"], ["email", "E-mail"],
  ["cpf", "CPF"], ["nickname", "Apelido"], ["instagram", "Instagram"],
  ["birth_date", "Nascimento"], ["address", "Endereço"],
  ["gender", "Gênero"], ["acquisition_source", "Como chegou"],
] as const;

type Field = typeof fields[number][0] | "name" | "notes";
type Form = Record<Field, string>;
const blank: Form = {
  name: "", phone: "", whatsapp: "", email: "", cpf: "", nickname: "", instagram: "",
  birth_date: "", address: "", gender: "", acquisition_source: "", notes: "",
};

export function BookingClientDialog({ open, onOpenChange, establishmentId, onCreated }: Props) {
  const [form, setForm] = useState<Form>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: visible } = useQuery({
    queryKey: ["booking-client-fields", establishmentId],
    enabled: open && !!establishmentId,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("client_fields").eq("establishment_id", establishmentId).maybeSingle();
      return (data?.client_fields ?? {}) as Record<string, boolean>;
    },
  });
  const show = (field: Field) => visible?.[field] !== false && (field !== "whatsapp" && field !== "cpf" && field !== "address" || visible?.[field] === true);
  const update = (field: Field, value: string) => { setForm(current => ({ ...current, [field]: value })); setError(""); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !form.name.trim()) return;
    for (const field of ["phone", "whatsapp"] as const) {
      const validation = validatePhone(form[field]);
      if (!validation.valid) { setError(`${field === "phone" ? "Telefone" : "WhatsApp"}: ${validation.message}`); return; }
    }
    const emailValidation = validateEmail(form.email);
    if (!emailValidation.valid) { setError(emailValidation.message ?? "E-mail inválido."); return; }
    setSaving(true);
    try {
      if (form.email) {
        const domain = await checkEmailDomain(form.email);
        if (!domain.valid) { setError(domain.message ?? "E-mail inválido."); return; }
      }
      const { data, error: insertError } = await supabase.from("clients").insert({
        establishment_id: establishmentId,
        name: form.name.trim(),
        phone: form.phone ? normalizePhone(form.phone) : null,
        whatsapp: form.whatsapp ? normalizePhone(form.whatsapp) : null,
        email: form.email ? normalizeEmail(form.email) : null,
        cpf: form.cpf || null, nickname: form.nickname || null, instagram: form.instagram || null,
        birth_date: form.birth_date || null, address: form.address || null,
        gender: form.gender || null, acquisition_source: form.acquisition_source || null,
        notes: form.notes || null,
      }).select("id, name, phone").single();
      if (insertError) throw insertError;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clients-combobox", establishmentId] }),
        qc.invalidateQueries({ queryKey: ["clients", establishmentId] }),
      ]);
      setForm(blank);
      setError("");
      onOpenChange(false);
      onCreated(data);
      toast({ title: "Cliente cadastrado" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar o cliente.");
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Novo cliente</DialogTitle><DialogDescription>Somente o nome é obrigatório.</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="booking-client-name">Nome *</Label><Input id="booking-client-name" required value={form.name} onChange={event => update("name", event.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([field, label]) => show(field) && <div className="space-y-2" key={field}>
            <Label htmlFor={`booking-client-${field}`}>{label}</Label>
            {field === "gender" || field === "acquisition_source" ? <select id={`booking-client-${field}`} value={form[field]} onChange={event => update(field, event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
              <option value="">Selecione...</option>
              {(field === "gender" ? [["masculino", "Masculino"], ["feminino", "Feminino"], ["outro", "Outro"]] : [["indicacao", "Indicação"], ["redes_sociais", "Redes sociais"], ["google", "Google"], ["trafego_pago", "Tráfego pago"], ["outros", "Outros"]]).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select> : <Input id={`booking-client-${field}`} type={field === "email" ? "email" : field === "birth_date" ? "date" : "text"} inputMode={field === "phone" || field === "whatsapp" ? "tel" : field === "cpf" ? "numeric" : undefined} value={form[field]} onChange={event => update(field, event.target.value)} />}
          </div>)}
        </div>
        {show("notes") && <div className="space-y-2"><Label htmlFor="booking-client-notes">Observações</Label><Textarea id="booking-client-notes" value={form.notes} onChange={event => update("notes", event.target.value)} /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving} className="w-full">{saving ? "Salvando..." : "Cadastrar cliente"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}