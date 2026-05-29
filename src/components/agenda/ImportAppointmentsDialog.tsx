import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  AppointmentRow,
  buildTemplateBlob,
  detectColumns,
  mapStatusLabel,
  parseRows,
  readFile,
} from "@/lib/appointmentImport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  onImported: () => void;
}

type Step = "upload" | "preview" | "importing" | "done";

interface ImportResult {
  created: number;
  failed: { rowIndex: number; reason: string }[];
}

export default function ImportAppointmentsDialog({ open, onOpenChange, establishmentId, onImported }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed: AppointmentRow[] = useMemo(
    () => (rows.length ? parseRows(headers, rows) : []),
    [headers, rows]
  );
  const detected = useMemo(() => detectColumns(headers), [headers]);
  const validRows = parsed.filter((r) => r.errors.length === 0);
  const invalidRows = parsed.filter((r) => r.errors.length > 0);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setProgress(0);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    try {
      const { headers: h, rows: r } = await readFile(file);
      if (!h.length) {
        toast({ title: "Arquivo vazio", variant: "destructive" });
        return;
      }
      const cols = detectColumns(h);
      const missing: string[] = [];
      if (cols.date === undefined) missing.push("Data da venda");
      if (cols.client === undefined) missing.push("Cliente");
      if (cols.service === undefined) missing.push("Serviço e produto");
      if (missing.length) {
        toast({
          title: "Colunas obrigatórias ausentes",
          description: missing.join(", "),
          variant: "destructive",
        });
        return;
      }
      setFileName(file.name);
      setHeaders(h);
      setRows(r);
      setStep("preview");
    } catch (e: any) {
      toast({ title: "Erro ao ler arquivo", description: e.message, variant: "destructive" });
    }
  };

  const downloadTemplate = () => {
    const blob = buildTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-agendamentos.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    setStep("importing");
    setProgress(0);
    // Pré-carrega clientes, serviços e profissionais do estabelecimento
    const [clientsRes, servicesRes, profRes] = await Promise.all([
      supabase.from("clients").select("id, name").eq("establishment_id", establishmentId),
      supabase.from("services").select("id, name, price").eq("establishment_id", establishmentId),
      supabase.from("professionals").select("id, name").eq("establishment_id", establishmentId),
    ]);
    const clientByName = new Map<string, string>();
    (clientsRes.data ?? []).forEach((c: any) => clientByName.set(c.name.trim().toLowerCase(), c.id));
    const serviceByName = new Map<string, string>();
    (servicesRes.data ?? []).forEach((s: any) => serviceByName.set(s.name.trim().toLowerCase(), s.id));
    const profByName = new Map<string, string>();
    (profRes.data ?? []).forEach((p: any) => profByName.set(p.name.trim().toLowerCase(), p.id));

    const failed: { rowIndex: number; reason: string }[] = [];
    let created = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        // Resolve cliente
        const clientKey = row.clientName.toLowerCase();
        let clientId = clientByName.get(clientKey);
        if (!clientId) {
          const { data, error } = await supabase
            .from("clients")
            .insert({ establishment_id: establishmentId, name: row.clientName, phone: "" })
            .select("id")
            .single();
          if (error) throw new Error("Cliente: " + error.message);
          clientId = data.id;
          clientByName.set(clientKey, clientId);
        }

        // Resolve serviço
        const serviceKey = row.serviceName.toLowerCase();
        let serviceId = serviceByName.get(serviceKey);
        if (!serviceId) {
          const { data, error } = await supabase
            .from("services")
            .insert({
              establishment_id: establishmentId,
              name: row.serviceName,
              price: row.price ?? 0,
              duration_minutes: 30,
              description: row.category || null,
            })
            .select("id")
            .single();
          if (error) throw new Error("Serviço: " + error.message);
          serviceId = data.id;
          serviceByName.set(serviceKey, serviceId);
        }

        // Resolve profissional (opcional)
        let professionalId: string | null = null;
        if (row.professionalName) {
          const profKey = row.professionalName.toLowerCase();
          professionalId = profByName.get(profKey) ?? null;
          if (!professionalId) {
            const { data, error } = await supabase
              .from("professionals")
              .insert({ establishment_id: establishmentId, name: row.professionalName, active: true })
              .select("id")
              .single();
            if (error) throw new Error("Profissional: " + error.message);
            professionalId = data.id;
            profByName.set(profKey, professionalId);
          }
        }

        // Cria agendamento
        const { error: apptErr } = await supabase.from("appointments").insert({
          establishment_id: establishmentId,
          client_id: clientId,
          service_id: serviceId,
          professional_id: professionalId,
          appointment_date: row.date!.toISOString(),
          status: mapStatusLabel(row.statusLabel),
          notes: row.category ? `Importado · ${row.category}` : "Importado via planilha",
        });
        if (apptErr) throw new Error("Agendamento: " + apptErr.message);
        created++;
      } catch (e: any) {
        failed.push({ rowIndex: row.rowIndex, reason: e.message ?? "Erro desconhecido" });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setResult({ created, failed });
    setStep("done");
    if (created > 0) onImported();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar agendamentos
          </DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV ou XLSX com os agendamentos futuros do seu salão.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/40 transition"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
              >
                <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <div className="font-medium">Clique ou arraste o arquivo</div>
                <div className="text-xs text-muted-foreground mt-1">.xlsx ou .csv (máx. 20MB)</div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
              <div className="rounded-md border p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">Modelo da planilha</div>
                  <div className="text-xs text-muted-foreground">
                    Colunas: Data, Horário Início, Cliente, Serviço, Profissional, Situação, Valor (R$)
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-1" /> Baixar modelo
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{fileName}</Badge>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {validRows.length} válidas
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" /> {invalidRows.length} com erro
                  </Badge>
                )}
              </div>
              <div className="rounded-md border overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.slice(0, 100).map((r) => (
                      <TableRow key={r.rowIndex} className={r.errors.length ? "bg-destructive/10" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{r.rowIndex}</TableCell>
                        <TableCell className="text-xs">
                          {r.date ? r.date.toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{r.clientName || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {r.serviceName || "—"}
                          {r.category && <span className="text-muted-foreground"> · {r.category}</span>}
                        </TableCell>
                        <TableCell className="text-xs">{r.professionalName || "—"}</TableCell>
                        <TableCell className="text-xs">{r.statusLabel || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {r.price != null ? `R$ ${r.price.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.errors.length ? (
                            <span className="text-destructive">{r.errors.join(", ")}</span>
                          ) : (
                            <span className="text-emerald-600">OK</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsed.length > 100 && (
                <div className="text-xs text-muted-foreground">
                  Mostrando 100 de {parsed.length} linhas.
                </div>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="py-12 space-y-3 text-center">
              <div className="text-sm text-muted-foreground">Importando agendamentos...</div>
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground">{progress}%</div>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-3 py-4">
              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium">{result.created} agendamentos criados</span>
                </div>
                {result.failed.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium">{result.failed.length} falharam</span>
                  </div>
                )}
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-5 w-5" />
                    <span>{invalidRows.length} linhas ignoradas por validação</span>
                  </div>
                )}
              </div>
              {result.failed.length > 0 && (
                <div className="rounded-md border max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.failed.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell>{f.rowIndex}</TableCell>
                          <TableCell className="text-xs text-destructive">{f.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Trocar arquivo</Button>
              <Button onClick={runImport} disabled={validRows.length === 0}>
                Importar {validRows.length} agendamentos
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={() => close(false)}>Concluir</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
