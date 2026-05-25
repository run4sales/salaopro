export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_service"
  | "completed"
  | "canceled";

export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  pending: "Agendado",
  confirmed: "Confirmado",
  in_service: "Em atendimento",
  completed: "Finalizado",
  canceled: "Cancelado",
  cancelled: "Cancelado",
};

export const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  scheduled: "secondary",
  pending: "secondary",
  confirmed: "default",
  in_service: "default",
  completed: "outline",
  canceled: "destructive",
  cancelled: "destructive",
};

/** HSL color tokens (used inline in calendar events) */
export const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  scheduled:  { bg: "hsl(45 93% 90%)",  fg: "hsl(38 92% 25%)",  border: "hsl(45 93% 55%)"  }, // yellow
  pending:    { bg: "hsl(45 93% 90%)",  fg: "hsl(38 92% 25%)",  border: "hsl(45 93% 55%)"  },
  confirmed:  { bg: "hsl(217 91% 92%)", fg: "hsl(217 91% 30%)", border: "hsl(217 91% 55%)" }, // blue
  in_service: { bg: "hsl(142 60% 88%)", fg: "hsl(142 71% 25%)", border: "hsl(142 71% 42%)" }, // green
  completed:  { bg: "hsl(220 10% 88%)", fg: "hsl(220 26% 25%)", border: "hsl(220 13% 46%)" }, // gray
  canceled:   { bg: "hsl(0 84% 94%)",   fg: "hsl(0 84% 35%)",   border: "hsl(0 84% 60%)"   }, // red
  cancelled:  { bg: "hsl(0 84% 94%)",   fg: "hsl(0 84% 35%)",   border: "hsl(0 84% 60%)"   },
};

export const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "scheduled",  label: "Agendado" },
  { value: "confirmed",  label: "Confirmado" },
  { value: "in_service", label: "Em atendimento" },
  { value: "completed",  label: "Finalizado" },
  { value: "canceled",   label: "Cancelado" },
];

export function normalizeStatus(s?: string | null): string {
  const k = (s || "scheduled").toLowerCase();
  if (k === "pending") return "scheduled";
  if (k === "cancelled") return "canceled";
  return k;
}
