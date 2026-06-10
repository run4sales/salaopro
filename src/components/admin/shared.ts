import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "trial" | "trial_expired" | "active" | "past_due" | "pending" | "canceled" | "blocked";

export const STATUS_LABEL: Record<string, string> = {
  trial: "Em teste",
  trial_expired: "Teste expirado",
  active: "Ativo",
  past_due: "Pendente",
  pending: "Pendente",
  canceled: "Cancelado",
  blocked: "Bloqueado",
};

export const STATUS_TONE: Record<string, string> = {
  trial: "bg-accent/15 text-accent border-accent/30",
  trial_expired: "bg-destructive/15 text-destructive border-destructive/30",
  active: "bg-success/15 text-success border-success/30",
  past_due: "bg-warning/15 text-warning border-warning/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  canceled: "bg-muted text-muted-foreground border-border",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * Deriva o status efetivo de uma assinatura levando em conta expiração de trial
 * e atraso de pagamento. Bloqueio manual (status='blocked') sempre prevalece.
 */
export function deriveEffectiveStatus(
  status: string | null | undefined,
  trial_ends_at?: string | null,
  next_billing_at?: string | null
): string {
  if (!status) return "trial";
  if (status === "blocked" || status === "canceled") return status;

  const now = Date.now();
  if (status === "trial") {
    if (trial_ends_at && new Date(trial_ends_at).getTime() <= now) return "trial_expired";
    return "trial";
  }
  if (status === "active") {
    if (next_billing_at && new Date(next_billing_at).getTime() + 7 * 86_400_000 <= now) return "blocked";
    if (next_billing_at && new Date(next_billing_at).getTime() <= now) return "past_due";
    return "active";
  }
  return status;
}

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
