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

  const [{ data: appointment }, { data: snapshots }] = await Promise.all([
    supabase.from("appointments").select("service_amount").eq("id", appointment_id).maybeSingle(),
    supabase.from("appointment_services").select("service_id, unit_price, services(name, commission_solo)").eq("appointment_id", appointment_id),
  ]);
  let pricedServices = (snapshots ?? []) as any[];
  // Compatibility for appointments created before the snapshot migration.
  if (!pricedServices.length) {
    const { data: svc } = await supabase.from("services").select("id, name, price, commission_solo").eq("id", service_id).maybeSingle();
    pricedServices = [{ service_id, unit_price: appointment?.service_amount ?? svc?.price ?? 0, services: svc }];
  }
  const total = pricedServices.reduce((sum, item) => sum + Number(item.unit_price ?? 0), 0);

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

  const { error: itemError } = await supabase.from("comanda_items").insert(pricedServices.map(item => {
    const unitPrice = Number(item.unit_price ?? 0);
    const commissionPct = Number(item.services?.commission_solo ?? 0);
    return { establishment_id, comanda_id: comanda.id, kind: "service", service_id: item.service_id,
      name: item.services?.name ?? "Serviço", qty: 1, unit_price: unitPrice, total: unitPrice,
      professional_id: professional_id ?? null, commission_percentage: commissionPct,
      commission_amount: unitPrice * (commissionPct / 100) };
  }) as any);
  if (itemError) {
    await supabase.from("comandas").delete().eq("id", comanda.id);
    throw itemError;
  }

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
