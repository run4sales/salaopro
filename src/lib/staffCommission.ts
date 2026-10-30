export { parseStaffCommission, staffCommissionPatch } from "../../supabase/functions/_shared/staff-commission";

export function staffCommissionValue(professional?: {
  commission_type?: string | null;
  commission_percentage?: number | null;
  custom_percentage?: number | null;
} | null): number {
  return Number(professional?.commission_type === "custom_percentage"
    ? professional.custom_percentage ?? 0
    : professional?.commission_percentage ?? 0);
}