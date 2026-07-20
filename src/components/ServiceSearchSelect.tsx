import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Check } from "lucide-react";

export interface ServiceOption {
  id: string;
  name: string;
  price?: number | null;
  duration_minutes?: number | null;
}

interface BaseProps {
  services: ServiceOption[];
  placeholder?: string;
  disabled?: boolean;
  maxResults?: number;
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value: string;
  onChange: (id: string, service?: ServiceOption) => void;
}

interface MultiProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (ids: string[]) => void;
}

type Props = SingleProps | MultiProps;

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function ServiceSearchSelect(props: Props) {
  const { services, placeholder = "Digite o nome do serviço...", disabled, maxResults = 20 } = props;
  const [search, setSearch] = useState("");

  const selectedIds = props.multiple ? props.value : props.value ? [props.value] : [];
  const selectedServices = useMemo(
    () => services.filter((s) => selectedIds.includes(s.id)),
    [services, selectedIds],
  );

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return [] as ServiceOption[];
    return services
      .filter((s) => normalize(s.name).includes(q))
      .slice(0, maxResults);
  }, [services, search, maxResults]);

  const handlePick = (svc: ServiceOption) => {
    if (props.multiple) {
      const current = props.value;
      const next = current.includes(svc.id)
        ? current.filter((id) => id !== svc.id)
        : [...current, svc.id];
      props.onChange(next);
    } else {
      props.onChange(svc.id, svc);
      setSearch("");
    }
  };

  const remove = (id: string) => {
    if (props.multiple) {
      props.onChange(props.value.filter((x) => x !== id));
    } else {
      props.onChange("");
    }
  };

  return (
    <div className="space-y-2">
      {selectedServices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedServices.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1 text-xs">
              <span className="max-w-[180px] truncate">{s.name}</span>
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remover ${s.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
          disabled={disabled}
        />
      </div>

      {search.trim() && (
        <div className="max-h-56 overflow-y-auto rounded-md border bg-background">
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-center text-sm text-muted-foreground">
              Nenhum serviço encontrado.
            </div>
          )}
          {filtered.map((s) => {
            const isSelected = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handlePick(s)}
                className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {s.price != null && (
                    <span className="text-xs text-muted-foreground">
                      R$ {Number(s.price).toFixed(2)}
                    </span>
                  )}
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
