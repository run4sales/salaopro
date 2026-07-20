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
import {
  DEFAULT_CLOSING_TIME,
  DEFAULT_OPENING_TIME,
  DEFAULT_WORKING_DAYS,
  buildDefaultWeeklyHours,
  generateWeeklySlots,
  isDateOpen,
  normalizeTimeValue,
  normalizeWeeklyHours,
  normalizeWorkingDays,
  type WeeklyHours,
} from "@/lib/businessHours";

interface Service { id: string; name: string; price: number; duration: number }
interface Professional { id: string; name: string }
interface BlockRange { start_time: string; end_time: string; reason?: string | null }

export default function PublicBooking() {
  const { establishmentId, slug } = useParams<{ establishmentId?: string; slug?: string }>();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState<string>("");
  const [acceptingBookings, setAcceptingBookings] = useState<boolean>(true);
  const [weekly, setWeekly] = useState<WeeklyHours>(() => buildDefaultWeeklyHours());
  const [lookupState, setLookupState] = useState<"loading" | "ok" | "not_found">("loading");
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<BlockRange[]>([]);
  const [slot, setSlot] = useState<string>("");

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
      const applySalon = (salon: any) => {
        setResolvedId(salon.id);
        setSalonName(salon.business_name || "");
        setAcceptingBookings(salon.accepting_bookings !== false);
        const legacyOpen = normalizeTimeValue(salon.opening_time, DEFAULT_OPENING_TIME);
        const legacyClose = normalizeTimeValue(salon.closing_time, DEFAULT_CLOSING_TIME);
        const legacyDays = normalizeWorkingDays(salon.working_days);
        setWeekly(normalizeWeeklyHours(salon.weekly_hours, {
          openingTime: legacyOpen,
          closingTime: legacyClose,
          workingDays: legacyDays,
        }));
        setLookupState("ok");
        document.title = `${salon.business_name || "Agendar atendimento"} | Beauty Core`;
      };

      if (slug) {
        const { data, error } = await supabase.rpc("get_public_salon_by_slug", { p_slug: slug });
        const salon = data as any;
        if (error || !salon?.id) { setLookupState("not_found"); return; }
        applySalon(salon);
      } else if (establishmentId) {
        const { data, error } = await supabase.rpc("get_public_salon_by_id", { p_id: establishmentId });
        const salon = data as any;
        if (error || !salon?.id) { setLookupState("not_found"); return; }
        applySalon(salon);
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
  const dayIsOpen = date ? isDateOpen(date, weekly) : false;

  useEffect(() => {
    if (!resolvedId || !primaryProfessionalId || !date) {
      setBookedTimes([]); setBlocks([]); return;
    }
    (async () => {
      const dayStr = format(date, "yyyy-MM-dd");
      const { data: avData, error } = await supabase.rpc("get_public_availability", {
        establishment: resolvedId,
        professional: primaryProfessionalId,
        day: dayStr,
      });
      if (error) {
        toast({ title: "Erro ao carregar disponibilidade", description: error.message, variant: "destructive" });
        return;
      }
      const avail = avData as any;
      setBookedTimes((avail?.booked ?? []) as string[]);
      setBlocks((avail?.blocks ?? []) as BlockRange[]);
      setSlot("");
    })();
  }, [resolvedId, primaryProfessionalId, date, toast]);

  const slots = useMemo(() => {
    if (!date) return [] as Date[];
    return generateWeeklySlots(
      date,
      weekly,
      Math.max(totalDuration, 30),
      30,
    );
  }, [weekly, date, totalDuration]);

  const isBooked = (d: Date) => bookedTimes.some((iso) => {
    const bd = new Date(iso);
    return isSameDay(bd, d) && bd.getHours() === d.getHours() && bd.getMinutes() === d.getMinutes();
  });

  const isBlocked = (d: Date) => {
    const end = new Date(d.getTime() + Math.max(totalDuration, 30) * 60_000);
    return blocks.some(b => new Date(b.start_time) < end && new Date(b.end_time) > d);
  };

  const availableSlots = useMemo(() => slots.filter(d => !isBooked(d) && !isBlocked(d)), [slots, bookedTimes, blocks, totalDuration]);
  const showNoAvailability = !!primaryProfessionalId && !!date && dayIsOpen && serviceIds.length > 0 && slots.length > 0 && availableSlots.length === 0;

  const canSubmit = !!resolvedId && serviceIds.length > 0 && professionalIds.length > 0 && !!date && !!slot && !!clientName && !!phone && dayIsOpen;

  const handleSubmit = async () => {
    if (!canSubmit || !date) return;
    const [hh, mm] = slot.split(":").map(Number);
    const startTime = new Date(date);
    startTime.setHours(hh, mm, 0, 0);
    const { data, error } = await supabase.rpc("create_public_booking", {
      establishment: resolvedId!,
      client_name: clientName,
      p_phone: phone,
      p_services: serviceIds,
      p_professionals: professionalIds,
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
                      <Checkbox checked={checked} onCheckedChange={() => setServiceIds(prev => checked ? prev.filter(x => x !== s.id) : [...prev, s.id])} />
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
                      <Checkbox checked={checked} onCheckedChange={() => setProfessionalIds(prev => checked ? prev.filter(x => x !== p.id) : [...prev, p.id])} />
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
                  <Calendar
                    selected={date}
                    onSelect={setDate}
                    mode="single"
                    disabled={(d) => !isDateOpen(d, weekly)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Horário</label>
              {date && !dayIsOpen ? (
                <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  A loja está fechada neste dia. Escolha outra data.
                </p>
              ) : showNoAvailability ? (
                <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  Este profissional não possui horários disponíveis neste período. Escolha outro profissional ou selecione outra data.
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {slots.map((d) => {
                    const label = format(d, "HH:mm");
                    const disabled = isBooked(d) || isBlocked(d) || serviceIds.length === 0 || professionalIds.length === 0;
                    const isActive = slot === label;
                    return (
                      <Button key={label} variant={isActive ? "default" : "outline"} disabled={disabled} onClick={() => setSlot(label)}>
                        {label}
                      </Button>
                    );
                  })}
                  {slots.length === 0 && (
                    <p className="col-span-3 text-sm text-muted-foreground">Selecione um serviço para ver os horários disponíveis.</p>
                  )}
                </div>
              )}
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
