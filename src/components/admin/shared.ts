import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "trial_active" | "trial_expiring" | "trial_expired" | "active_paid" | "payment_pending" | "grace_active" | "overdue" | "pending" | "canceled" | "blocked" | "blocked_manual" | "no_subscription";

export const STATUS_LABEL: Record<string, string> = {
  trial: "Em teste",
  trial_active: "Em teste",
  trial_expiring: "Teste expirando",
  trial_expired: "Teste expirado",
  active: "Ativo",
  past_due: "Pendente",
  pending: "Pendente",
  canceled: "Cancelado",
  blocked: "Bloqueado",
  blocked_manual: "Bloqueio manual",
  active_paid: "Ativo",
  payment_pending: "Pagamento próximo",
  grace_active: "Liberação temporária",
  overdue: "Pendente",
  no_subscription: "Sem assinatura",
};

export const STATUS_TONE: Record<string, string> = {
  trial: "bg-accent/15 text-accent border-accent/30",
  trial_expired: "bg-destructive/15 text-destructive border-destructive/30",
  active: "bg-success/15 text-success border-success/30",
  past_due: "bg-warning/15 text-warning border-warning/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  canceled: "bg-muted text-muted-foreground border-border",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
  blocked_manual: "bg-destructive/15 text-destructive border-destructive/30",
  active_paid: "bg-success/15 text-success border-success/30",
  payment_pending: "bg-warning/15 text-warning border-warning/30",
  grace_active: "bg-accent/15 text-accent border-accent/30",
  overdue: "bg-warning/15 text-warning border-warning/30",
  trial_active: "bg-accent/15 text-accent border-accent/30",
  trial_expiring: "bg-warning/15 text-warning border-warning/30",
  no_subscription: "bg-muted text-muted-foreground border-border",
};

export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const EFFECTIVE_STATUS_OPTIONS = [
  "trial_active", "trial_expiring", "trial_expired", "active_paid",
  "payment_pending", "overdue", "grace_active", "blocked", "blocked_manual", "canceled", "no_subscription",
].map((value) => ({ value, label: STATUS_LABEL[value] }));

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
