export const BUSINESS_HOURS_SELECT = "id, inactive_days_threshold, opening_time:business_open_time, closing_time:business_close_time";
export const DEFAULT_OPENING_TIME = "08:00";
export const DEFAULT_CLOSING_TIME = "19:00";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type BusinessHours = {
  openingTime: string;
  closingTime: string;
};

export function normalizeTimeValue(value: string | null | undefined, fallback: string): string {
  const candidate = String(value ?? "").slice(0, 5);
  return isValidTimeValue(candidate) ? candidate : fallback;
}

export function isValidTimeValue(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function areBusinessHoursValid(openingTime: string, closingTime: string): boolean {
  return isValidTimeValue(openingTime) && isValidTimeValue(closingTime) && timeToMinutes(openingTime) < timeToMinutes(closingTime);
}

export function buildDateAtTime(baseDate: Date, value: string): Date {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function buildBusinessTimeBoundary(value: string | undefined, fallback: string): Date {
  return buildDateAtTime(new Date(), normalizeTimeValue(value, fallback));
}

export function generateBusinessSlots(date: Date, openingTime: string, closingTime: string, durationMinutes = 30, stepMinutes = 30): Date[] {
  if (!areBusinessHoursValid(openingTime, closingTime)) return [];

  const start = buildDateAtTime(date, openingTime);
  const end = buildDateAtTime(date, closingTime);
  const slots: Date[] = [];
  let current = start;

  while (current.getTime() + durationMinutes * 60_000 <= end.getTime()) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + stepMinutes * 60_000);
  }

  return slots;
}
