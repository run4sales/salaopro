import { useQuery } from "@tanstack/react-query";
import { fetchReceivables, fetchReceipts, money } from "@/lib/receivables";
import { receivableTotals } from "@/lib/finance/receivableRules";
export function ReceivableSummary({ establishmentId }: { establishmentId: string }) {
  const {data,error}=useQuery({queryKey:["receivables","summary",establishmentId],queryFn:async()=>{
    const [accounts,payments]=await Promise.all([fetchReceivables(establishmentId),fetchReceipts(establishmentId)]);return receivableTotals(accounts,payments);
  },refetchInterval:60000});
  if(error) return <p className="text-sm text-destructive">Não foi possível carregar contas a receber.</p>;
  return <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[["Total a receber",data?.open],["Recebido no mês",data?.received],["Contas vencidas",data?.overdue],["Contas a vencer",data?.upcoming],["Saldo parcialmente recebido",data?.partial]].map(([label,value])=><div key={String(label)} className="rounded-md border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="block mt-2 text-xl">{value===undefined?"—":money(Number(value))}</strong></div>)}</div>;
}