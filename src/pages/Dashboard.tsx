import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, DollarSign, Target, MessageCircle, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  console.log('Dashboard component rendering...');
  
  const { user, profile, signOut } = useAuth();
  console.log('useAuth result:', { user: !!user, profile: !!profile });

  if (!user) {
    console.log('No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Get monthly sales
      const { data: sales } = await supabase
        .from('sales')
        .select('amount')
        .eq('establishment_id', profile.id)
        .gte('sale_date', firstDayOfMonth.toISOString())
        .lte('sale_date', today.toISOString());

      // Get total clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, last_service_date')
        .eq('establishment_id', profile.id);

      // Get current month goal
      const { data: goal } = await supabase
        .from('goals')
        .select('target_amount, current_amount')
        .eq('establishment_id', profile.id)
        .eq('month', today.getMonth() + 1)
        .eq('year', today.getFullYear())
        .single();

      // Get today's appointments
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: todayAppointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', profile.id)
        .gte('appointment_date', startOfDay.toISOString())
        .lte('appointment_date', endOfDay.toISOString());

      const monthlyRevenue = sales?.reduce((sum, sale) => sum + Number(sale.amount), 0) || 0;
      const totalClients = clients?.length || 0;
      
      // Calculate inactive clients (no service in last 20 days)
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const inactiveClients = clients?.filter(client => 
        !client.last_service_date || new Date(client.last_service_date) < twentyDaysAgo
      ).length || 0;

      return {
        monthlyRevenue,
        totalClients,
        inactiveClients,
        todayAppointments: todayAppointments?.length || 0,
        goalProgress: goal ? (goal.current_amount / goal.target_amount) * 100 : 0,
        goalTarget: goal?.target_amount || 0,
        goalCurrent: goal?.current_amount || 0,
      };
    },
    enabled: !!profile?.id,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Salão PRO
            </h1>
            <p className="text-muted-foreground">
              Bem-vindo, {profile?.business_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/clients">Clientes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agenda">Agenda</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/services">Serviços</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/reports">Relatórios</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/settings">Configurações</Link>
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Revenue Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats?.monthlyRevenue?.toFixed(2) || '0,00'}
              </div>
            </CardContent>
          </Card>

          {/* Clients Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            </CardContent>
          </Card>

          {/* Today's Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.todayAppointments || 0}</div>
            </CardContent>
          </Card>

          {/* Goal Progress */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meta do Mês</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.goalProgress?.toFixed(0) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                R$ {stats?.goalCurrent?.toFixed(2) || '0,00'} / R$ {stats?.goalTarget?.toFixed(2) || '0,00'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Clientes Inativos
              </CardTitle>
              <CardDescription>
                {stats?.inactiveClients || 0} clientes sem atendimento há mais de 20 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link to="/clients?filter=inactive">
                  Ver Clientes Inativos
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Relatórios e Metas
              </CardTitle>
              <CardDescription>
                Acompanhe seu desempenho e defina suas metas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/reports">
                  Ver Relatórios
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;