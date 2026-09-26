export type OccupiedInterval = { start: string; end: string; professionalId: string; id: string; label: string; type: "appointment" | "block" };

export function findAgendaConflicts(start: Date, end: Date, professionalIds: string[], occupied: OccupiedInterval[], excludeAppointmentId?: string) {
  return occupied.filter(item =>
    professionalIds.includes(item.professionalId) &&
    !(item.type === "appointment" && item.id === excludeAppointmentId) &&
    start.getTime() < new Date(item.end).getTime() &&
    end.getTime() > new Date(item.start).getTime()
  );
}