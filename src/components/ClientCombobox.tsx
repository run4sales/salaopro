import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, UserCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientLite { id: string; name: string; phone?: string | null }

const CLIENTS_PAGE_SIZE = 1000;
const INITIAL_VISIBLE_CLIENTS = 50;
const VISIBLE_CLIENTS_INCREMENT = 50;

function isRecoverableClientsFilterError(error: any) {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  return (
    ["42703", "PGRST200", "PGRST204", "PGRST205"].includes(code) ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

async function fetchAllClients(establishmentId: string) {

  const allClients: ClientLite[] = [];
  let from = 0;

  while (true) {
    const to = from + CLIENTS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone")
      .eq("establishment_id", establishmentId)
      .order("name")
      .range(from, to);


    if (error) {
      throw error;
    }

    const page = (data ?? []) as ClientLite[];
    allClients.push(...page);

    if (page.length < CLIENTS_PAGE_SIZE) {
      break;
    }

    from += CLIENTS_PAGE_SIZE;
  }

  return allClients;
}

interface Props {
  establishmentId: string;
  value: string;
  onChange: (id: string, client?: ClientLite) => void;
  /** show selected as compact chip (default) or plain text */
  compact?: boolean;
  placeholder?: string;
}

export function ClientCombobox({ establishmentId, value, onChange, compact = true, placeholder = "Buscar por nome ou telefone..." }: Props) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CLIENTS);

  const { data: clients, isLoading, isError } = useQuery<ClientLite[]>({
    queryKey: ["clients-combobox", establishmentId],
    enabled: !!establishmentId,
    queryFn: () => fetchAllClients(establishmentId),
  });

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_CLIENTS);
  }, [search, establishmentId]);

  const selected = clients?.find(c => c.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients ?? [];
    return (clients ?? []).filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  const visibleClients = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const hasMoreClients = filtered.length > visibleClients.length;

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

      {search.trim() && (
        <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
          {isLoading && (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              Carregando clientes...
            </div>
          )}
          {isError && (
            <div className="px-3 py-3 text-sm text-destructive text-center">
              Erro ao carregar clientes.
            </div>
          )}
          {!isLoading && !isError && visibleClients.map(c => (
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
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
              Nenhum cliente encontrado.
            </div>
          )}
          {!isLoading && !isError && hasMoreClients && (
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-none text-xs text-muted-foreground"
              onClick={() => setVisibleCount(count => count + VISIBLE_CLIENTS_INCREMENT)}
            >
              Mostrar mais {Math.min(VISIBLE_CLIENTS_INCREMENT, filtered.length - visibleClients.length)} de {filtered.length} clientes
            </Button>
          )}
        </div>
      )}


      <Button type="button" variant="outline" className="w-full" onClick={() => window.location.assign('/clients?new=1')}>
        <UserPlus className="h-4 w-4 mr-2" /> Abrir ficha completa de novo cliente
      </Button>
    </div>
  );
}
