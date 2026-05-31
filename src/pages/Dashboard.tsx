import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar, Users, DollarSign, TrendingUp, AlertTriangle, Plus,
  ArrowRight, Clock, Phone, CheckCircle2, CircleDashed, AlertCircle,
  Sparkles, Target, UserX
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const currencyBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const WEEKDAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Working day window
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 20;
const SLOT_MINUTES = 60;

type ApptStatus = 'scheduled' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface ApptRow {
  id: string;
  appointment_date: string;
  status: ApptStatus | string;
  client_id: string;
  service_id: string;
  professional_id: string | null;
}

const Dashboard = () => {
  const { user, profile, establishmentRole } = useAuth();
  const canViewFinance = establishmentRole === 'owner' || establishmentRole === 'admin';
  const [view, setView] = useState<'time' | 'pro'>('time');


  if (!user) return <Navigate to="/auth" replace />;

  const today = useMemo(() => new Date(), []);
  const startOfDay = useMemo(() => { const d = new Date(today); d.setHours(0,0,0,0); return d; }, [today]);
  const endOfDay = useMemo(() => { const d = new Date(today); d.setHours(23,59,59,999); return d; }, [today]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-agenda', profile?.id, startOfDay.toISOString()],
    enabled: !!profile?.id,
    queryFn: async () => {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [apptRes, salesTodayRes, salesMonthRes, clientsRes, servicesRes, profRes, goalRes] = await Promise.all([
        supabase.from('appointments')
          .select('id, appointment_date, status, client_id, service_id, professional_id')
          .eq('establishment_id', profile!.id)
          .gte('appointment_date', startOfDay.toISOString())
          .lte('appointment_date', endOfDay.toISOString())
          .order('appointment_date', { ascending: true }),
        supabase.from('sales').select('amount').eq('establishment_id', profile!.id)
          .gte('sale_date', startOfDay.toISOString()).lte('sale_date', endOfDay.toISOString()),
        supabase.from('sales').select('amount').eq('establishment_id', profile!.id)
          .gte('sale_date', firstDayOfMonth.toISOString()).lte('sale_date', endOfDay.toISOString()),
        supabase.from('clients').select('id, name, last_service_date').eq('establishment_id', profile!.id),
        supabase.from('services').select('id, name, price, duration_minutes').eq('establishment_id', profile!.id),
        supabase.from('professionals').select('id, name, active').eq('establishment_id', profile!.id).eq('active', true),
        supabase.from('goals').select('target_amount, current_amount').eq('establishment_id', profile!.id)
          .eq('month', today.getMonth() + 1).eq('year', today.getFullYear()).maybeSingle(),
      ]);

      const appts = (apptRes.data ?? []) as ApptRow[];
      const services = servicesRes.data ?? [];
      const professionals = profRes.data ?? [];
      const clients = clientsRes.data ?? [];

      // Resolve client names for today's appts
      const clientIds = Array.from(new Set(appts.map(a => a.client_id)));
      let clientMap = new Map<string, string>();
      if (clientIds.length) {
        const cs = await supabase.from('clients').select('id, name').in('id', clientIds);
        clientMap = new Map((cs.data ?? []).map((c: any) => [c.id, c.name]));
      }
      const serviceMap = new Map(services.map((s: any) => [s.id, s]));
      const profMap = new Map(professionals.map((p: any) => [p.id, p.name]));

      const todayRevenue = (salesTodayRes.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const monthRevenue = (salesMonthRes.data ?? []).reduce((s, x) => s + Number(x.amount), 0);

      const expectedToday = appts
        .filter(a => a.status !== 'cancelled' && a.status !== 'no_show')
        .reduce((s, a) => s + Number((serviceMap.get(a.service_id) as any)?.price ?? 0), 0);

      // Inactive clients (>20d)
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 20);
      const inactiveClients = clients.filter(c => !c.last_service_date || new Date(c.last_service_date) < cutoff);

      return {
        appts, clientMap, serviceMap, profMap, professionals,
        todayRevenue, monthRevenue, expectedToday,
        inactiveCount: inactiveClients.length,
        goalCurrent: Number(goalRes.data?.current_amount ?? monthRevenue),
        goalTarget: Number(goalRes.data?.target_amount ?? 0),
      };
    },
  });

  // Derived agenda data
  const now = today;
  const enrichedAppts = useMemo(() => {
    if (!data) return [];
    return data.appts.map(a => {
      const start = new Date(a.appointment_date);
      const svc: any = data.serviceMap.get(a.service_id);
      const dur = svc?.duration_minutes ?? 60;
      const end = new Date(start.getTime() + dur * 60_000);
      let visualStatus: 'completed' | 'late' | 'next' | 'upcoming' | 'cancelled' = 'upcoming';
      if (a.status === 'completed') visualStatus = 'completed';
      else if (a.status === 'cancelled' || a.status === 'no_show') visualStatus = 'cancelled';
      else if (end < now) visualStatus = 'late';
      return {
        ...a,
        start, end, durationMin: dur,
        clientName: data.clientMap.get(a.client_id) ?? 'Cliente',
        serviceName: svc?.name ?? 'Serviço',
        servicePrice: Number(svc?.price ?? 0),
        professionalName: a.professional_id ? data.profMap.get(a.professional_id) ?? '—' : '—',
        visualStatus,
      };
    });
  }, [data, now]);

  // Mark "next" — first non-completed/cancelled upcoming
  const nextAppt = useMemo(() => {
    return enrichedAppts.find(a => a.visualStatus === 'upcoming' && a.start >= now)
      ?? enrichedAppts.find(a => a.visualStatus === 'upcoming');
  }, [enrichedAppts, now]);

  // Free slots (only when at least one professional)
  const freeSlots = useMemo(() => {
    if (!data) return [];
    const slots: { hour: number; label: string }[] = [];
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
      const slotStart = new Date(today); slotStart.setHours(h, 0, 0, 0);
      const slotEnd = new Date(today); slotEnd.setHours(h + 1, 0, 0, 0);
      // Skip past slots
      if (slotEnd < now) continue;
      const occupied = enrichedAppts.some(a =>
        a.visualStatus !== 'cancelled' &&
        a.start < slotEnd && a.end > slotStart
      );
      if (!occupied) {
        slots.push({ hour: h, label: `${String(h).padStart(2,'0')}:00 – ${String(h+1).padStart(2,'0')}:00` });
      }
    }
    return slots;
  }, [data, enrichedAppts, today, now]);

  const lateCount = enrichedAppts.filter(a => a.visualStatus === 'late').length;
  const pendingCount = enrichedAppts.filter(a => a.status === 'scheduled' || a.status === 'pending').length;
  const totalAppts = enrichedAppts.filter(a => a.visualStatus !== 'cancelled').length;

  const dateLabel = `${WEEKDAYS[today.getDay()]}, ${today.getDate()} de ${MONTHS[today.getMonth()]}`;

  // Group by professional
  const byProfessional = useMemo(() => {
    if (!data) return [];
    return data.professionals.map((p: any) => ({
      id: p.id,
      name: p.name,
      appts: enrichedAppts.filter(a => a.professional_id === p.id),
    }));
  }, [data, enrichedAppts]);

  const goalPct = data?.goalTarget ? Math.min(100, (data.goalCurrent / data.goalTarget) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 md:py-8 space-y-6 max-w-6xl">

        {/* HERO — AGENDA DO DIA */}
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/95 via-primary to-primary/80 text-primary-foreground p-6 md:p-8 shadow-elegant">
          <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 grid md:grid-cols-[1fr_auto] gap-6 items-end">
            <div className="space-y-4">
              <div className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70 capitalize">
                Hoje · {dateLabel}
              </div>

              <div className="flex flex-wrap gap-x-8 gap-y-3 text-primary-foreground/90">
                <div>
                  <div className="text-3xl font-bold tabular-nums">{isLoading ? '—' : totalAppts}</div>
                  <div className="text-xs uppercase tracking-wide opacity-75">Atendimentos</div>
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">{isLoading ? '—' : currencyBRL(data?.expectedToday ?? 0)}</div>
                  <div className="text-xs uppercase tracking-wide opacity-75">Previsto hoje</div>
                </div>
                {freeSlots.length > 0 && (
                  <div>
                    <div className="text-3xl font-bold tabular-nums">{freeSlots.length}</div>
                    <div className="text-xs uppercase tracking-wide opacity-75">Horários livres</div>
                  </div>
                )}
              </div>

              {nextAppt ? (
                <div className="rounded-xl bg-white/15 backdrop-blur border border-white/20 p-4 max-w-xl">
                  <div className="text-[11px] uppercase tracking-wider text-primary-foreground/75 mb-1">
                    Próximo atendimento
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl md:text-4xl font-bold tabular-nums">
                      {nextAppt.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-lg md:text-xl font-semibold">{nextAppt.serviceName}</span>
                  </div>
                  <div className="text-sm text-primary-foreground/85 mt-1">
                    {nextAppt.clientName} · com {nextAppt.professionalName}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-white/10 border border-white/15 p-4 max-w-xl text-sm text-primary-foreground/80">
                  Nenhum atendimento restante hoje. Que tal preencher os horários livres?
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:items-end">
              <Button asChild size="lg" variant="cta" className="font-semibold">
                <Link to="/agenda"><Plus className="h-4 w-4" /> Novo agendamento</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="bg-white/10 hover:bg-white/20 text-primary-foreground">
                <Link to="/agenda">Ver agenda completa</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* AÇÕES INTELIGENTES (orientadas a dados) */}
        {(lateCount > 0 || pendingCount > 0 || freeSlots.length > 0) && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {lateCount > 0 && (
              <SmartAction
                tone="danger"
                icon={<AlertCircle className="h-4 w-4" />}
                title={`${lateCount} ${lateCount === 1 ? 'atendimento atrasado' : 'atendimentos atrasados'}`}
                cta="Resolver agora"
                href="/agenda"
              />
            )}
            {freeSlots.length > 0 && (
              <SmartAction
                tone="warning"
                icon={<Clock className="h-4 w-4" />}
                title={`${freeSlots.length} ${freeSlots.length === 1 ? 'horário vago' : 'horários vagos'}`}
                cta="Preencher agenda"
                href="/agenda"
              />
            )}
            {pendingCount > 0 && (
              <SmartAction
                tone="info"
                icon={<Phone className="h-4 w-4" />}
                title={`${pendingCount} ${pendingCount === 1 ? 'confirmação pendente' : 'confirmações pendentes'}`}
                cta="Enviar WhatsApp"
                href="/agenda"
              />
            )}
          </section>
        )}

        {/* TIMELINE / POR PROFISSIONAL */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Agenda do dia
            </h2>
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="time" className="text-xs">Por horário</TabsTrigger>
                <TabsTrigger value="pro" className="text-xs">Por profissional</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Card className="border-0 shadow-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : view === 'time' ? (
                <TimeView
                  appts={enrichedAppts}
                  freeSlots={freeSlots}
                  nextApptId={nextAppt?.id}
                  now={now}
                />
              ) : (
                <ProView groups={byProfessional} nextApptId={nextAppt?.id} />
              )}
            </CardContent>
          </Card>
        </section>

        {/* FREE SLOTS opportunity (compact list) */}
        {freeSlots.length > 0 && (
          <section>
            <Card className="border border-warning/30 bg-warning/5">
              <CardContent className="p-5 flex items-center gap-4 flex-wrap">
                <div className="rounded-xl bg-warning/20 text-warning-foreground p-2.5">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">Horários livres hoje</div>
                  <div className="text-sm text-muted-foreground">
                    {freeSlots.slice(0, 4).map(s => s.label).join(' · ')}
                    {freeSlots.length > 4 && ` · +${freeSlots.length - 4}`}
                  </div>
                </div>
                <Button asChild>
                  <Link to="/agenda">Preencher horários</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* FINANCEIRO COMPACTO */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat icon={<DollarSign className="h-4 w-4" />} label="Hoje" value={isLoading ? '—' : currencyBRL(data?.todayRevenue ?? 0)} />
          <MiniStat icon={<TrendingUp className="h-4 w-4" />} label="Mês" value={isLoading ? '—' : currencyBRL(data?.monthRevenue ?? 0)} />
          <MiniStat icon={<Target className="h-4 w-4" />} label="Meta" value={data?.goalTarget ? `${goalPct.toFixed(0)}%` : '—'} progress={data?.goalTarget ? goalPct : undefined} />
          <MiniStat icon={<Users className="h-4 w-4" />} label="Inativos" value={isLoading ? '—' : String(data?.inactiveCount ?? 0)} hint="20+ dias" />
        </section>

        {/* RECUPERAÇÃO INTEGRADA */}
        {(data?.inactiveCount ?? 0) > 0 && (
          <section>
            <Card className="border-0 shadow-card bg-gradient-to-br from-[hsl(var(--danger-soft))] via-background to-background">
              <CardContent className="p-5 flex items-center gap-4 flex-wrap">
                <div className="rounded-xl bg-destructive/15 text-destructive p-2.5">
                  <UserX className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="text-xs uppercase tracking-wider text-destructive font-semibold">Oportunidade</div>
                  <div className="font-semibold mt-0.5">
                    {data?.inactiveCount} clientes inativos podem encaixar nos horários livres
                  </div>
                </div>
                <Button asChild variant="default">
                  <Link to="/clients?filter=inactive"><Phone className="h-4 w-4" /> Recuperar clientes</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* RODAPÉ — atalhos discretos */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
          {[
            { to: '/agenda', label: 'Agenda', icon: Calendar },
            { to: '/sales', label: 'Nova venda', icon: DollarSign },
            { to: '/clients', label: 'Clientes', icon: Users },
            { to: '/reports', label: 'Relatórios', icon: TrendingUp },
          ].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-card hover:border-primary/30 transition-all"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
};

/* ---------- Subcomponents ---------- */

function TimeView({ appts, freeSlots, nextApptId, now }: {
  appts: any[]; freeSlots: { hour: number; label: string }[]; nextApptId?: string; now: Date;
}) {
  // Merge appts and free slots into a single chronological list
  const items: Array<{ kind: 'appt' | 'free'; time: Date; data: any }> = [];
  appts.forEach(a => items.push({ kind: 'appt', time: a.start, data: a }));
  freeSlots.forEach(s => {
    const d = new Date(now); d.setHours(s.hour, 0, 0, 0);
    items.push({ kind: 'free', time: d, data: s });
  });
  items.sort((a, b) => a.time.getTime() - b.time.getTime());

  if (!items.length) {
    return (
      <div className="p-10 text-center text-muted-foreground text-sm">
        Sem agendamentos para hoje.
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((it, idx) => {
        if (it.kind === 'free') {
          return (
            <li key={`free-${idx}`} className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/40 transition-colors">
              <div className="w-16 text-sm font-mono font-semibold text-muted-foreground tabular-nums">
                {String(it.data.hour).padStart(2,'0')}:00
              </div>
              <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground italic">
                <CircleDashed className="h-3.5 w-3.5" />
                Horário livre
              </div>
              <Link to="/agenda" className="text-xs font-medium text-primary hover:underline">
                Preencher
              </Link>
            </li>
          );
        }
        const a = it.data;
        const isNext = a.id === nextApptId;
        const statusConf = STATUS_CONF[a.visualStatus];
        return (
          <li
            key={a.id}
            className={cn(
              'flex items-center gap-4 px-5 py-3 transition-colors',
              isNext ? 'bg-warning/10 border-l-4 border-warning' : 'hover:bg-secondary/40 border-l-4 border-transparent'
            )}
          >
            <div className={cn('w-16 text-sm font-mono font-bold tabular-nums', isNext && 'text-warning-foreground')}>
              {a.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className={cn('h-2 w-2 rounded-full shrink-0', statusConf.dot)} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{a.clientName}</div>
              <div className="text-xs text-muted-foreground truncate">
                {a.serviceName} · {a.professionalName}
              </div>
            </div>
            <span className={cn('hidden sm:inline-flex text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full', statusConf.badge)}>
              {statusConf.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ProView({ groups, nextApptId }: { groups: any[]; nextApptId?: string }) {
  if (!groups.length) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Nenhum profissional ativo.</div>;
  }
  return (
    <div className="divide-y">
      {groups.map(g => (
        <div key={g.id} className="px-5 py-4">
          <div className="text-sm font-semibold mb-2">{g.name}</div>
          {g.appts.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">Sem agendamentos hoje</div>
          ) : (
            <ul className="space-y-1.5">
              {g.appts.map((a: any) => {
                const isNext = a.id === nextApptId;
                const c = STATUS_CONF[a.visualStatus];
                return (
                  <li key={a.id} className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm',
                    isNext ? 'bg-warning/10' : 'hover:bg-secondary/40'
                  )}>
                    <span className="font-mono font-semibold tabular-nums w-12">
                      {a.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                    <span className="font-medium truncate flex-1">{a.clientName}</span>
                    <span className="text-xs text-muted-foreground truncate">{a.serviceName}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

const STATUS_CONF: Record<string, { label: string; dot: string; badge: string }> = {
  completed: { label: 'Concluído', dot: 'bg-success', badge: 'bg-success/15 text-success' },
  late:      { label: 'Atrasado',  dot: 'bg-destructive', badge: 'bg-destructive/15 text-destructive' },
  upcoming:  { label: 'Agendado',  dot: 'bg-primary', badge: 'bg-primary/10 text-primary' },
  next:      { label: 'Próximo',   dot: 'bg-warning', badge: 'bg-warning/20 text-warning-foreground' },
  cancelled: { label: 'Cancelado', dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground' },
};

function SmartAction({ tone, icon, title, cta, href }: {
  tone: 'danger' | 'warning' | 'info'; icon: React.ReactNode; title: string; cta: string; href: string;
}) {
  const map = {
    danger: 'border-destructive/30 bg-destructive/5 text-destructive',
    warning: 'border-warning/40 bg-warning/10 text-warning-foreground',
    info: 'border-primary/30 bg-primary/5 text-primary',
  };
  return (
    <Link to={href} className={cn('group flex items-center gap-3 rounded-xl border p-3 hover:shadow-card transition-all', map[tone])}>
      <div className="rounded-lg bg-background/60 p-2">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{title}</div>
        <div className="text-xs opacity-80">{cta}</div>
      </div>
      <ArrowRight className="h-4 w-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

function MiniStat({ icon, label, value, hint, progress }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; progress?: number;
}) {
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          {icon}{label}
        </div>
        <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
        {typeof progress === 'number' && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', progress >= 100 ? 'bg-success' : progress >= 50 ? 'bg-primary' : 'bg-warning')}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Dashboard;
