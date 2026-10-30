export function parseStaffCommission(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("Informe uma comissão entre 0% e 100%.");
  }
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const percentage = Number(normalized);
  if (normalized === "" || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error("Informe uma comissão entre 0% e 100%.");
  }
  return percentage;
}

export function staffCommissionPatch(value: unknown) {
  if (value === undefined) return {};
  const percentage = parseStaffCommission(value);
  return {
    commission_percentage: percentage,
    commission_type: "custom_percentage",
    custom_percentage: percentage,
  };
}