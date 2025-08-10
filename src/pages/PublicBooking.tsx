import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMinutes, setHours, setMinutes, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Service { id: string; name: string; price: number; duration: number }
interface Professional { id: string; name: string }

export default function PublicBooking() {
  const { establishmentId } = useParams<{ establishmentId: string }>();
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [bookedTimes, setBookedTimes] = useState<string[]>([]); // ISO strings
  const [slot, setSlot] = useState<string>(""); // HH:mm
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Agendar atendimento | Salão PRO";
    const desc = "Escolha serviço, profissional, dia e hora para agendar";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = window.location.href;
  }, []);

  useEffect(() => {
    if (!establishmentId) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_public_catalog", { establishment: establishmentId });
      if (error) {
        console.error(error);
        toast({ title: "Erro ao carregar catálogo", description: error.message, variant: "destructive" });
        return;
      }
      const catalog = data as any;
      setServices(((catalog?.services ?? []) as Service[]) || []);
      setProfessionals(((catalog?.professionals ?? []) as Professional[]) || []);
    })();
  }, [establishmentId, toast]);

  const selectedService = useMemo(() => services.find(s => s.id === serviceId), [services, serviceId]);
  const priceFmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  // Load booked times whenever professional/date changes
  useEffect(() => {
    if (!establishmentId || !professionalId || !date) return;
    (async () => {
      const dayStr = format(date, "yyyy-MM-dd");
      const { data: avData, error } = await supabase.rpc("get_public_availability", {
        establishment: establishmentId,
        professional: professionalId,
        day: dayStr,
      });
      if (error) {
        console.error(error);
        toast({ title: "Erro ao carregar disponibilidade", description: error.message, variant: "destructive" });
        return;
      }
      const avail = avData as any;
      const booked = (avail?.booked ?? []) as string[];
      setBookedTimes(booked);
      setSlot("");
    })();
  }, [establishmentId, professionalId, date, toast]);

  const slots = useMemo(() => {
    if (!date) return [] as Date[];
    const start = setMinutes(setHours(new Date(date), 9), 0); // 09:00
    const end = setMinutes(setHours(new Date(date), 18), 0); // 18:00
    const out: Date[] = [];
    let cur = start;
    while (cur <= end) {
      out.push(new Date(cur));
      cur = addMinutes(cur, 30);
    }
    return out;
  }, [date]);

  const isBooked = (d: Date) => {
    // compare by hour/minute on same day
    return bookedTimes.some((iso) => {
      const bd = new Date(iso);
      return isSameDay(bd, d) && bd.getHours() === d.getHours() && bd.getMinutes() === d.getMinutes();
    });
  };

  const canSubmit = establishmentId && serviceId && professionalId && date && slot && clientName && phone;

  const handleSubmit = async () => {
    if (!canSubmit || !date) return;
    const [hh, mm] = slot.split(":").map(Number);
    const startTime = setMinutes(setHours(new Date(date), hh), mm);
    const { data, error } = await supabase.rpc("create_public_booking", {
      establishment: establishmentId,
      client_name: clientName,
      phone,
      service: serviceId,
      professional: professionalId,
      start_time: startTime.toISOString(),
      notes: notes || null,
    });
    if (error) {
      toast({ title: "Não foi possível agendar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Agendamento confirmado!", description: `Código: ${data}` });
    setSlot("");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Agendar atendimento</h1>
          <p className="text-muted-foreground">Escolha serviço, profissional, data e hora</p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Serviço</label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {priceFmt.format(Number(s.price))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Profissional</label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Data</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start mt-1", !date && "text-muted-foreground")}> 
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Escolha uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar selected={date} onSelect={setDate} mode="single" className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Horário</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {slots.map((d) => {
                  const label = format(d, "HH:mm");
                  const disabled = isBooked(d) || !serviceId || !professionalId;
                  const isActive = slot === label;
                  return (
                    <Button key={label} variant={isActive ? "default" : "outline"} disabled={disabled} onClick={() => setSlot(label)}>
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Seu nome</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Telefone (WhatsApp)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Observações</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>Confirmar agendamento</Button>
            {selectedService && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Duração estimada: {selectedService.duration} min</p>
                <p>Valor: {priceFmt.format(Number(selectedService.price))}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
