import { supabase } from "@/integrations/supabase/client";

type SaleInsertPayload = Record<string, unknown>;

const isMissingCreatedByUserIdSchemaError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "PGRST204" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("created_by_user_id") &&
    maybeError.message.includes("schema cache")
  );
};

const withoutCreatedByUserId = (payload: SaleInsertPayload[]) =>
  payload.map(({ created_by_user_id: _createdByUserId, ...sale }) => sale);

export const insertSalesWithCreatorFallback = async (payload: SaleInsertPayload[]) => {
  const insertSales = (salesPayload: SaleInsertPayload[]) =>
    supabase.from("sales").insert(salesPayload as any).select("id, service_id, amount, credit_used");

  const result = await insertSales(payload);

  if (!result.error || !isMissingCreatedByUserIdSchemaError(result.error)) {
    return result;
  }

  // Some deployed databases still need the sales.created_by_user_id migration or a
  // PostgREST schema refresh. Retry without the audit column so the checkout is not
  // blocked; migrated environments continue to record the authenticated creator above.
  return insertSales(withoutCreatedByUserId(payload));
};
