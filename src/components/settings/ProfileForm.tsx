import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileFormProps {
  profile: {
    id: string;
    business_name: string;
    owner_name: string;
    phone: string;
    email: string;
    city?: string | null;
  };
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [businessName, setBusinessName] = useState(profile.business_name || "");
  const [ownerName, setOwnerName] = useState(profile.owner_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");
  const [city, setCity] = useState(profile.city || "");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          business_name: businessName,
          owner_name: ownerName,
          phone,
          email,
          city: city || null,
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível atualizar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2 md:col-span-2">
        <Label>Nome do Salão</Label>
        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Proprietário</Label>
        <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>E-mail</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Cidade</Label>
        <Input value={city ?? ""} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div className="md:col-span-2 flex gap-3">
        <Button type="submit" className="min-w-40" disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
