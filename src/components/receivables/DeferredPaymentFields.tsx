import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { money } from "@/lib/receivables";
export function DeferredPaymentFields({enabled,onEnabled,paid,onPaid,due,onDue,total}:{enabled:boolean;onEnabled:(v:boolean)=>void;paid:string;onPaid:(v:string)=>void;due:string;onDue:(v:string)=>void;total:number}){
 return <div className="space-y-3 border-t py-3"><div className="flex items-center justify-between gap-3"><Label htmlFor="deferred-switch">Pagamento posterior / fiado</Label><Switch id="deferred-switch" checked={enabled} onCheckedChange={onEnabled}/></div>{enabled&&<><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="deferred-paid">Receber agora</Label><Input id="deferred-paid" type="number" step="0.01" min="0" max={total} value={paid} onChange={e=>onPaid(e.target.value)}/></div><div><Label htmlFor="deferred-due">Vencimento do saldo</Label><Input id="deferred-due" type="date" required value={due} onChange={e=>onDue(e.target.value)}/></div></div><p className="text-sm font-semibold">Saldo a receber: {money(Math.max(0,total-Number(paid||0)))}</p></>}</div>;
}