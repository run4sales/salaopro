import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, ShieldAlert } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { EditSaleDialog } from "@/components/sales/EditSaleDialog";
import { DeleteSaleDialog } from "@/components/sales/DeleteSaleDialog";


const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function SalesHistory() {
  const { profile, establishmentRole } = useAuth();
  const establishmentId = profile?.id as string | undefined;
  const isAdmin = establishmentRole === "owner" || establishmentRole === "admin";

  useEffect(() => { document.title = "Histórico de Vendas | Beauty Core"; }, []);

  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sales-history", establishmentId, startDate, endDate],
    enabled: !!establishmentId && isAdmin,
    queryFn: async () => {
      const startISO = new Date(`${startDate}T00:00:00`).toISOString();
      const endISO = new Date(`${endDate}T23:59:59`).toISOString();
      const [salesRes, clientsRes, servicesRes, profsRes, salePros] = await Promise.all([
        supabase.from("sales")
          .select("id, client_id, service_id, professional_id, amount, gross_amount, fee_amount, net_amount, credit_used, sale_date, payment_method, installments, notes")
          .eq("establishment_id", establishmentId!)
          .is("deleted_at" as any, null)
          .gte("sale_date", startISO).lte("sale_date", endISO)
          .order("sale_date", { ascending: false }),
        supabase.from("clients").select("id, name").eq("establishment_id", establishmentId!),
        supabase.from("services").select("id, name").eq("establishment_id", establishmentId!),
        supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId!),
        supabase.from("sale_professionals").select("sale_id, professional_id").eq("establishment_id", establishmentId!),
      ]);
      if (salesRes.error) throw salesRes.error;
      const sales = (salesRes.data ?? []) as any[];
      const clients = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
      const services = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const profs = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.name]));
      const proBySale = new Map<string, string[]>();
      for (const sp of salePros.data ?? []) {
        const arr = proBySale.get((sp as any).sale_id) ?? [];
        arr.push(profs.get((sp as any).professional_id) ?? "?");
        proBySale.set((sp as any).sale_id, arr);
      }
      return sales.map((s) => ({
        ...s,
        clientName: clients.get(s.client_id) ?? "-",
        serviceName: services.get(s.service_id) ?? "-",
        professionalNames: proBySale.get(s.id) ?? (s.professional_id ? [profs.get(s.professional_id) ?? "-"] : []),
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((r: any) =>
      r.clientName.toLowerCase().includes(q) ||
      r.serviceName.toLowerCase().includes(q) ||
      (r.professionalNames.join(", ").toLowerCase().includes(q))
    );
  }, [data, search]);

  const total = useMemo(() => filtered.reduce((s: number, r: any) => s + Number(r.amount || 0), 0), [filtered]);

  if (!establishmentId) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  if (!isAdmin) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="font-semibold">Acesso restrito</div>
            <p className="text-sm text-muted-foreground">Apenas administradores podem acessar o histórico de vendas.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Histórico de Vendas</h1>
        <p className="text-sm text-muted-foreground">Edite ou exclua vendas finalizadas. Alterações revertem automaticamente estoque, crédito, comissões e fluxo de caixa.</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar (cliente, serviço, profissional)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite para filtrar..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vendas ({filtered.length})</CardTitle>
          <div className="text-sm">Total: <span className="font-semibold">{fmt(total)}</span></div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda no período.</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço/Produto</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(r.sale_date), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{r.clientName}</TableCell>
                      <TableCell>{r.serviceName}</TableCell>
                      <TableCell>{r.professionalNames.join(", ") || "-"}</TableCell>
                      <TableCell>{r.payment_method ?? "-"}{r.installments ? ` ${r.installments}x` : ""}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(r.amount))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(r.id)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditSaleDialog
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        saleId={editId}
        establishmentId={establishmentId}
        onSaved={refetch}
      />
      <DeleteSaleDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        saleId={deleteId}
        onDeleted={refetch}
      />
    </main>
  );
}
