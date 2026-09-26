import { asNumber, countUniqueClients, round2, sumRealizedRevenue, type SaleLike } from "./revenueRules";

export type ForecastAppointment = {
  appointment_date: string;
  status: string | null;
  service_amount: number | null;
};

// Mesmos estados de agendamento válidos usados pela previsão do relatório financeiro.
const FUTURE_STATUSES = new Set(["scheduled", "confirmed", "open", "pending", "agendado", "confirmado", "aberto", "pendente"]);

export function isFutureAppointment(appointment: ForecastAppointment, tomorrowISO: string, monthEndISO: string): boolean {
  const status = String(appointment.status ?? "").trim().toLowerCase();
  return appointment.appointment_date >= tomorrowISO && appointment.appointment_date < monthEndISO &&
    (status === "" || FUTURE_STATUSES.has(status));
}

export function calculateStrategicDashboard(
  sales: SaleLike[], appointments: ForecastAppointment[], goal: number | null,
  tomorrowISO: string, monthEndISO: string,
) {
  const realized = sumRealizedRevenue(sales);
  const future = appointments.filter((appointment) => isFutureAppointment(appointment, tomorrowISO, monthEndISO));
  // service_amount é o orçamento fechado do agendamento, inclusive valor negociado ou zero.
  const forecast = round2(future.reduce((sum, appointment) => sum + asNumber(appointment.service_amount), 0));
  const projected = round2(realized + forecast);
  const clients = countUniqueClients(sales);
  const ticket = clients > 0 ? round2(realized / clients) : 0;
  const remaining = goal === null ? null : round2(Math.max(0, asNumber(goal) - projected));
  const needed = remaining !== null && remaining > 0 && ticket > 0 ? Math.ceil(remaining / ticket) : null;
  return { realized, forecast, projected, goal, remaining, ticket, clients, futureCount: future.length, needed };
}