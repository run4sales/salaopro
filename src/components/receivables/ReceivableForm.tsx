import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientCombobox } from "@/components/ClientCombobox";
import { brazilToday } from "@/lib/finance/receivableRules";
import { paymentMethods, type Receivable } from "@/lib/receivables";
import { refreshReceivables } from "./ReceivableDetails";
import { toast } from "sonner";

export function ReceivableForm({ establishmentId, editing, onClose }: { establishmentId: string; editing?: Receivable; onClose: () => void }) {
  const qc=useQueryClient(); const request=useRef(crypto.randomUUID()); const lock=useRef(false); const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({ client_id:editing?.client_id??"", service_id:editing?.service_id??"", professional_id:editing?.professional_id??"", description:editing?.description??"", amount:String(editing?.amount??""), entry_date:editing?.entry_date??brazilToday(), due_date:editing?.due_date??brazilToday(), expected_method:editing?.expected_method??"Pix", notes:editing?.notes??"" });
  const field=(key: keyof typeof form, value:string)=>setForm(f=>({...f,[key]:value}));
  const {data}=useQuery({queryKey:["receivable-catalog",establishmentId],queryFn:async()=>{
    const [s,p]=await Promise.all([supabase.from("services").select("id,name").eq("establishment_id",establishmentId).order("name"),supabase.from("professionals").select("id,name").eq("establishment_id",establishmentId).order("name")]);
    if(s.error) throw s.error; if(p.error) throw p.error; return {services:s.data??[],professionals:p.data??[]};
  }});
  async function save(e:React.FormEvent){e.preventDefault(); if(lock.current) return; if(!form.client_id || Number(form.amount)<=0) return toast.error("Selecione um cliente e informe o valor."); lock.current=true;setBusy(true);
    try { const payload={...form,amount:Number(form.amount)}; const result=editing ? await supabase.rpc("update_receivable",{p_id:editing.id,p_data:payload}) : await supabase.rpc("create_receivable",{p_establishment:establishmentId,p_data:payload,p_request:request.current}); if(result.error) throw result.error; await refreshReceivables(qc);toast.success("Conta salva.");onClose(); } catch(e){toast.error((e as {message?:string}).message??"Não foi possível salvar.");} finally{lock.current=false;setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-xl max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?"Editar conta":"Nova conta a receber"}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4">
    {!editing && <><Label>Cliente cadastrado</Label><ClientCombobox establishmentId={establishmentId} value={form.client_id} allowCreate={false} onChange={id=>field("client_id",id)} /><div className="grid sm:grid-cols-2 gap-3">{([['service_id','Serviço / produto','services'],['professional_id','Profissional','professionals']] as const).map(([key,label,list])=><div key={key}><Label>{label}</Label><Select value={form[key]||"none"} onValueChange={v=>field(key,v==="none"?"":v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem vínculo</SelectItem>{data?.[list].map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>)}</div></>}
    <div><Label htmlFor="debt-description">Descrição da dívida</Label><Input id="debt-description" required value={form.description} onChange={e=>field("description",e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="debt-amount">Valor total devido</Label><Input id="debt-amount" type="number" min="0.01" step="0.01" required disabled={!!editing?.comanda_id} value={form.amount} onChange={e=>field("amount",e.target.value)} /></div><div><Label htmlFor="debt-due">Vencimento</Label><Input id="debt-due" type="date" required value={form.due_date} onChange={e=>field("due_date",e.target.value)} /></div>{!editing && <div><Label htmlFor="debt-entry">Data de lançamento</Label><Input id="debt-entry" type="date" max={brazilToday()} required value={form.entry_date} onChange={e=>field("entry_date",e.target.value)} /></div>}<div><Label>Forma de pagamento prevista</Label><Select value={form.expected_method} onValueChange={v=>field("expected_method",v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map(m=><SelectItem value={m} key={m}>{m}</SelectItem>)}</SelectContent></Select></div></div><div><Label htmlFor="debt-notes">Observações adicionais</Label><Textarea id="debt-notes" value={form.notes} onChange={e=>field("notes",e.target.value)} /></div><Button className="w-full" disabled={busy}>{busy?"Salvando...":"Salvar conta"}</Button>
    </form></DialogContent></Dialog>;
}