import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import {
  FIELD_LABELS,
  FieldKey,
  ParsedRow,
  autoMapHeader,
  exportErrorReport,
  parseRows,
  readSpreadsheet,
} from "@/lib/clientImportExport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  onImported: () => void;
}

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

export default function ImportClientsDialog({ open, onOpenChange, establishmentId, onImported }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<number, FieldKey>>({});
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    failed: { rowIndex: number; reason: string; data: any }[];
  } | null>(null);

  const parsed: ParsedRow[] = useMemo(
    () => (rows.length ? parseRows(headers, rows, mapping) : []),
    [headers, rows, mapping]
  );

  const validCount = parsed.filter((r) => r.errors.length === 0).length;
  const invalidCount = parsed.length - validCount;

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setProgress(0);
    setResult(null);
  }

  async function handleFile(file: File) {
    try {
      const { headers, rows } = await readSpreadsheet(file);
      if (headers.length === 0) {
        toast({ title: "Arquivo vazio", variant: "destructive" });
        return;
      }
      const map: Record<number, FieldKey> = {};
      headers.forEach((h, i) => (map[i] = autoMapHeader(h)));
      setFileName(file.name);
      setHeaders(headers);
      setRows(rows);
      setMapping(map);
      setStep("mapping");
    } catch (e: any) {
      toast({ title: "Erro ao ler arquivo", description: e?.message ?? String(e), variant: "destructive" });
    }
  }

  async function executeImport() {
    setStep("importing");
    setProgress(0);

    const valid = parsed.filter((r) => r.errors.length === 0);
    const failed: { rowIndex: number; reason: string; data: any }[] = parsed
      .filter((r) => r.errors.length > 0)
      .map((r) => ({ rowIndex: r.rowIndex, reason: r.errors.join("; "), data: { nome: r.name, telefone: r.phone } }));

    // Preload existing clients for matching
    const { data: existingAll, error: loadErr } = await supabase
      .from("clients")
      .select("id, name, phone, email, birth_date")
      .eq("establishment_id", establishmentId);

    if (loadErr) {
      toast({ title: "Erro ao carregar clientes", description: loadErr.message, variant: "destructive" });
      setStep("preview");
      return;
    }

    const byPhone = new Map<string, any>();
    const byEmail = new Map<string, any>();
    const byNameBirth = new Map<string, any>();
    (existingAll ?? []).forEach((c: any) => {
      const p = (c.phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
      const pNorm = p.length === 10 || p.length === 11 ? "55" + p : p;
      if (pNorm) byPhone.set(pNorm, c);
      if (c.email) byEmail.set(String(c.email).toLowerCase(), c);
      if (c.name && c.birth_date) byNameBirth.set(`${String(c.name).toLowerCase().trim()}|${c.birth_date}`, c);
    });

    let created = 0;
    let updated = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        let existing =
          (r.phone && byPhone.get(r.phone)) ||
          (r.email && byEmail.get(r.email)) ||
          (r.name && r.birth_iso && byNameBirth.get(`${r.name.toLowerCase().trim()}|${r.birth_iso}`));

        const base: Record<string, any> = {
          establishment_id: establishmentId,
          import_source: fileName,
          imported_at: now,
        };
        // Only set fields that have values (don't overwrite with empty)
        const setIfValue = (k: string, v: any) => {
          if (v !== null && v !== undefined && v !== "") base[k] = v;
        };
        setIfValue("name", r.name);
        setIfValue("nickname", r.nickname);
        setIfValue("phone", r.phone);
        setIfValue("email", r.email);
        setIfValue("instagram", r.instagram);
        setIfValue("gender", r.gender);
        if (r.birth_iso) base.birth_date = r.birth_iso;
        if (r.birth_day) base.birth_day = r.birth_day;
        if (r.birth_month) base.birth_month = r.birth_month;
        if (r.balance !== 0 || !existing) base.balance = r.balance;

        if (existing) {
          const { error } = await supabase.from("clients").update(base).eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          // phone is NOT NULL — fallback to placeholder if missing
          if (!base.phone) base.phone = "";
          if (!base.name) base.name = "(sem nome)";
          const { error } = await (supabase as any).from("clients").insert(base);
          if (error) throw error;
          created++;
        }
      } catch (e: any) {
        failed.push({ rowIndex: r.rowIndex, reason: e?.message ?? String(e), data: { nome: r.name, telefone: r.phone } });
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    setResult({ created, updated, failed });
    setStep("done");
    onImported();
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Clientes</DialogTitle>
          <DialogDescription>
            Importe sua base de clientes via planilha (.xlsx ou .csv)
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Arraste sua planilha aqui</p>
            <p className="text-sm text-muted-foreground mb-4">Aceita .xlsx e .csv</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Selecionar arquivo
            </Button>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Arquivo: <span className="font-medium text-foreground">{fileName}</span> · {rows.length} linhas
            </div>
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna da planilha</TableHead>
                    <TableHead>Exemplo</TableHead>
                    <TableHead>Mapear para</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{h || `Coluna ${i + 1}`}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {String(rows[0]?.[i] ?? "—")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[i] ?? "ignore"}
                          onValueChange={(v) => setMapping({ ...mapping, [i]: v as FieldKey })}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(FIELD_LABELS) as FieldKey[]).map((k) => (
                              <SelectItem key={k} value={k}>
                                {FIELD_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={reset}>
                Voltar
              </Button>
              <Button onClick={() => setStep("preview")}>Continuar</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validCount} válidos
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="text-sm">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {invalidCount} com erro
                </Badge>
              )}
            </div>
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nasc.</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.slice(0, 100).map((r) => (
                    <TableRow key={r.rowIndex}>
                      <TableCell className="text-xs">{r.rowIndex}</TableCell>
                      <TableCell className="font-medium">{r.name || "—"}</TableCell>
                      <TableCell className="text-xs">{r.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{r.email || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.birth_iso ?? (r.birth_day ? `${r.birth_day}/${r.birth_month}` : "—")}
                      </TableCell>
                      <TableCell className="text-xs">{r.balance.toFixed(2)}</TableCell>
                      <TableCell>
                        {r.errors.length === 0 ? (
                          <Badge variant="outline" className="text-xs">
                            OK
                          </Badge>
                        ) : (
                          <span className="text-xs text-destructive">{r.errors.join(", ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsed.length > 100 && (
              <p className="text-xs text-muted-foreground">Mostrando 100 de {parsed.length} linhas.</p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Voltar
              </Button>
              <Button onClick={executeImport} disabled={validCount === 0}>
                Confirmar importação ({validCount} clientes)
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-8">
            <p className="text-center font-medium">Importando clientes...</p>
            <Progress value={progress} />
            <p className="text-center text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-md border p-4 text-center">
                <div className="text-2xl font-bold text-success">{result.created}</div>
                <div className="text-xs text-muted-foreground">Novos clientes</div>
              </div>
              <div className="rounded-md border p-4 text-center">
                <div className="text-2xl font-bold">{result.updated}</div>
                <div className="text-xs text-muted-foreground">Atualizados</div>
              </div>
              <div className="rounded-md border p-4 text-center">
                <div className="text-2xl font-bold text-destructive">{result.failed.length}</div>
                <div className="text-xs text-muted-foreground">Falhas</div>
              </div>
            </div>
            {result.failed.length > 0 && (
              <Button variant="outline" className="w-full" onClick={() => exportErrorReport(result.failed)}>
                <Download className="h-4 w-4 mr-2" />
                Baixar relatório de erros (CSV)
              </Button>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Nova importação
              </Button>
              <Button onClick={() => handleClose(false)}>Concluir</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
