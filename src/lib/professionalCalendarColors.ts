export const PROFESSIONAL_CALENDAR_COLORS = [
  "#2563EB",
  "#16A34A",
  "#7C3AED",
  "#EA580C",
  "#DB2777",
  "#DC2626",
  "#CA8A04",
  "#0D9488",
  "#1E3A8A",
  "#166534",
] as const;

export const DEFAULT_PROFESSIONAL_CALENDAR_COLOR = PROFESSIONAL_CALENDAR_COLORS[0];

export function normalizeCalendarColor(color?: string | null) {
  const normalized = color?.trim().toUpperCase();
  return normalized && /^#[0-9A-F]{6}$/.test(normalized)
    ? normalized
    : DEFAULT_PROFESSIONAL_CALENDAR_COLOR;
}

function hexToRgb(color: string) {
  const normalized = normalizeCalendarColor(color).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function getProfessionalCalendarStyle(color?: string | null) {
  const border = normalizeCalendarColor(color);
  const { r, g, b } = hexToRgb(border);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.14)`,
    borderColor: border,
    color: "hsl(var(--foreground))",
  };
}