import { supabase } from "@/integrations/supabase/client";

type SaleInsertPayload = Record<string, unknown>;

const auditUserColumns = ["created_by_user_id", "updated_by_user_id"] as const;

const isMissingAuditUserSchemaError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "PGRST204" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("schema cache") &&
    auditUserColumns.some((column) => maybeError.message?.includes(column))
  );
};

const withoutAuditUserColumns = (payload: SaleInsertPayload[]) =>
  payload.map((sale) => {
    const sanitizedSale = { ...sale };
    for (const column of auditUserColumns) {
      delete sanitizedSale[column];
    }
    return sanitizedSale;
  });

export const insertSalesWithCreatorFallback = async (payload: SaleInsertPayload[]) => {
  const insertSales = (salesPayload: SaleInsertPayload[]) =>
    supabase.from("sales").insert(salesPayload).select("id, service_id, amount, credit_used");

  const result = await insertSales(payload);

  if (!result.error || !isMissingAuditUserSchemaError(result.error)) {
    return result;
  }

  // Some deployed databases still need the sales audit-column migration or a
  // PostgREST schema refresh. Retry without audit columns so the checkout is not
  // blocked; migrated environments continue to record the authenticated user above.
  return insertSales(withoutAuditUserColumns(payload));
};
