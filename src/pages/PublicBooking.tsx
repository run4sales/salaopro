import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_CLOSING_TIME, DEFAULT_OPENING_TIME, generateBusinessSlots, normalizeTimeValue } from "@/lib/businessHours";


const DEFAULT_OPENING_TIME = "08:00";
const DEFAULT_CLOSING_TIME = "19:00";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTimeValue(value: string | null | undefined, fallback: string): string {
  const candidate = String(value ?? "").slice(0, 5);
  return TIME_PATTERN.test(candidate) ? candidate : fallback;
}

function isBusinessHoursRangeValid(openingTime: string, closingTime: string): boolean {
  const [openHours, openMinutes] = openingTime.split(":").map(Number);
  const [closeHours, closeMinutes] = closingTime.split(":").map(Number);
  return TIME_PATTERN.test(openingTime) && TIME_PATTERN.test(closingTime) && openHours * 60 + openMinutes < closeHours * 60 + closeMinutes;
}

function buildDateAtTime(baseDate: Date, value: string): Date {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function generateBusinessSlots(date: Date, openingTime: string, closingTime: string, durationMinutes = 30, stepMinutes = 30): Date[] {
  if (!isBusinessHoursRangeValid(openingTime, closingTime)) return [];

  const end = buildDateAtTime(date, closingTime);
  const slots: Date[] = [];
  let current = buildDateAtTime(date, openingTime);

  while (current.getTime() + durationMinutes * 60_000 <= end.getTime()) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + stepMinutes * 60_000);
  }

  return slots;
}

interface Service { id: string; name: string; price: number; duration: number }
interface Professional { id: string; name: string }

export default function PublicBooking() {
  const { establishmentId, slug } = useParams<{ establishmentId?: string; slug?: string }>();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState<string>("");
  const [acceptingBookings, setAcceptingBookings] = useState<boolean>(true);
  const [businessHours, setBusinessHours] = useState({ openingTime: DEFAULT_OPENING_TIME, closingTime: DEFAULT_CLOSING_TIME });
  const [lookupState, setLookupState] = useState<"loading" | "ok" | "not_found">("loading");
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [bookedTimes, setBookedTimes] = useState<string[]>([]); // ISO strings
  const [slot, setSlot] = useState<string>(""); // HH:mm

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Agendar atendimento | Beauty Core";
    const desc = "Escolha serviço, profissional, dia e hora para agendar";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = window.location.href;
  }, []);

  useEffect(() => {
    const run = async () => {
      setLookupState("loading");
      if (slug) {
        const { data, error } = await supabase.rpc("get_public_salon_by_slug", { p_slug: slug });
        const salon = data as any;
        if (error || !salon?.id) {
          console.error("Slug lookup failed", error);
          setLookupState("not_found");
          return;
        }
        setResolvedId(salon.id);
        setSalonName(salon.business_name || "");
        setAcceptingBookings(salon.accepting_bookings !== false);
        setBusinessHours({
          openingTime: normalizeTimeValue(salon.opening_time, DEFAULT_OPENING_TIME),
          closingTime: normalizeTimeValue(salon.closing_time, DEFAULT_CLOSING_TIME),
        });
        setLookupState("ok");
        document.title = `${salon.business_name || "Agendar atendimento"} | Beauty Core`;
      } else if (establishmentId) {
        const { data, error } = await supabase.rpc("get_public_salon_by_id", { p_id: establishmentId });
        const salon = data as any;
        if (error || !salon?.id) {
          setLookupState("not_found");
          return;
        }
        setResolvedId(salon.id);
        setSalonName(salon.business_name || "");
        setAcceptingBookings(salon.accepting_bookings !== false);
        setBusinessHours({
          openingTime: normalizeTimeValue(salon.opening_time, DEFAULT_OPENING_TIME),
          closingTime: normalizeTimeValue(salon.closing_time, DEFAULT_CLOSING_TIME),
        });
        setLookupState("ok");
      } else {
        setLookupState("not_found");
      }
    };
    run();
  }, [slug, establishmentId]);

  useEffect(() => {
    if (!resolvedId) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_public_catalog", { establishment: resolvedId });
      if (error) {
        console.error(error);
        toast({ title: "Erro ao carregar catálogo", description: error.message, variant: "destructive" });
        return;
      }
      const catalog = data as any;
      setServices(((catalog?.services ?? []) as Service[]) || []);
      setProfessionals(((catalog?.professionals ?? []) as Professional[]) || []);
    })();
  }, [resolvedId, toast]);

  const selectedServices = useMemo(() => services.filter(s => serviceIds.includes(s.id)), [services, serviceIds]);
  const totalDuration = useMemo(() => selectedServices.reduce((sum, s) => sum + (Number(s.duration) || 0), 0), [selectedServices]);
  const totalPrice = useMemo(() => selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0), [selectedServices]);
  const priceFmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);
  const primaryProfessionalId = professionalIds[0] ?? "";

  // Load booked times for the first selected professional (used as availability reference)
  useEffect(() => {
    if (!resolvedId || !primaryProfessionalId || !date) return;
    (async () => {
      const dayStr = format(date, "yyyy-MM-dd");
      const { data: avData, error } = await supabase.rpc("get_public_availability", {
        establishment: resolvedId,
        professional: primaryProfessionalId,
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
  }, [resolvedId, primaryProfessionalId, date, toast]);


  const slots = useMemo(() => {
    if (!date) return [] as Date[];
    return generateBusinessSlots(date, businessHours.openingTime, businessHours.closingTime, Math.max(totalDuration, 30));
  }, [businessHours.closingTime, businessHours.openingTime, date, totalDuration]);

  const isBooked = (d: Date) => {
    // compare by hour/minute on same day
    return bookedTimes.some((iso) => {
      const bd = new Date(iso);
      return isSameDay(bd, d) && bd.getHours() === d.getHours() && bd.getMinutes() === d.getMinutes();
    });
  };

  const canSubmit = !!resolvedId && serviceIds.length > 0 && professionalIds.length > 0 && !!date && !!slot && !!clientName && !!phone;

  const handleSubmit = async () => {
    if (!canSubmit || !date) return;
    const [hh, mm] = slot.split(":").map(Number);
    const startTime = new Date(date);
    startTime.setHours(hh, mm, 0, 0);
    const { data, error } = await supabase.rpc("create_public_booking", {
      establishment: resolvedId!,
      client_name: clientName,
      p_phone: phone,
      services: serviceIds,
      professionals: professionalIds,
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


  if (lookupState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Carregando…</p>
      </div>
    );
  }

  if (lookupState === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">😕</div>
          <h1 className="text-2xl font-bold">Salão não encontrado</h1>
          <p className="text-muted-foreground">
            O link que você acessou não corresponde a nenhum salão ativo. Confira com o estabelecimento se o endereço está correto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Agendar atendimento {salonName ? `— ${salonName}` : ""}</h1>
          <p className="text-muted-foreground">Escolha serviço, profissional, data e hora</p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6">
        {!acceptingBookings && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
            ⏸️ Os agendamentos estão <strong>temporariamente indisponíveis</strong>. Tente novamente em breve.
          </div>
        )}
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", !acceptingBookings && "pointer-events-none opacity-60")}>
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Serviços</label>
              <div className="mt-1 rounded-md border max-h-44 overflow-auto divide-y">
                {services.map(s => {
                  const checked = serviceIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent/40">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => setServiceIds(prev => checked ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                      />
                      <span className="text-sm flex-1">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{priceFmt.format(Number(s.price))}</span>
                    </label>
                  );
                })}
                {services.length === 0 && <p className="text-sm text-muted-foreground p-2">Nenhum serviço disponível</p>}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Profissionais</label>
              <div className="mt-1 rounded-md border max-h-40 overflow-auto divide-y">
                {professionals.map(p => {
                  const checked = professionalIds.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent/40">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => setProfessionalIds(prev => checked ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  );
                })}
                {professionals.length === 0 && <p className="text-sm text-muted-foreground p-2">Nenhum profissional disponível</p>}
              </div>
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
                  const disabled = isBooked(d) || serviceIds.length === 0 || professionalIds.length === 0;
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
            {selectedServices.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Duração total: {totalDuration} min</p>
                <p>Valor total: {priceFmt.format(totalPrice)}</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
