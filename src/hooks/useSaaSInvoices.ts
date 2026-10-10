import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SaaSInvoice } from '@/lib/saasInvoiceMetrics';

export function useSaaSInvoices() {
  return useQuery({
    queryKey: ['admin-saas-invoices'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const rows: SaaSInvoice[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('subscription_payments')
          .select('id, establishment_id, status, value, net_value, due_date, payment_date')
          .order('id').range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return rows;
      }
    },
  });
}