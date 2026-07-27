/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarClock, CheckCircle2, Pencil, Plus, Search, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = ["Aluguel", "Água", "Energia", "Internet", "Marketing", "Produtos", "Funcionários", "Impostos", "Equipamentos", "Manutenção", "Outros"];
const CENTERS = ["Administrativo", "Recepção", "Marketing", "Estoque", "Serviços", "Produtos"];
const STATUS: Record<string, [string, "default" | "secondary" | "destructive" | "outline"]> = {
  pending: ["Pendente", "secondary"], due_today: ["Vence hoje", "default"], overdue: ["Vencida", "destructive"],
  partially_paid: ["Parcialmente paga", "outline"], paid: ["Paga", "secondary"], confirmed: ["Paga", "secondary"], cancelled: ["Cancelada", "outline"],
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isMissingPayablesSchema = (error: any) => error?.code === "PGRST202" || /schema cache|create_payables/i.test(error?.message ?? "");

interface Expense {
  id: string; description: string; amount: number; paid_amount: number; category: string | null; supplier: string | null;
  cost_center: string | null; notes: string | null; due_date: string; competence_date: string | null; expense_date: string;
  status: string; installment_number: number | null; installment_count: number | null; recurring_plan_id: string | null;
}
interface FormState { description: string; amount: string; category: string; supplier: string; cost_center: string; notes: string; due_date: string; competence_date: string; installments: string }
const initialForm = (): FormState => ({ description: "", amount: "", category: "Outros", supplier: "", cost_center: "Administrativo", notes: "", due_date: format(new Date(), "yyyy-MM-dd"), competence_date: format(new Date(), "yyyy-MM-dd"), installments: "1" });

// Kept at module scope: defining this component inside Expenses remounted every input on each render and caused focus loss.
function FormField({ label, field, type = "text", form, onChange }: { label: string; field: keyof FormState; type?: string; form: FormState; onChange: (field: keyof FormState, value: string) => void }) {
  return <div className="space-y-1"><Label htmlFor={`expense-${field}`}>{label}</Label><Input id={`expense-${field}`} type={type} step={type === "number" ? "0.01" : undefined} value={form[field]} onChange={(event) => onChange(field, event.target.value)} /></div>;
}
function Metric({ title, value, icon: Icon }: any) { return <Card><CardContent className="pt-5 flex justify-between"><div><p className="text-xs text-muted-foreground">{title}</p><p className="text-xl font-bold mt-1">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>; }
function PayField({ label, field, payment, setPayment, type = "text" }: any) { return <div className="space-y-1"><Label htmlFor={`payment-${field}`}>{label}</Label><Input id={`payment-${field}`} type={type} step={type === "number" ? "0.01" : undefined} value={payment[field]} onChange={(event) => setPayment((current: any) => ({ ...current, [field]: event.target.value }))} /></div>; }

function normalizeExpense(row: any): Expense {
  const date = (row.due_date || row.expense_date || "").slice(0, 10);
  const legacyPaid = row.status === "confirmed" || row.status === "paid";
  return { ...row, due_date: date, competence_date: row.competence_date || date, paid_amount: Number(row.paid_amount ?? (legacyPaid ? row.amount : 0)), supplier: row.supplier ?? null, cost_center: row.cost_center ?? null, installment_number: row.installment_number ?? null, installment_count: row.installment_count ?? null, recurring_plan_id: row.recurring_plan_id ?? null };
}

export default function Expenses() {
  const { profile, establishmentRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = establishmentRole === "owner" || establishmentRole === "admin";
  const isOwner = establishmentRole === "owner";
  const [form, setForm] = useState<FormState>(initialForm);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState({ date: format(new Date(), "yyyy-MM-dd"), amount: "", method: "pix", account: "Caixa principal", interest: "0", fine: "0", discount: "0", notes: "" });
  const [filters, setFilters] = useState({ q: "", status: "all", category: "all", supplier: "", from: "", to: "", min: "", max: "" });

  useEffect(() => { document.title = "Contas a Pagar | Beauty Core"; }, []);
  const { data: expenses = [], isLoading, error: listError } = useQuery<Expense[]>({
    queryKey: ["payables", profile?.id], enabled: !!profile?.id,
    queryFn: async () => {
      // Do not order/filter by new columns on the server: production can briefly run the old schema while migrations propagate.
      const { data, error } = await supabase.from("expenses").select("*").eq("establishment_id", profile.id).order("expense_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((row: any) => !row.deleted_at).map(normalizeExpense).sort((a, b) => b.due_date.localeCompare(a.due_date));
    },
  });
  useEffect(() => { if (listError) toast.error(`Não foi possível carregar as despesas: ${(listError as Error).message}`); }, [listError]);

  const rows = useMemo(() => expenses.filter((expense) => {
    const q = filters.q.toLowerCase();
    return (!q || expense.description.toLowerCase().includes(q) || (expense.supplier || "").toLowerCase().includes(q))
      && (filters.status === "all" || expense.status === filters.status || (filters.status === "paid" && expense.status === "confirmed"))
      && (filters.category === "all" || expense.category === filters.category)
      && (!filters.supplier || (expense.supplier || "").toLowerCase().includes(filters.supplier.toLowerCase()))
      && (!filters.from || expense.due_date >= filters.from) && (!filters.to || expense.due_date <= filters.to)
      && (!filters.min || expense.amount >= Number(filters.min)) && (!filters.max || expense.amount <= Number(filters.max));
  }), [expenses, filters]);
  const totals = useMemo(() => ({
    open: expenses.filter((expense) => !["paid", "confirmed", "cancelled"].includes(expense.status)).reduce((sum, expense) => sum + expense.amount - expense.paid_amount, 0),
    paid: expenses.filter((expense) => ["paid", "confirmed"].includes(expense.status) && isSameMonth(new Date(`${expense.due_date}T12:00:00`), new Date())).reduce((sum, expense) => sum + expense.paid_amount, 0),
    overdue: expenses.filter((expense) => expense.status === "overdue").reduce((sum, expense) => sum + expense.amount - expense.paid_amount, 0),
    today: expenses.filter((expense) => expense.status === "due_today").length,
  }), [expenses]);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["payables", profile?.id] }); queryClient.invalidateQueries({ queryKey: ["reports"] }); queryClient.invalidateQueries({ queryKey: ["cash-flow"] }); };
  const changeForm = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const legacyCreate = async () => {
    const count = Math.max(1, Number(form.installments)); const total = Number(form.amount); const parcel = Math.round((total / count) * 100) / 100;
    const records = Array.from({ length: count }, (_, index) => { const due = new Date(`${form.due_date}T12:00:00`); due.setMonth(due.getMonth() + index); return { establishment_id: profile.id, description: count > 1 ? `${form.description} (${index + 1}/${count})` : form.description, amount: index === count - 1 ? total - parcel * (count - 1) : parcel, category: form.category, notes: form.notes || null, expense_date: due.toISOString(), status: "pending" }; });
    const { error } = await supabase.from("expenses").insert(records); if (error) throw error;
    toast.warning("Conta salva no modo de compatibilidade. Os dados complementares serão habilitados após a migração do banco.");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canManage || !form.description.trim() || Number(form.amount) <= 0) return toast.error("Informe descrição e valor válido.");
    setBusy(true);
    try {
      const data = { ...form, amount: Number(form.amount) };
      let result = editing ? await (supabase as any).rpc("update_payable", { p_id: editing.id, p_changes: data }) : await (supabase as any).rpc("create_payables", { p_establishment: profile.id, p_data: data, p_installments: Number(form.installments) });
      if (result.error && isMissingPayablesSchema(result.error)) {
        if (editing) result = await supabase.from("expenses").update({ description: form.description, amount: Number(form.amount), category: form.category, notes: form.notes || null, expense_date: new Date(`${form.due_date}T12:00:00`).toISOString() }).eq("id", editing.id);
        else { await legacyCreate(); result = { error: null }; }
      }
      if (result.error) throw result.error;
      toast.success(editing ? "Despesa atualizada." : "Conta a pagar criada."); setEditing(null); setForm(initialForm()); invalidate();
    } catch (error: any) { toast.error(error.message); } finally { setBusy(false); }
  };
  const openEdit = (expense: Expense) => { setEditing(expense); setForm({ description: expense.description, amount: String(expense.amount), category: expense.category || "Outros", supplier: expense.supplier || "", cost_center: expense.cost_center || "Administrativo", notes: expense.notes || "", due_date: expense.due_date, competence_date: expense.competence_date || expense.due_date, installments: String(expense.installment_count || 1) }); };
  const pay = async () => { if (!paying) return; setBusy(true); try { const { error } = await (supabase as any).rpc("pay_expense", { p_id: paying.id, p_payment_date: payment.date, p_amount: Number(payment.amount), p_method: payment.method, p_account: payment.account, p_interest: Number(payment.interest), p_fine: Number(payment.fine), p_discount: Number(payment.discount), p_notes: payment.notes || null }); if (error) throw error; toast.success("Pagamento registrado e fluxo de caixa atualizado."); setPaying(null); invalidate(); } catch (error: any) { toast.error(error.message); } finally { setBusy(false); } };
  const remove = async (expense: Expense) => { if (!isOwner || !confirm(`Excluir “${expense.description}”? Movimentações relacionadas também serão removidas.`)) return; const { error } = await (supabase as any).rpc("delete_payable", { p_id: expense.id }); if (error) toast.error(error.message); else { toast.success("Despesa excluída."); invalidate(); } };

  return <div className="min-h-screen bg-background"><header className="border-b bg-card"><div className="container mx-auto px-4 py-6"><h1 className="text-2xl font-bold">Contas a Pagar</h1><p className="text-muted-foreground">Do previsto à quitação, com integração automática ao fluxo de caixa</p></div></header><main className="container mx-auto px-4 py-6 space-y-5">
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4"><Metric title="Total em aberto" value={money(totals.open)} icon={WalletCards} /><Metric title="Pago no mês" value={money(totals.paid)} icon={CheckCircle2} /><Metric title="Total vencido" value={money(totals.overdue)} icon={AlertTriangle} /><Metric title="Vencem hoje" value={String(totals.today)} icon={CalendarClock} /></div>
    {canManage && <Card><CardHeader><CardTitle className="flex gap-2"><Plus className="h-5 w-5" />{editing ? "Editar despesa" : "Nova conta a pagar"}</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid md:grid-cols-4 gap-3"><div className="md:col-span-2"><FormField label="Descrição" field="description" form={form} onChange={changeForm} /></div><FormField label="Fornecedor" field="supplier" form={form} onChange={changeForm} /><FormField label="Valor total" field="amount" type="number" form={form} onChange={changeForm} /><div className="space-y-1"><Label>Categoria</Label><Select value={form.category} onValueChange={(value) => changeForm("category", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Centro de custo</Label><Select value={form.cost_center} onValueChange={(value) => changeForm("cost_center", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CENTERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><FormField label="Competência" field="competence_date" type="date" form={form} onChange={changeForm} /><FormField label="Vencimento" field="due_date" type="date" form={form} onChange={changeForm} />{!editing && <FormField label="Parcelas" field="installments" type="number" form={form} onChange={changeForm} />}<div className="md:col-span-3 space-y-1"><Label>Observações</Label><Textarea value={form.notes} onChange={(event) => changeForm("notes", event.target.value)} /></div><div className="md:col-span-4 flex gap-2"><Button disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(initialForm()); }}>Cancelar</Button>}</div></form></CardContent></Card>}
    <Card><CardHeader><CardTitle>Contas</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Descrição ou fornecedor" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></div><Select value={filters.status} onValueChange={(status) => setFilters({ ...filters, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(STATUS).filter(([key]) => key !== "confirmed").map(([key, value]) => <SelectItem value={key} key={key}>{value[0]}</SelectItem>)}</SelectContent></Select><Select value={filters.category} onValueChange={(category) => setFilters({ ...filters, category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Input placeholder="Filtrar fornecedor" value={filters.supplier} onChange={(event) => setFilters({ ...filters, supplier: event.target.value })} /><Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /><Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /><Input type="number" placeholder="Valor mínimo" value={filters.min} onChange={(event) => setFilters({ ...filters, min: event.target.value })} /><Input type="number" placeholder="Valor máximo" value={filters.max} onChange={(event) => setFilters({ ...filters, max: event.target.value })} /></div>
      {isLoading ? <p>Carregando...</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta encontrada.</p> : <div className="space-y-2">{rows.map((expense) => { const status = STATUS[expense.status] || STATUS.pending; const balance = expense.amount - expense.paid_amount; return <div key={expense.id} className="rounded-lg border p-3 flex flex-col md:flex-row md:items-center gap-3"><div className="flex-1 min-w-0"><div className="flex flex-wrap gap-2 items-center"><b>{expense.description}</b><Badge variant={status[1]}>{status[0]}</Badge>{expense.installment_count && expense.installment_count > 1 && <Badge variant="outline">{expense.installment_number}/{expense.installment_count}</Badge>}</div><p className="text-xs text-muted-foreground mt-1">Vence {format(new Date(`${expense.due_date}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })} · {expense.supplier || "Sem fornecedor"} · {expense.category || "Sem categoria"} · {expense.cost_center || "Sem centro"}</p>{expense.paid_amount > 0 && <p className="text-xs mt-1">Pago {money(expense.paid_amount)} · Saldo {money(balance)}</p>}</div><div className="font-bold text-destructive">{money(expense.amount)}</div>{canManage && <div className="flex gap-1">{!["paid", "confirmed", "cancelled"].includes(expense.status) && <Button size="sm" onClick={() => { setPaying(expense); setPayment((current) => ({ ...current, amount: String(balance) })); }}>Pagar</Button>}{(!["paid", "confirmed"].includes(expense.status) || isOwner) && <Button size="icon" variant="ghost" onClick={() => openEdit(expense)}><Pencil className="h-4 w-4" /></Button>}{isOwner && <Button size="icon" variant="ghost" onClick={() => remove(expense)}><Trash2 className="h-4 w-4" /></Button>}</div>}</div>; })}</div>}</CardContent></Card>
  </main><Dialog open={!!paying} onOpenChange={(open) => !open && setPaying(null)}><DialogContent><DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3"><PayField label="Data" field="date" type="date" payment={payment} setPayment={setPayment} /><PayField label="Valor da dívida" field="amount" type="number" payment={payment} setPayment={setPayment} /><PayField label="Juros" field="interest" type="number" payment={payment} setPayment={setPayment} /><PayField label="Multa" field="fine" type="number" payment={payment} setPayment={setPayment} /><PayField label="Desconto" field="discount" type="number" payment={payment} setPayment={setPayment} /><div className="space-y-1"><Label>Forma de pagamento</Label><Select value={payment.method} onValueChange={(method) => setPayment({ ...payment, method })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pix", "dinheiro", "boleto", "transferência", "cartão"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2"><PayField label="Conta financeira" field="account" payment={payment} setPayment={setPayment} /></div><div className="col-span-2"><PayField label="Observações" field="notes" payment={payment} setPayment={setPayment} /></div><p className="col-span-2 text-sm font-medium">Saída realizada: {money(Number(payment.amount) + Number(payment.interest) + Number(payment.fine) - Number(payment.discount))}</p></div><DialogFooter><Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button><Button disabled={busy} onClick={pay}>Confirmar pagamento</Button></DialogFooter></DialogContent></Dialog></div>;
}
