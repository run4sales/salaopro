import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { Tables } from "@/integrations/supabase/types";
export type Receivable = Tables<"receivables">;
export type Receipt = Tables<"receivable_payments">;
export const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const paymentMethods = ["Dinheiro", "Pix", "Crédito", "Débito", "Transferência", "Boleto", "Outro"];
export async function fetchReceivables(establishmentId: string, clientId?: string) {
  return fetchAllPages<Receivable>(async (from, to) => {
    let query = supabase.from("receivables").select("*").eq("establishment_id", establishmentId);
    if (clientId) query = query.eq("client_id", clientId);
    const { data, error } = await query.order("due_date").order("id").range(from, to);
    if (error) throw error;
    return data ?? [];
  });
}
export async function fetchReceipts(establishmentId: string) {
  return fetchAllPages<Receipt>(async (from, to) => {
    const { data, error } = await supabase.from("receivable_payments").select("*").eq("establishment_id", establishmentId).order("payment_date").order("id").range(from,to);
    if (error) throw error;
    return data ?? [];
  });
}