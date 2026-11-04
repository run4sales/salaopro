import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Copy, Pencil, RefreshCw, ArrowLeft, Banknote, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatBrazilianPhone, validatePhone } from '@/lib/contactValidation';
import { normalizeReferralCode } from '@/lib/ambassadorReferral';
import { fmtBRL } from './shared';

type Ambassador = { id: string; name: string; code: string; whatsapp: string | null; pix_key: string | null; active: boolean; referrals: number; converted: number; earned: number; paid: number };
type Referral = { id: string; ambassador_id: string; business_name: string; plan: string | null; created_at: string; converted: boolean };
type Commission = { id: string; ambassador_id: string; business_name: string; base_amount: number; rate: number; amount: number; billing_month: string; reason: string; created_at: string; plan_slug: string };
type Payout = { id: string; ambassador_id: string; amount: number; paid_on: string; receipt_reference: string; notes: string | null };
type Report = { ambassadors: Ambassador[]; referrals: Referral[]; commissions: Commission[]; payouts: Payout[]; review: { id: string; ambassador_id: string; business_name: string; plan_slug: string | null }[] };
const date = (value: string) => new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export default function AdminAmbassadors() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Ambassador> | null>(null);
  const [payout, setPayout] = useState<{ amount: string; date: string; receipt: string; notes: string; request: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const report = useQuery({ queryKey: ['admin-ambassadors'], queryFn: async () => {
    const { data, error } = await supabase.rpc('admin_ambassador_report');
    if (error) throw error;
    return data as unknown as Report;
  }});
  const rows = report.data?.ambassadors ?? [];
  const selected = rows.find(a => a.id === selectedId);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-ambassadors'] });
  async function save() {
    if (saving.current || !editing) return;
    const code = normalizeReferralCode(editing.code);
    const phone = validatePhone(editing.whatsapp);
    if (!code || (editing.name?.trim().length ?? 0) < 2) { toast.error('Informe nome e código de 3 a 40 letras, números ou hífens.'); return; }
    if (!phone.valid) { toast.error(phone.message); return; }
    saving.current = true; setBusy(true);
    try {
      const values = { name: editing.name?.trim() ?? '', code, whatsapp: phone.normalized || null, pix_key: editing.pix_key?.trim() || null, active: editing.active ?? true };
      const { error } = editing.id ? await supabase.from('ambassadors').update(values).eq('id', editing.id) : await supabase.from('ambassadors').insert(values);
      if (error) throw error;
      await refresh(); setEditing(null); toast.success('Embaixador salvo.');
    } catch (error) { toast.error((error as { code?: string }).code === '23505' ? 'Este código já pertence a outro embaixador.' : 'Não foi possível salvar o embaixador.'); }
    finally { saving.current = false; setBusy(false); }
  }
  async function savePayout() {
    if (saving.current || !selected || !payout) return;
    const amount = Number(payout.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > selected.earned - selected.paid || !payout.date || payout.date > today() || payout.receipt.trim().length < 3) { toast.error('Confira valor disponível, data e comprovante.'); return; }
    saving.current = true; setBusy(true);
    try {
      const { error } = await supabase.rpc('register_ambassador_payout', { p_ambassador: selected.id, p_amount: amount, p_paid_on: payout.date, p_receipt: payout.receipt.trim(), p_notes: payout.notes, p_request: payout.request });
      if (error) throw error;
      await refresh(); setPayout(null); toast.success('Repasse registrado.');
    } catch (error) { toast.error((error as { message?: string }).message ?? 'Não foi possível registrar o repasse.'); }
    finally { saving.current = false; setBusy(false); }
  }
  async function copy(a: Ambassador) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?ref=${encodeURIComponent(a.code)}`); toast.success('Link copiado.'); }
    catch { toast.error('Não foi possível copiar o link.'); }
  }
  const totals = rows.reduce((sum, a) => ({ referrals: sum.referrals + a.referrals, converted: sum.converted + a.converted, earned: sum.earned + a.earned, balance: sum.balance + a.earned - a.paid }), { referrals: 0, converted: 0, earned: 0, balance: 0 });
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">{selected && <Button variant="ghost" size="icon" aria-label="Voltar aos embaixadores" onClick={() => setSelectedId(null)}><ArrowLeft /></Button>}<h2 className="text-xl font-semibold">{selected?.name ?? 'Embaixadores'}</h2></div>
      <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Atualizar embaixadores" onClick={() => report.refetch()}><RefreshCw /></Button>{selected ? <><Button variant="outline" onClick={() => setEditing(selected)}><Pencil />Editar</Button><Button disabled={selected.earned - selected.paid <= 0} onClick={() => setPayout({ amount: '', date: today(), receipt: '', notes: '', request: crypto.randomUUID() })}><Banknote />Registrar repasse</Button></> : <Button onClick={() => setEditing({ active: true })}><Plus />Novo embaixador</Button>}</div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-border py-5">{[
      ['Salões indicados', selected?.referrals ?? totals.referrals], ['Assinaturas pagas', selected?.converted ?? totals.converted], ['Comissão líquida', fmtBRL(selected?.earned ?? totals.earned)], ['Saldo a repassar', fmtBRL(selected ? selected.earned - selected.paid : totals.balance)],
    ].map(([label, value]) => <div key={label} className="space-y-1"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-semibold break-words">{value}</div></div>)}</div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span>Individual: 50% no primeiro mês · 15% nos seguintes</span><span>Profissional / Empresa: 50% no primeiro mês · 20% nos seguintes</span></div>
    {report.isLoading && <p className="text-muted-foreground">Carregando embaixadores...</p>}
    {report.isError && <div className="text-destructive">Não foi possível carregar os embaixadores. <Button variant="outline" onClick={() => report.refetch()}>Tentar novamente</Button></div>}
    {!selected && !report.isLoading && !report.isError && <>
      <Input aria-label="Buscar embaixador" placeholder="Buscar por nome ou código" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
      {rows.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-3" /><p>Nenhum embaixador cadastrado.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow>{['Embaixador', 'Código', 'Status', 'Indicados', 'Pagantes', 'Comissão', 'Repassado', 'Saldo', 'Ações'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.filter(a => `${a.name} ${a.code}`.toLowerCase().includes(search.toLowerCase())).map(a => <TableRow key={a.id}><TableCell><Button variant="link" className="p-0" onClick={() => setSelectedId(a.id)}>{a.name}</Button></TableCell><TableCell>{a.code}</TableCell><TableCell>{a.active ? 'Ativo' : 'Inativo'}</TableCell><TableCell>{a.referrals}</TableCell><TableCell>{a.converted}</TableCell><TableCell>{fmtBRL(a.earned)}</TableCell><TableCell>{fmtBRL(a.paid)}</TableCell><TableCell>{fmtBRL(a.earned - a.paid)}</TableCell><TableCell><Button variant="ghost" size="icon" aria-label={`Copiar link de ${a.name}`} title="Copiar link de indicação" onClick={() => copy(a)}><Copy /></Button><Button variant="ghost" size="icon" aria-label={`Editar ${a.name}`} onClick={() => setEditing(a)}><Pencil /></Button></TableCell></TableRow>)}</TableBody></Table></div>}
    </>}
    {selected && <>
      <div className="flex flex-wrap gap-4 items-center text-sm"><span>WhatsApp: {formatBrazilianPhone(selected.whatsapp ?? '') || '—'}</span><span className="break-all">Pix: {selected.pix_key ?? '—'}</span><Button variant="outline" size="sm" onClick={() => copy(selected)}><Copy />Copiar link</Button></div>
      <Tabs defaultValue="salons"><TabsList className="max-w-full"><TabsTrigger value="salons">Salões</TabsTrigger><TabsTrigger value="commissions">Comissões</TabsTrigger><TabsTrigger value="payouts">Repasses</TabsTrigger></TabsList>
        <TabsContent value="salons"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Salão</TableHead><TableHead>Cadastro</TableHead><TableHead>Plano atual</TableHead><TableHead>Conversão</TableHead></TableRow></TableHeader><TableBody>{report.data?.referrals.filter(r => r.ambassador_id === selected.id).map(r => <TableRow key={r.id}><TableCell>{r.business_name}</TableCell><TableCell>{date(r.created_at)}</TableCell><TableCell>{r.plan ?? '—'}</TableCell><TableCell>{r.converted ? 'Pagamento confirmado' : 'Sem pagamento confirmado'}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
        <TabsContent value="commissions"><div className="overflow-x-auto"><Table><TableHeader><TableRow>{['Salão', 'Mês da fatura', 'Plano', 'Base', '%', 'Comissão', 'Lançamento'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{report.data?.commissions.filter(e => e.ambassador_id === selected.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(e => <TableRow key={e.id}><TableCell>{e.business_name}</TableCell><TableCell>{date(e.billing_month)}</TableCell><TableCell>{e.plan_slug}</TableCell><TableCell>{fmtBRL(e.base_amount)}</TableCell><TableCell>{e.rate}%</TableCell><TableCell>{fmtBRL(e.amount)}</TableCell><TableCell>{e.reason}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
        <TabsContent value="payouts"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Comprovante / ID Pix</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader><TableBody>{report.data?.payouts.filter(p => p.ambassador_id === selected.id).map(p => <TableRow key={p.id}><TableCell>{date(p.paid_on)}</TableCell><TableCell>{fmtBRL(p.amount)}</TableCell><TableCell className="break-all">{p.receipt_reference}</TableCell><TableCell>{p.notes || '—'}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
      </Tabs>
    </>}
    {(report.data?.review.filter(r => !selected || r.ambassador_id === selected.id).length ?? 0) > 0 && <div className="border border-warning rounded-md p-4 text-sm"><h3 className="font-semibold text-warning">Faturas aguardando conferência</h3>{report.data?.review.filter(r => !selected || r.ambassador_id === selected.id).map(r => <p key={r.id}>{r.business_name} · plano ou data de pagamento sem confirmação</p>)}</div>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>{editing?.id ? 'Editar embaixador' : 'Novo embaixador'}</DialogTitle></DialogHeader><form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-4">
      <div><Label htmlFor="amb-name">Nome</Label><Input id="amb-name" required maxLength={120} value={editing?.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
      <div><Label htmlFor="amb-code">Código exclusivo</Label><Input id="amb-code" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9-]{2,39}" value={editing?.code ?? ''} disabled={!!editing?.id} onChange={e => setEditing({ ...editing, code: e.target.value.toLowerCase().replace(/\s/g, '-') })} /></div>
      <div><Label htmlFor="amb-phone">WhatsApp</Label><Input id="amb-phone" inputMode="tel" value={formatBrazilianPhone(editing?.whatsapp ?? '')} onChange={e => setEditing({ ...editing, whatsapp: formatBrazilianPhone(e.target.value) })} /></div>
      <div><Label htmlFor="amb-pix">Chave Pix</Label><Input id="amb-pix" maxLength={255} value={editing?.pix_key ?? ''} onChange={e => setEditing({ ...editing, pix_key: e.target.value })} /></div>
      <div className="flex items-center gap-2"><Switch id="amb-active" checked={editing?.active ?? true} onCheckedChange={active => setEditing({ ...editing, active })} /><Label htmlFor="amb-active">Receber novas indicações</Label></div>
      <DialogFooter><Button variant="outline" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar embaixador'}</Button></DialogFooter>
    </form></DialogContent></Dialog>
    <Dialog open={!!payout} onOpenChange={open => { if (!open && !busy) setPayout(null); }}><DialogContent><DialogHeader><DialogTitle>Registrar repasse</DialogTitle></DialogHeader><form onSubmit={e => { e.preventDefault(); void savePayout(); }} className="space-y-4">
      <p className="text-sm text-muted-foreground">Saldo: {fmtBRL(selected ? selected.earned - selected.paid : 0)}</p>
      <div><Label htmlFor="payout-amount">Valor repassado (R$)</Label><Input id="payout-amount" required inputMode="decimal" value={payout?.amount ?? ''} onChange={e => payout && setPayout({ ...payout, amount: e.target.value })} /></div>
      <div><Label htmlFor="payout-date">Data do pagamento</Label><Input id="payout-date" required type="date" max={today()} value={payout?.date ?? ''} onChange={e => payout && setPayout({ ...payout, date: e.target.value })} /></div>
      <div><Label htmlFor="payout-receipt">Link do comprovante ou ID da transação Pix</Label><Input id="payout-receipt" required minLength={3} maxLength={500} value={payout?.receipt ?? ''} onChange={e => payout && setPayout({ ...payout, receipt: e.target.value })} /></div>
      <div><Label htmlFor="payout-notes">Observação</Label><Input id="payout-notes" maxLength={2000} value={payout?.notes ?? ''} onChange={e => payout && setPayout({ ...payout, notes: e.target.value })} /></div>
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setPayout(null)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Registrando...' : 'Confirmar repasse'}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </section>;
}