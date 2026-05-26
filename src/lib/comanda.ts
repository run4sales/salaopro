import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures there's an OPEN comanda for the given appointment.
 * If none exists, creates one and seeds it with the appointment's service.
 * Returns the comanda id.
 */
export async function ensureComandaForAppointment(opts: {
  establishment_id: string;
  appointment_id: string;
  client_id: string;
  service_id: string;
  professional_id?: string | null;
}): Promise<string> {
  const { establishment_id, appointment_id, client_id, service_id, professional_id } = opts;

  // Look for an existing open/awaiting comanda
  const { data: existing } = await supabase
    .from("comandas")
    .select("id")
    .eq("appointment_id", appointment_id)
    .in("status", ["open", "awaiting_payment"])
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Fetch service info
  const { data: svc } = await supabase
    .from("services")
    .select("name, price, commission_solo")
    .eq("id", service_id)
    .maybeSingle();

  const unit_price = Number(svc?.price ?? 0);
  const name = svc?.name ?? "Serviço";
  const total = unit_price;
  const commission_pct = Number(svc?.commission_solo ?? 0);

  const { data: comanda, error } = await supabase
    .from("comandas")
    .insert({
      establishment_id,
      appointment_id,
      client_id,
      status: "open",
      subtotal: total,
      total,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("comanda_items").insert({
    establishment_id,
    comanda_id: comanda.id,
    kind: "service",
    service_id,
    name,
    qty: 1,
    unit_price,
    total,
    professional_id: professional_id ?? null,
    commission_percentage: commission_pct,
    commission_amount: total * (commission_pct / 100),
  });

  return comanda.id;
}

export async function recalcComandaTotals(comandaId: string) {
  const { data: items } = await supabase
    .from("comanda_items")
    .select("total")
    .eq("comanda_id", comandaId);
  const subtotal = (items ?? []).reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const { data: head } = await supabase
    .from("comandas")
    .select("discount")
    .eq("id", comandaId)
    .maybeSingle();
  const discount = Number(head?.discount ?? 0);
  const total = Math.max(0, subtotal - discount);
  await supabase.from("comandas").update({ subtotal, total }).eq("id", comandaId);
  return { subtotal, total };
}
