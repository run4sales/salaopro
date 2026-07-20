export const BUSINESS_HOURS_SELECT = "id, inactive_days_threshold, working_days, opening_time:business_open_time, closing_time:business_close_time, weekly_hours";
export const DEFAULT_OPENING_TIME = "08:00";
export const DEFAULT_CLOSING_TIME = "19:00";
export const DEFAULT_WORKING_DAYS: number[] = [1, 2, 3, 4, 5, 6];

export const WEEKDAY_LABELS: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type BusinessHours = {
  openingTime: string;
  closingTime: string;
  workingDays: number[];
};

export type BusinessInterval = { open: string; close: string };
export type DaySchedule = { open: boolean; intervals: BusinessInterval[] };
export type WeeklyHours = Record<string, DaySchedule>;

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

export function normalizeWorkingDays(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_WORKING_DAYS;
  const cleaned = value
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return cleaned.length ? Array.from(new Set(cleaned)).sort() : DEFAULT_WORKING_DAYS;
}

export function isWorkingDay(date: Date, workingDays: number[] = DEFAULT_WORKING_DAYS): boolean {
  return workingDays.includes(date.getDay());
}

/** Builds a default weekly schedule from legacy opening/closing/workingDays. */
export function buildDefaultWeeklyHours(
  openingTime: string = DEFAULT_OPENING_TIME,
  closingTime: string = DEFAULT_CLOSING_TIME,
  workingDays: number[] = DEFAULT_WORKING_DAYS,
): WeeklyHours {
  const out: WeeklyHours = {};
  for (let d = 0; d <= 6; d++) {
    const isOpen = workingDays.includes(d);
    out[String(d)] = {
      open: isOpen,
      intervals: isOpen ? [{ open: openingTime, close: closingTime }] : [],
    };
  }
  return out;
}

/** Normalizes an arbitrary weekly_hours payload; falls back to legacy fields when missing. */
export function normalizeWeeklyHours(
  value: unknown,
  fallback?: { openingTime?: string; closingTime?: string; workingDays?: number[] },
): WeeklyHours {
  const base = buildDefaultWeeklyHours(
    fallback?.openingTime ?? DEFAULT_OPENING_TIME,
    fallback?.closingTime ?? DEFAULT_CLOSING_TIME,
    fallback?.workingDays ?? DEFAULT_WORKING_DAYS,
  );
  if (!value || typeof value !== "object") return base;
  const src = value as Record<string, any>;
  if (Object.keys(src).length === 0) return base;
  const out: WeeklyHours = {};
  for (let d = 0; d <= 6; d++) {
    const key = String(d);
    const cfg = src[key];
    if (cfg && typeof cfg === "object") {
      const rawIntervals = Array.isArray(cfg.intervals) ? cfg.intervals : [];
      const intervals: BusinessInterval[] = rawIntervals
        .map((iv: any) => ({
          open: normalizeTimeValue(iv?.open, DEFAULT_OPENING_TIME),
          close: normalizeTimeValue(iv?.close, DEFAULT_CLOSING_TIME),
        }))
        .filter((iv: BusinessInterval) => areBusinessHoursValid(iv.open, iv.close));
      const open = Boolean(cfg.open) && intervals.length > 0;
      out[key] = { open, intervals: open ? intervals : [] };
    } else {
      out[key] = base[key];
    }
  }
  return out;
}

export function getDaySchedule(weekly: WeeklyHours, weekday: number): DaySchedule {
  return weekly[String(weekday)] ?? { open: false, intervals: [] };
}

export function isDateOpen(date: Date, weekly: WeeklyHours): boolean {
  const day = getDaySchedule(weekly, date.getDay());
  return day.open && day.intervals.length > 0;
}

/** Returns [minOpen, maxClose] across days that are open, for calendar rendering. */
export function getWeeklyBounds(weekly: WeeklyHours): { open: string; close: string } {
  let minOpen = 24 * 60;
  let maxClose = 0;
  for (let d = 0; d <= 6; d++) {
    const day = getDaySchedule(weekly, d);
    if (!day.open) continue;
    for (const iv of day.intervals) {
      minOpen = Math.min(minOpen, timeToMinutes(iv.open));
      maxClose = Math.max(maxClose, timeToMinutes(iv.close));
    }
  }
  if (minOpen >= maxClose) {
    return { open: DEFAULT_OPENING_TIME, close: DEFAULT_CLOSING_TIME };
  }
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { open: fmt(minOpen), close: fmt(maxClose) };
}

/** True if [start, end] fully fits inside one of the day's intervals. */
export function fitsInSchedule(start: Date, end: Date, weekly: WeeklyHours): boolean {
  if (start.getDate() !== end.getDate() || start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()) {
    return false;
  }
  const day = getDaySchedule(weekly, start.getDay());
  if (!day.open) return false;
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  return day.intervals.some(iv => startMin >= timeToMinutes(iv.open) && endMin <= timeToMinutes(iv.close));
}

export function generateBusinessSlots(
  date: Date,
  openingTime: string,
  closingTime: string,
  durationMinutes = 30,
  stepMinutes = 30,
  workingDays: number[] = DEFAULT_WORKING_DAYS,
): Date[] {
  if (!areBusinessHoursValid(openingTime, closingTime)) return [];
  if (!isWorkingDay(date, workingDays)) return [];

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

/** Generates slots for a specific date using per-day weekly schedule (all intervals). */
export function generateWeeklySlots(
  date: Date,
  weekly: WeeklyHours,
  durationMinutes = 30,
  stepMinutes = 30,
): Date[] {
  const day = getDaySchedule(weekly, date.getDay());
  if (!day.open) return [];
  const slots: Date[] = [];
  for (const iv of day.intervals) {
    const start = buildDateAtTime(date, iv.open);
    const end = buildDateAtTime(date, iv.close);
    let current = start;
    while (current.getTime() + durationMinutes * 60_000 <= end.getTime()) {
      slots.push(new Date(current));
      current = new Date(current.getTime() + stepMinutes * 60_000);
    }
  }
  return slots;
}

/** Derives legacy open/close/workingDays from a weekly schedule, for backwards compat storage. */
export function deriveLegacyFromWeekly(weekly: WeeklyHours): { openingTime: string; closingTime: string; workingDays: number[] } {
  const bounds = getWeeklyBounds(weekly);
  const workingDays: number[] = [];
  for (let d = 0; d <= 6; d++) {
    if (getDaySchedule(weekly, d).open) workingDays.push(d);
  }
  return {
    openingTime: bounds.open,
    closingTime: bounds.close,
    workingDays: workingDays.length ? workingDays : DEFAULT_WORKING_DAYS,
  };
}
