import { useState } from 'react';
import { useSaaSInvoices } from '@/hooks/useSaaSInvoices';
import { invoiceMonthMetrics, previousBillingMonth } from '@/lib/saasInvoiceMetrics';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtBRL } from './shared';

export default function SaaSInvoiceSummary() {
  const [month, setMonth] = useState(previousBillingMonth());
  const query = useSaaSInvoices();
  const data = invoiceMonthMetrics(query.data ?? [], month);
  return <section className="space-y-4 border-b border-border pb-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">Faturas e recebimentos</h2>
      <div className="flex items-center gap-2"><Label htmlFor="saas-invoice-month">Mês</Label><Input id="saas-invoice-month" type="month" className="w-44" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></div>
    </div>
    {query.isError ? <p role="alert" className="text-destructive">Não foi possível carregar as faturas.</p> : query.isLoading ? <p className="text-muted-foreground">Carregando faturas…</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><p className="text-sm text-muted-foreground">Recebido no mês (bruto)</p><p className="text-2xl font-bold text-success">{fmtBRL(data.received)}</p><p className="text-xs text-muted-foreground">Por data de pagamento</p></div>
      <div><p className="text-sm text-muted-foreground">Faturas pagas no mês</p><p className="text-2xl font-bold">{data.receivedCount}</p></div>
      <div><p className="text-sm text-muted-foreground">Vencidas em aberto</p><p className="text-2xl font-bold text-destructive">{fmtBRL(data.overdue)}</p><p className="text-xs text-muted-foreground">Vencimento no mês selecionado</p></div>
      <div><p className="text-sm text-muted-foreground">Faturas inadimplentes</p><p className="text-2xl font-bold text-destructive">{data.overdueCount}</p><p className="text-xs text-muted-foreground">{data.overdueCompanies} empresas</p></div>
    </div>}
    <p className="text-xs text-muted-foreground">Somente faturas sincronizadas. Cobranças sem vínculo confirmado não entram nos totais.</p>
  </section>;
}