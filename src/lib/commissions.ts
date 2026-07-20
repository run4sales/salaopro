import { supabase } from "@/integrations/supabase/client";

type ProfessionalCommissionConfig = {
  id: string;
  commission_type: string | null;
  custom_percentage: number | null;
};

type CommissionProfessionalInput = {
  professional_id: string | null | undefined;
  role?: string | null;
};

type BuildSaleCommissionRowsParams = {
  establishmentId: string;
  saleId: string;
  serviceCommissionPercentage: number;
  baseAmount: number;
  professionals: CommissionProfessionalInput[];
};

const uniqueProfessionals = (professionals: CommissionProfessionalInput[]) => {
  const seen = new Set<string>();
  return professionals.filter((entry) => {
    if (!entry.professional_id || seen.has(entry.professional_id)) return false;
    seen.add(entry.professional_id);
    return true;
  });
};

const resolveCommissionPercentage = (
  professional: ProfessionalCommissionConfig | undefined,
  serviceCommissionPercentage: number,
) => {
  if (professional?.commission_type === "custom_percentage") {
    return Number(professional.custom_percentage ?? 0);
  }

  return Number(serviceCommissionPercentage ?? 0);
};

export async function buildSaleCommissionRows({
  establishmentId,
  saleId,
  serviceCommissionPercentage,
  baseAmount,
  professionals,
}: BuildSaleCommissionRowsParams) {
  const entries = uniqueProfessionals(professionals);
  if (entries.length === 0) return [];

  const professionalIds = entries.map((entry) => entry.professional_id as string);
  const { data, error } = await supabase
    .from("professionals")
    .select("id, commission_type, custom_percentage")
    .eq("establishment_id", establishmentId)
    .in("id", professionalIds);
  if (error) throw error;

  const configByProfessional = new Map(
    ((data ?? []) as ProfessionalCommissionConfig[]).map((professional) => [professional.id, professional]),
  );

  // Divide o valor do atendimento igualmente entre os profissionais associados.
  // A comissão de cada profissional é calculada sobre a parcela proporcional,
  // nunca sobre o valor total quando há múltiplos profissionais.
  const share = entries.length > 0 ? Number(baseAmount) / entries.length : Number(baseAmount);

  return entries
    .filter((entry) => configByProfessional.get(entry.professional_id as string)?.commission_type !== "fixed_daily")
    .map((entry) => {
      const percentage = resolveCommissionPercentage(
        configByProfessional.get(entry.professional_id as string),
        serviceCommissionPercentage,
      );

      return {
        establishment_id: establishmentId,
        sale_id: saleId,
        professional_id: entry.professional_id as string,
        role: entry.role ?? "solo",
        commission_percentage: percentage,
        commission_amount: Number((share * (percentage / 100)).toFixed(2)),
      };
    });
}

export async function syncSaleCommissions(params: BuildSaleCommissionRowsParams) {
  const rows = await buildSaleCommissionRows(params);

  const { error: deleteError } = await supabase
    .from("sale_professionals")
    .delete()
    .eq("sale_id", params.saleId);
  if (deleteError) throw deleteError;

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("sale_professionals").insert(rows);
  if (insertError) throw insertError;
}
