import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "trial" | "active" | "past_due" | "pending" | "canceled" | "blocked";

export const STATUS_LABEL: Record<string, string> = {
  trial: "Em teste",
  active: "Ativo",
  past_due: "Pendente",
  pending: "Pendente",
  canceled: "Cancelado",
  blocked: "Bloqueado",
};

export const STATUS_TONE: Record<string, string> = {
  trial: "bg-accent/15 text-accent border-accent/30",
  active: "bg-success/15 text-success border-success/30",
  past_due: "bg-warning/15 text-warning border-warning/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  canceled: "bg-muted text-muted-foreground border-border",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
};

export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

export async function logAdminAction(
  adminUserId: string,
  action: string,
  targetEstablishmentId?: string,
  details?: Record<string, unknown>
) {
  await (supabase as any).from("admin_actions_log").insert({
    admin_user_id: adminUserId,
    action,
    target_establishment_id: targetEstablishmentId ?? null,
    details: details ?? null,
  });
}
