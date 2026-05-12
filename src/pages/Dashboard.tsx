import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar, Users, DollarSign, Target, TrendingUp, TrendingDown,
  AlertTriangle, Sparkles, ArrowRight, CheckCircle2, Clock, UserX, Phone
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const currencyBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Dashboard = () => {
  const { user, profile } = useAuth();

  if (!user) return <Navigate to="/auth" replace />;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

      const [salesRes, lastMonthRes, clientsRes, goalRes, todayApptRes] = await Promise.all([
        supabase.from('sales').select('amount').eq('establishment_id', profile.id)
          .gte('sale_date', firstDayOfMonth.toISOString()).lte('sale_date', today.toISOString()),
        supabase.from('sales').select('amount').eq('establishment_id', profile.id)
          .gte('sale_date', firstDayLastMonth.toISOString()).lte('sale_date', lastDayLastMonth.toISOString()),
        supabase.from('clients').select('id, name, phone, last_service_date').eq('establishment_id', profile.id),
        supabase.from('goals').select('target_amount, current_amount').eq('establishment_id', profile.id)
          .eq('month', today.getMonth() + 1).eq('year', today.getFullYear()).maybeSingle(),
        (async () => {
          const s = new Date(today); s.setHours(0,0,0,0);
          const e = new Date(today); e.setHours(23,59,59,999);
          return supabase.from('appointments').select('id, status, appointment_date').eq('establishment_id', profile.id)
            .gte('appointment_date', s.toISOString()).lte('appointment_date', e.toISOString());
        })(),
      ]);

      const sales = salesRes.data ?? [];
      const lastMonth = lastMonthRes.data ?? [];
      const clients = clientsRes.data ?? [];
      const appts = todayApptRes.data ?? [];

      const monthlyRevenue = sales.reduce((s, x) => s + Number(x.amount), 0);
      const lastMonthRevenue = lastMonth.reduce((s, x) => s + Number(x.amount), 0);
      const monthDelta = lastMonthRevenue > 0
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      const ticketMedio = sales.length ? monthlyRevenue / sales.length : 0;

      const twentyDaysAgo = new Date(); twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const inactive = clients.filter(c => !c.last_service_date || new Date(c.last_service_date) < twentyDaysAgo);
      const recoverable = inactive.length * ticketMedio;

      const pendingConfirm = appts.filter(a => a.status === 'scheduled' || a.status === 'pending').length;
      const completedToday = appts.filter(a => a.status === 'completed').length;
      const occupancy = appts.length ? Math.min(100, Math.round((appts.length / 10) * 100)) : 0;

      return {
        monthlyRevenue, lastMonthRevenue, monthDelta,
        totalClients: clients.length,
        inactiveClients: inactive,
        recoverable,
        ticketMedio,
        todayAppointments: appts.length,
        pendingConfirm,
        completedToday,
        occupancy,
        goalProgress: goalRes.data ? (Number(goalRes.data.current_amount) / Number(goalRes.data.target_amount)) * 100 : 0,
        goalTarget: Number(goalRes.data?.target_amount ?? 0),
        goalCurrent: Number(goalRes.data?.current_amount ?? 0),
      };
    },
    enabled: !!profile?.id,
  });

  const positive = (stats?.monthDelta ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background">
      <main className="container mx-auto px-4 py-6 md:py-10 space-y-8">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 md:p-10 text-primary-foreground shadow-elegant animate-fade-in">
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute -left-10 -bottom-20 w-64 h-64 rounded-full bg-primary-glow/40 blur-3xl" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              {profile?.business_name || 'Seu salão'}
            </div>
            {isLoading ? (
              <Skeleton className="h-12 w-3/4 bg-white/20" />
            ) : (
              <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight">
                Seu salão faturou{' '}
                <span className="text-accent">{currencyBRL(stats?.monthlyRevenue ?? 0)}</span>{' '}
                este mês 💰
              </h1>
            )}
            <p className="mt-3 text-base md:text-lg text-primary-foreground/85">
              {positive ? (
                <>Você está <strong>{Math.abs(stats?.monthDelta ?? 0).toFixed(1)}%</strong> acima do mês passado. Continue assim!</>
              ) : (
                <>Você está <strong>{Math.abs(stats?.monthDelta ?? 0).toFixed(1)}%</strong> abaixo do mês passado. Bora virar o jogo?</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="cta" size="lg">
                <Link to="/sales">Registrar venda <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" className="bg-white/15 hover:bg-white/25 text-primary-foreground border border-white/20">
                <Link to="/agenda">Ver agenda de hoje</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* METRIC CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <MetricCard
            icon={<DollarSign className="h-5 w-5" />}
            tint="primary"
            label="Faturamento do mês"
            value={isLoading ? null : currencyBRL(stats?.monthlyRevenue ?? 0)}
            delta={stats?.monthDelta}
            deltaLabel="vs. mês passado"
          />
          <MetricCard
            icon={<Calendar className="h-5 w-5" />}
            tint={stats && stats.todayAppointments === 0 ? 'warning' : 'success'}
            label="Agendamentos hoje"
            value={isLoading ? null : String(stats?.todayAppointments ?? 0)}
            hint={
              stats?.todayAppointments
                ? `${stats.completedToday} concluídos • ${stats.pendingConfirm} a confirmar`
                : 'Agenda livre — bora preencher?'
            }
          />
          <MetricCard
            icon={<Users className="h-5 w-5" />}
            tint="primary"
            label="Clientes na base"
            value={isLoading ? null : String(stats?.totalClients ?? 0)}
            hint={`Ticket médio: ${currencyBRL(stats?.ticketMedio ?? 0)}`}
          />
          <MetricCard
            icon={<Target className="h-5 w-5" />}
            tint={stats && stats.goalProgress >= 100 ? 'success' : stats && stats.goalProgress >= 50 ? 'primary' : 'warning'}
            label="Meta do mês"
            value={isLoading ? null : `${(stats?.goalProgress ?? 0).toFixed(0)}%`}
            hint={`${currencyBRL(stats?.goalCurrent ?? 0)} de ${currencyBRL(stats?.goalTarget ?? 0)}`}
            progress={stats?.goalProgress}
          />
        </section>

        {/* OPORTUNIDADE + AÇÕES */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recuperar clientes — destaque */}
          <Card className="lg:col-span-2 relative overflow-hidden border-0 shadow-card bg-gradient-to-br from-[hsl(var(--danger-soft))] via-background to-background">
            <div className="absolute top-0 right-0 w-48 h-48 bg-destructive/10 rounded-full blur-3xl" />
            <CardContent className="relative p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-destructive/15 text-destructive p-3">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-destructive">
                    Oportunidade de faturamento
                  </div>
                  <h3 className="mt-1 text-2xl md:text-3xl font-bold text-foreground">
                    Você pode recuperar{' '}
                    <span className="text-destructive">{currencyBRL(stats?.recoverable ?? 0)}</span> hoje
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    <strong>{stats?.inactiveClients.length ?? 0} clientes</strong> estão inativos há mais de 20 dias.
                    Um WhatsApp pode trazê-los de volta.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild size="lg" variant="default">
                      <Link to="/clients?filter=inactive">
                        <Phone className="h-4 w-4" /> Recuperar clientes
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="lg">
                      <Link to="/clients">Ver todos</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ações do dia */}
          <Card className="border-0 shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Ações do dia</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Faça hoje para faturar mais</p>
              <div className="space-y-2">
                <ActionItem
                  icon={<UserX className="h-4 w-4" />}
                  text={`Reativar ${stats?.inactiveClients.length ?? 0} clientes`}
                  href="/clients?filter=inactive"
                  done={(stats?.inactiveClients.length ?? 0) === 0}
                />
                <ActionItem
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  text={`Confirmar ${stats?.pendingConfirm ?? 0} agendamentos`}
                  href="/agenda"
                  done={(stats?.pendingConfirm ?? 0) === 0}
                />
                <ActionItem
                  icon={<Clock className="h-4 w-4" />}
                  text="Preencher horários vagos"
                  href="/agenda"
                />
                <ActionItem
                  icon={<DollarSign className="h-4 w-4" />}
                  text="Registrar vendas do dia"
                  href="/sales"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SHORTCUTS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/agenda', label: 'Agenda', icon: Calendar },
            { to: '/sales', label: 'Nova venda', icon: DollarSign },
            { to: '/clients', label: 'Clientes', icon: Users },
            { to: '/reports', label: 'Relatórios', icon: TrendingUp },
          ].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-card transition-all duration-200"
            >
              <div className="rounded-lg bg-primary/10 text-primary p-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <span className="font-medium text-sm">{label}</span>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  tint: 'primary' | 'success' | 'warning' | 'danger';
  label: string;
  value: string | null;
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  progress?: number;
}

const tintMap = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning-foreground',
  danger: 'bg-destructive/15 text-destructive',
};

function MetricCard({ icon, tint, label, value, delta, deltaLabel, hint, progress }: MetricCardProps) {
  const showDelta = typeof delta === 'number';
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="group border-0 shadow-card hover:shadow-elegant hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('rounded-xl p-2.5', tintMap[tint])}>{icon}</div>
          {showDelta && (
            <div className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
              positive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            )}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta!).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        {value === null ? (
          <Skeleton className="h-8 w-24 mt-1" />
        ) : (
          <div className="text-2xl md:text-3xl font-bold mt-1 tabular-nums">{value}</div>
        )}
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        {deltaLabel && showDelta && <div className="text-xs text-muted-foreground mt-1">{deltaLabel}</div>}
        {typeof progress === 'number' && (
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progress >= 100 ? 'bg-success' : progress >= 50 ? 'bg-primary' : 'bg-warning'
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionItem({ icon, text, href, done }: { icon: React.ReactNode; text: string; href: string; done?: boolean }) {
  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-3 rounded-lg p-2.5 text-sm transition-colors',
        done ? 'bg-success/5 text-muted-foreground line-through' : 'hover:bg-secondary'
      )}
    >
      <div className={cn(
        'rounded-md p-1.5',
        done ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'
      )}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : icon}
      </div>
      <span className="flex-1">{text}</span>
      {!done && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
    </Link>
  );
}

export default Dashboard;
