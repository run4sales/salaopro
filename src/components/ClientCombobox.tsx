import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, UserPlus, UserCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ClientLite { id: string; name: string; phone?: string | null }

interface Props {
  establishmentId: string;
  value: string;
  onChange: (id: string, client?: ClientLite) => void;
  /** show selected as compact chip (default) or plain text */
  compact?: boolean;
  placeholder?: string;
}

export function ClientCombobox({ establishmentId, value, onChange, compact = true, placeholder = "Buscar por nome ou telefone..." }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", acquisition_source: "" });
  const [saving, setSaving] = useState(false);

  const { data: clients } = useQuery<ClientLite[]>({
    queryKey: ["clients-combobox", establishmentId],
    enabled: !!establishmentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone")
        .eq("establishment_id", establishmentId)
        .order("name");
      return (data ?? []) as ClientLite[];
    },
  });

  const selected = clients?.find(c => c.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients ?? [];
    return (clients ?? []).filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  const openWithSearch = () => {
    setForm(f => ({ ...f, name: /^[a-zA-ZÀ-ÿ\s]+$/.test(search) ? search : f.name, phone: /^[\d\s()+\-]+$/.test(search) ? search : f.phone }));
    setOpenCreate(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Informe nome e telefone");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("clients").insert({
      establishment_id: establishmentId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      acquisition_source: form.acquisition_source || null,
    }).select("id, name, phone").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente cadastrado");
    await qc.invalidateQueries({ queryKey: ["clients-combobox"] });
    await qc.invalidateQueries({ queryKey: ["clients"] });
    onChange(data!.id, data as ClientLite);
    setOpenCreate(false);
    setForm({ name: "", phone: "", acquisition_source: "" });
    setSearch("");
  };

  if (selected) {
    return (
      <div className={cn("flex items-center justify-between rounded-lg border bg-primary/5 border-primary/20 px-3 py-2", !compact && "bg-background")}>
        <div className="flex items-center gap-2 min-w-0">
          <UserCircle2 className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{selected.name}</div>
            {selected.phone && <div className="text-xs text-muted-foreground truncate">{selected.phone}</div>}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange("")}>
          <X className="h-4 w-4 mr-1" /> Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
        {filtered.slice(0, 8).map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => { onChange(c.id, c); setSearch(""); }}
            className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0 flex items-center justify-between"
          >
            <span className="font-medium">{c.name}</span>
            {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-3 text-sm text-muted-foreground text-center">
            {search ? "Nenhum cliente encontrado." : "Digite para buscar..."}
          </div>
        )}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={openWithSearch}>
        <UserPlus className="h-4 w-4 mr-2" /> Cadastrar novo cliente
      </Button>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastro rápido de cliente</DialogTitle>
            <DialogDescription>Informe os dados básicos. Você pode complementar depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Como chegou (opcional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.acquisition_source}
                onChange={(e) => setForm(f => ({ ...f, acquisition_source: e.target.value }))}
              >
                <option value="">Selecione</option>
                <option value="Indicação">Indicação</option>
                <option value="Redes Sociais">Redes Sociais</option>
                <option value="Google">Google</option>
                <option value="Tráfego Pago">Tráfego Pago</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <Button className="w-full" disabled={saving} onClick={handleCreate}>
              {saving ? "Salvando..." : "Cadastrar e selecionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
