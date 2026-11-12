import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReceivables, money, type Receivable } from "@/lib/receivables";
import { receivableBalance, receivableLabels, receivableStatus } from "@/lib/finance/receivableRules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceivableDetails } from "./ReceivableDetails";
export function ClientReceivables({establishmentId,clientId}:{establishmentId:string;clientId:string}){
 const [details,setDetails]=useState<Receivable|null>(null);const {data=[],error,isLoading}=useQuery({queryKey:["receivables","client",establishmentId,clientId],queryFn:()=>fetchReceivables(establishmentId,clientId),refetchInterval:60000});
 if(error)return <p className="text-destructive">Não foi possível carregar as dívidas.</p>;
 return <section className="space-y-3"><h3 className="font-semibold">Contas a receber</h3><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Dívidas em aberto</p><strong>{money(data.filter(a=>!a.canceled_at).reduce((s,a)=>s+receivableBalance(a),0))}</strong></div><div><p className="text-xs text-muted-foreground">Recebido das dívidas</p><strong>{money(data.reduce((s,a)=>s+Number(a.received_amount),0))}</strong></div></div>{isLoading?<p>Carregando...</p>:data.length===0?<p className="text-sm text-muted-foreground">Nenhuma dívida registrada.</p>:data.map(a=><div className="border-b py-3" key={a.id}><div className="flex flex-wrap justify-between gap-2"><b>{a.description}</b><Badge variant={receivableStatus(a).includes("overdue")?"destructive":"secondary"}>{receivableLabels[receivableStatus(a)]}</Badge></div><div className="flex justify-between items-center gap-2 mt-2 text-sm"><span>Vence {a.due_date.split("-").reverse().join("/")} · Saldo {money(receivableBalance(a))}</span><Button variant="outline" size="sm" onClick={()=>setDetails(a)}>Ver recebimentos</Button></div></div>)}<ReceivableDetails key={details?.id} account={details} onClose={()=>setDetails(null)}/></section>;
}