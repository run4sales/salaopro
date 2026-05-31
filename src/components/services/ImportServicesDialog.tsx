import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  onImported?: () => void;
}

type Row = { name: string; kind: "service" | "product"; price: number };

const NAME_KEYS = ["nome", "name", "produto", "serviço", "servico", "item"];
const TYPE_KEYS = ["tipo", "type", "kind"];
const PRICE_KEYS = ["valor", "preço", "preco", "price", "valor (r$)"];

function pick(row: Record<string, any>, keys: string[]): any {
  const lowered: Record<string, any> = {};
  for (const k of Object.keys(row)) lowered[k.trim().toLowerCase()] = row[k];
  for (const k of keys) if (lowered[k] !== undefined && lowered[k] !== null && String(lowered[k]).trim() !== "") return lowered[k];
  return null;
}

function parsePrice(v: any): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

function normalizeKind(v: any): "service" | "product" {
  const s = String(v ?? "").trim().toLowerCase();
  if (["produto", "product", "p"].includes(s)) return "product";
  return "service";
}

export function ImportServicesDialog({ open, onOpenChange, establishmentId, onImported }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const parsed: Row[] = [];
    for (const r of json) {
      const name = String(pick(r, NAME_KEYS) ?? "").trim();
      if (!name) continue;
      const kind = normalizeKind(pick(r, TYPE_KEYS));
      const price = parsePrice(pick(r, PRICE_KEYS));
      if (!isFinite(price)) continue;
      parsed.push({ name, kind, price });
    }
    setRows(parsed);
    if (parsed.length === 0) {
      toast({ title: "Nenhuma linha válida encontrada", description: "Confira as colunas: Nome, Tipo, Valor.", variant: "destructive" });
    }
  };

  const downloadTemplate = () => {
    const data = [
      { Nome: "Corte feminino", Tipo: "Serviço", Valor: 60 },
      { Nome: "Shampoo profissional", Tipo: "Produto", Valor: 45.9 },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
    XLSX.writeFile(wb, "modelo-servicos-produtos.xlsx");
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    const payload = rows.map(r => ({
      establishment_id: establishmentId,
      name: r.name,
      price: r.price,
      duration_minutes: r.kind === "product" ? 0 : 30,
      kind: r.kind,
      active: true,
    }));
    const { error } = await supabase.from("services").insert(payload);
    setImporting(false);
    if (error) {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Importação concluída", description: `${rows.length} item(s) cadastrado(s).` });
    setRows([]);
    setFileName("");
    onOpenChange(false);
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar serviços e produtos</DialogTitle>
          <DialogDescription>
            Envie um arquivo <strong>XLSX</strong> ou <strong>CSV</strong> com as colunas: <strong>Nome</strong>, <strong>Tipo</strong> (Serviço ou Produto) e <strong>Valor</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Baixar modelo
            </Button>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="max-w-xs"
            />
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </div>

          {rows.length > 0 && (
            <div className="border rounded-md max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant={r.kind === "product" ? "secondary" : "default"}>
                          {r.kind === "product" ? "Produto" : "Serviço"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">R$ {r.price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!rows.length || importing}>
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Importando..." : `Importar ${rows.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
