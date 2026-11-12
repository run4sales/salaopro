import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money, paymentMethods, type Receivable } from "@/lib/receivables";
import { brazilToday, receivableBalance, receivableLabels, receivableStatus, validateReceipt } from "@/lib/finance/receivableRules";
import { toast } from "sonner";

export async function refreshReceivables(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all(["receivables", "receivable-payments", "receivable-details", "client-crm", "cash-flow", "cashflow", "reports", "dashboard", "strategic-dashboard", "sales-history", "financial-dashboard", "revenue-general"].map(key => qc.invalidateQueries({ queryKey: [key] })));
}
export function ReceivableDetails({ account, onClose }: { account: Receivable | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(brazilToday());
  const [method, setMethod] = useState("Pix");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef(crypto.randomUUID());
  const { data, error, refetch } = useQuery({ queryKey: ["receivable-details", account?.id], enabled: !!account, queryFn: async () => {
    if (!account) return null;
    const [row, payments, audit, sales] = await Promise.all([
      supabase.from("receivables").select("*").eq("id", account.id).eq("establishment_id", account.establishment_id).single(),
      supabase.from("receivable_payments").select("*").eq("receivable_id", account.id).eq("establishment_id", account.establishment_id).order("payment_date"),
      supabase.from("receivable_audit_logs").select("*").eq("receivable_id", account.id).eq("establishment_id", account.establishment_id).order("created_at"),
      supabase.from("sales").select("id, amount, paid_now, credit_used, sale_date, payment_method, services(name)").eq("receivable_id",account.id).eq("establishment_id",account.establishment_id),
    ]);
    for (const result of [row,payments,audit,sales]) if (result.error) throw result.error;
    return { account: row.data, payments: payments.data ?? [], audit: audit.data ?? [], sales: sales.data ?? [] };
  } });
  const current = data?.account ?? account;
  if (!current) return null;
  const balance = receivableBalance(current);
  async function receive(event: React.FormEvent) {
    event.preventDefault();
    if (!current || lock.current) return;
    if (!validateReceipt(current, Number(amount))) return toast.error("Informe um valor positivo até o saldo restante.");
    lock.current = true; setBusy(true);
    try {
      const { error } = await supabase.rpc("receive_receivable", { p_id: current.id, p_amount: Number(amount), p_date: date, p_method: method, p_notes: notes, p_request: request.current });
      if (error) throw error;
      request.current = crypto.randomUUID(); setAmount(""); setNotes(""); await refreshReceivables(qc); toast.success("Recebimento registrado.");
    } catch (e) { toast.error(e instanceof Error ? e.message : String((e as {message?: string}).message ?? "Falha ao receber.")); }
    finally { lock.current=false; setBusy(false); }
  }
  return <Dialog open={!!account} onOpenChange={open => !open && onClose()}><DialogContent className="max-w-xl max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{current.description}</DialogTitle></DialogHeader>
    {error ? <div className="text-destructive">Não foi possível carregar o histórico.<Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : <>
    <div className="grid grid-cols-3 gap-3 border-b pb-4 text-sm"><div>Dívida original<strong className="block">{money(current.amount)}</strong></div><div>Já recebido<strong className="block text-success">{money(current.received_amount)}</strong></div><div>Saldo restante<strong className="block">{money(balance)}</strong></div></div>
    <p className="text-sm">{receivableLabels[receivableStatus(current)]} · Vencimento {current.due_date.split("-").reverse().join("/")}</p>
    {current.cancellation_reason && <p className="text-sm text-muted-foreground">Cancelamento: {current.cancellation_reason}</p>}
    {(data?.sales ?? []).map(sale => <div key={sale.id} className="border-b py-2 text-sm"><b>{sale.services?.name}</b><p>Venda {money(sale.amount)} · Entrada {money(Number(sale.paid_now))} · Crédito {money(Number(sale.credit_used))}</p></div>)}
    {balance>0 && !current.canceled_at && <form onSubmit={receive} className="space-y-3"><h3 className="font-semibold">Registrar recebimento</h3><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="receipt-amount">Valor recebido agora</Label><Input id="receipt-amount" type="number" min="0.01" max={balance} step="0.01" value={amount} required onChange={e=>setAmount(e.target.value)} /></div><div><Label htmlFor="receipt-date">Data do recebimento</Label><Input id="receipt-date" type="date" min={current.entry_date} max={brazilToday()} value={date} required onChange={e=>setDate(e.target.value)} /></div></div><Label>Forma de pagamento</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map(m=><SelectItem value={m} key={m}>{m}</SelectItem>)}</SelectContent></Select><Label htmlFor="receipt-notes">Observações do recebimento</Label><Textarea id="receipt-notes" value={notes} onChange={e=>setNotes(e.target.value)} /><Button disabled={busy} className="w-full">{busy ? "Registrando..." : "Confirmar recebimento"}</Button></form>}
    <h3 className="font-semibold">Histórico de recebimentos</h3>{(data?.payments ?? []).length===0 && <p className="text-sm text-muted-foreground">Nenhum recebimento posterior registrado.</p>}{data?.payments.map(p=><div className="border-b py-2 text-sm" key={p.id}><div className="flex justify-between gap-2"><span>{p.payment_date.split("-").reverse().join("/")} · {p.payment_method}</span><strong>{money(p.amount)}</strong></div>{p.notes && <p className="text-muted-foreground">{p.notes}</p>}<p className="text-xs text-muted-foreground">Responsável: {p.created_by}</p></div>)}
    <details className="text-sm"><summary className="cursor-pointer">Auditoria</summary>{data?.audit.map(a=><p key={a.id} className="py-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")} · {({create:"Cadastro",receive:"Recebimento",edit:"Alteração",cancel:"Cancelamento"} as Record<string,string>)[a.operation]} · {a.user_id}</p>)}</details>
    </>}
  </DialogContent></Dialog>;
}