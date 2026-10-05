import { normalizeStatus } from "@/lib/appointmentStatus";

export type CanceledAppointmentLike = {
  status?: string | null;
  service_amount?: number | string | null;
};

export function isCanceledAppointment(appointment: CanceledAppointmentLike): boolean {
  return normalizeStatus(appointment.status) === "canceled";
}

export function summarizeCanceledAppointments(appointments: CanceledAppointmentLike[]) {
  const canceled = appointments.filter(isCanceledAppointment);
  return {
    count: canceled.length,
    amount: canceled.reduce((total, appointment) => total + Number(appointment.service_amount ?? 0), 0),
  };
}