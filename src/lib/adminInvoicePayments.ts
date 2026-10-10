import { supabase } from '@/integrations/supabase/client';

// Use invoice payment dates, not the subscription's administrative timestamp.
export async function fetchLastInvoicePayments() {
  const payments = new Map<string, string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('subscription_payments')
      .select('establishment_id, payment_date')
      .in('status', ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'])
      .not('payment_date', 'is', null)
      .order('payment_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.payment_date && !payments.has(row.establishment_id)) payments.set(row.establishment_id, row.payment_date);
    }
    if ((data?.length ?? 0) < 1000) return payments;
  }
}