import { useAuth } from '@/hooks/useAuth';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Cake, MessageCircle, Plus, Search, Edit, CalendarIcon, Settings, Upload, Download, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addDays, format, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import ImportClientsDialog from '@/components/clients/ImportClientsDialog';
import { exportClientsToXlsx, exportClientsToCsv } from '@/lib/clientImportExport';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ClientWalletDialog } from '@/components/clients/ClientWalletDialog';

const Clients = () => {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get('filter');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [birthdayFilter, setBirthdayFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [inactiveDaysConfig, setInactiveDaysConfig] = useState(20);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [walletClient, setWalletClient] = useState<any>(null);

  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    gender: '',
    birth_date: null as Date | null,
    last_service_date: null as Date | null,
    acquisition_source: '',
    notes: '',
  });

  const ACQUISITION_SOURCES = [
    { value: 'indicacao', label: 'Indicação' },
    { value: 'redes_sociais', label: 'Redes Sociais' },
    { value: 'google', label: 'Google' },
    { value: 'trafego_pago', label: 'Tráfego Pago' },
    { value: 'outros', label: 'Outros' },
  ];

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['settings', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      console.log('Fetching settings for establishment:', profile.id);
      
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('establishment_id', profile.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Settings error:', error);
        throw error;
      }
      console.log('Settings data:', data);
      return data;
    },
    enabled: !!profile?.id,
  });

  // Update inactiveDaysConfig when settings are loaded
  useEffect(() => {
    if (settings?.inactive_days_threshold) {
      setInactiveDaysConfig(settings.inactive_days_threshold);
    }
  }, [settings]);

  // Fetch clients
  const { data: allClients, isLoading } = useQuery({
    queryKey: ['clients', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      console.log('Fetching clients for establishment:', profile.id);

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('establishment_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Clients fetch error:', error);
        throw error;
      }
      console.log('Clients data:', data);
      return data;
    },
    enabled: !!profile?.id,
  });

  const getBirthdayParts = (birthDate?: string | null) => {
    if (!birthDate) return null;

    const [, month, day] = birthDate.split('T')[0]?.split('-').map(Number) ?? [];

    if (!day || !month) return null;

    return { day, month };
  };

  const formatBirthday = (birthDate?: string | null) => {
    const birthday = getBirthdayParts(birthDate);

    if (!birthday) return '-';

    return `${String(birthday.day).padStart(2, '0')}/${String(birthday.month).padStart(2, '0')}`;
  };

  const isBirthdayInCurrentWeek = (birthDate?: string | null) => {
    const birthday = getBirthdayParts(birthDate);

    if (!birthday) return false;

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });

    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).some(
      (date) => date.getDate() === birthday.day && date.getMonth() + 1 === birthday.month
    );
  };

  const matchesBirthdayFilter = (birthDate?: string | null) => {
    if (birthdayFilter === 'all') return true;

    const birthday = getBirthdayParts(birthDate);

    if (!birthday) return false;

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;

    if (birthdayFilter === 'today') {
      return birthday.day === currentDay && birthday.month === currentMonth;
    }

    if (birthdayFilter === 'month') {
      return birthday.month === currentMonth;
    }

    return isBirthdayInCurrentWeek(birthDate);
  };

  // Filter and search clients
  const filteredClients = allClients?.filter(client => {
    // Search filter
    const matchesSearch = !searchTerm || 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (!matchesBirthdayFilter(client.birth_date)) return false;

    // Inactive filter
    if (filterType === 'inactive') {
      const inactiveDays = settings?.inactive_days_threshold || 20;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
      
      return !client.last_service_date || new Date(client.last_service_date) < cutoffDate;
    }

    return true;
  }) || [];

  // Add client mutation
  const addClientMutation = useMutation({
    mutationFn: async (clientData: typeof newClient) => {
      console.log('Adding client with data:', clientData);
      console.log('Profile ID:', profile?.id);
      
      const insertData = {
        name: clientData.name,
        phone: clientData.phone,
        email: clientData.email || null,
        gender: clientData.gender || null,
        birth_date: clientData.birth_date?.toISOString().split('T')[0] || null,
        last_service_date: clientData.last_service_date?.toISOString() || null,
        acquisition_source: clientData.acquisition_source || null,
        notes: clientData.notes || null,
        establishment_id: profile?.id,
      };
      
      console.log('Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('clients')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      console.log('Client added successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setNewClient({ 
        name: '', 
        phone: '', 
        email: '', 
        gender: '', 
        birth_date: null, 
        last_service_date: null, 
        acquisition_source: '',
        notes: '' 
      });
      setIsAddDialogOpen(false);
      toast({
        title: 'Cliente adicionado!',
        description: 'O cliente foi cadastrado com sucesso.',
      });
    },
    onError: (error: any) => {
      const msg: string = error?.message ?? "";
      if (/Limite de \d+ clientes/i.test(msg)) {
        toast({
          title: "Limite de clientes atingido",
          description: msg + " Acesse Planos para fazer upgrade.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao adicionar cliente",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
      }
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ id, ...clientData }: any) => {
      const { data, error } = await supabase
        .from('clients')
        .update({
          name: clientData.name,
          phone: clientData.phone,
          email: clientData.email || null,
          gender: clientData.gender || null,
          birth_date: clientData.birth_date?.toISOString?.()?.split('T')[0] || null,
          last_service_date: clientData.last_service_date?.toISOString?.() || null,
          acquisition_source: clientData.acquisition_source || null,
          notes: clientData.notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsEditDialogOpen(false);
      setEditingClient(null);
      toast({
        title: 'Cliente atualizado!',
        description: 'As informações foram salvas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar cliente',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (inactiveDays: number) => {
      const { data, error } = await supabase
        .from('settings')
        .upsert({
          establishment_id: profile?.id,
          inactive_days_threshold: inactiveDays,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setIsSettingsDialogOpen(false);
      toast({
        title: 'Configurações salvas!',
        description: 'As configurações foram atualizadas.',
      });
    },
  });

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.phone) return;
    addClientMutation.mutate(newClient);
  };

  const handleEditClient = (client: any) => {
    setEditingClient({
      ...client,
      birth_date: client.birth_date ? new Date(client.birth_date) : null,
      last_service_date: client.last_service_date ? new Date(client.last_service_date) : null,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.name || !editingClient?.phone) return;
    updateClientMutation.mutate(editingClient);
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(inactiveDaysConfig);
  };

  const openWhatsApp = (phone: string, name: string) => {
    const message = `Olá ${name}! Temos novidades especiais para você no nosso salão. Entre em contato para saber mais!`;
    const whatsappUrl = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const getStatusBadge = (lastServiceDate: string | null) => {
    if (!lastServiceDate) {
      return <Badge variant="secondary" className="max-w-full whitespace-normal text-center">Novo Cliente</Badge>;
    }

    const daysSinceLastService = Math.floor(
      (new Date().getTime() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const inactiveDays = settings?.inactive_days_threshold || 20;

    if (daysSinceLastService > inactiveDays) {
      return <Badge variant="destructive" className="max-w-full whitespace-normal text-center">Inativo ({daysSinceLastService} dias)</Badge>;
    } else if (daysSinceLastService > inactiveDays / 2) {
      return <Badge variant="outline" className="max-w-full whitespace-normal text-center">Atenção ({daysSinceLastService} dias)</Badge>;
    } else {
      return <Badge variant="default" className="max-w-full whitespace-normal text-center">Ativo ({daysSinceLastService} dias)</Badge>;
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-4 sm:px-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold">
              {filterType === 'inactive' ? 'Clientes Inativos' : 'Clientes'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {filterType === 'inactive' 
                ? `Sem atendimento há mais de ${settings?.inactive_days_threshold || 20} dias`
                : 'Gerencie seus clientes'
              }
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap">
            <Button variant="outline" size="sm" className="min-w-0 px-2" onClick={() => setIsImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!allClients?.length} className="w-full min-w-0 px-2 md:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportClientsToXlsx(allClients ?? [])}>
                  Baixar XLSX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportClientsToCsv(allClients ?? [])}>
                  Baixar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="min-w-0 px-2" onClick={() => setIsSettingsDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
            <Button size="sm" className="min-w-0 px-2" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>

      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-4 sm:py-8">
        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Cake className="h-4 w-4" />
              Filtros de aniversário
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
              <Button
                type="button"
                variant={birthdayFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBirthdayFilter('all')}
              >
                Todos
              </Button>
              <Button
                type="button"
                variant={birthdayFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBirthdayFilter('today')}
              >
                Aniversariantes de hoje
              </Button>
              <Button
                type="button"
                variant={birthdayFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBirthdayFilter('week')}
              >
                Aniversariantes da semana
              </Button>
              <Button
                type="button"
                variant={birthdayFilter === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBirthdayFilter('month')}
              >
                Aniversariantes do mês
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p>Carregando clientes...</p>
            </CardContent>
          </Card>
        ) : !filteredClients || filteredClients.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Nenhum cliente encontrado com os termos de busca.'
                  : birthdayFilter !== 'all'
                    ? 'Nenhum cliente encontrado para o filtro de aniversário selecionado.'
                  : filterType === 'inactive' 
                    ? 'Nenhum cliente inativo encontrado.'
                    : 'Nenhum cliente cadastrado ainda.'
                }
              </p>
              {!searchTerm && filterType !== 'inactive' && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Cliente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-xl leading-tight sm:text-2xl">
                {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''} encontrado{filteredClients.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <div className="grid min-w-0 gap-3 md:hidden">
                {filteredClients.map((client) => (
                  <article key={client.id} className="min-w-0 rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="truncate font-semibold">{client.name}</h3>
                        <p className="break-words text-sm text-muted-foreground">{client.phone}</p>
                        <p className="truncate text-sm text-muted-foreground">{client.email || 'Sem email'}</p>
                      </div>
                      <div className="flex min-w-0">{getStatusBadge(client.last_service_date)}</div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Aniversário</dt>
                        <dd className="font-medium">{formatBirthday(client.birth_date)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Origem</dt>
                        <dd className="font-medium">{ACQUISITION_SOURCES.find(s => s.value === (client as any).acquisition_source)?.label || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Total gasto</dt>
                        <dd className="font-medium">R$ {Number(client.total_spent).toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Visitas</dt>
                        <dd className="font-medium">{client.visit_count}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Carteira</dt>
                        <dd className="font-medium text-primary">R$ {Number((client as any).credit_balance ?? 0).toFixed(2)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 grid min-w-0 grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-0 px-2"
                        onClick={() => handleEditClient(client)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-0 px-2"
                        onClick={() => setWalletClient(client)}
                      >
                        <Wallet className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openWhatsApp(client.phone, client.name)}
                        className="min-w-0 bg-success px-2 hover:bg-success/90"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>


              <div className="hidden md:block">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aniversário</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Total Gasto</TableHead>
                      <TableHead>Carteira</TableHead>
                      <TableHead>Visitas</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.phone}</TableCell>
                        <TableCell>{client.email || '-'}</TableCell>
                        <TableCell>{getStatusBadge(client.last_service_date)}</TableCell>
                        <TableCell>{formatBirthday(client.birth_date)}</TableCell>
                        <TableCell>{ACQUISITION_SOURCES.find(s => s.value === (client as any).acquisition_source)?.label || '-'}</TableCell>
                        <TableCell>R$ {Number(client.total_spent).toFixed(2)}</TableCell>
                        <TableCell className="font-medium text-primary">R$ {Number((client as any).credit_balance ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{client.visit_count}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClient(client)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setWalletClient(client)}
                              title="Carteira do cliente"
                            >
                              <Wallet className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openWhatsApp(client.phone, client.name)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Add Client Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Cliente</DialogTitle>
            <DialogDescription>
              Cadastre um novo cliente para seu estabelecimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp *</Label>
              <Input
                id="phone"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Sexo</Label>
              <Select value={newClient.gender} onValueChange={(value) => setNewClient({ ...newClient, gender: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newClient.birth_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newClient.birth_date ? format(newClient.birth_date, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newClient.birth_date || undefined}
                    onSelect={(date) => setNewClient({ ...newClient, birth_date: date || null })}
                    disabled={(date) => date > new Date()}
                    defaultMonth={newClient.birth_date || new Date(1990, 0)}
                    captionLayout="dropdown"
                    startMonth={new Date(1920, 0)}
                    endMonth={new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acquisition_source">Como chegou</Label>
              <Select value={newClient.acquisition_source} onValueChange={(value) => setNewClient({ ...newClient, acquisition_source: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {ACQUISITION_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={newClient.notes}
                onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                placeholder="Informações adicionais sobre o cliente..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={addClientMutation.isPending}>
              {addClientMutation.isPending ? 'Adicionando...' : 'Adicionar Cliente'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Atualize as informações do cliente.
            </DialogDescription>
          </DialogHeader>
          {editingClient && (
            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">WhatsApp *</Label>
                <Input
                  id="edit-phone"
                  value={editingClient.phone}
                  onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingClient.email || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gender">Sexo</Label>
                <Select value={editingClient.gender || ''} onValueChange={(value) => setEditingClient({ ...editingClient, gender: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editingClient.birth_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingClient.birth_date ? format(editingClient.birth_date, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editingClient.birth_date || undefined}
                      onSelect={(date) => setEditingClient({ ...editingClient, birth_date: date || null })}
                      disabled={(date) => date > new Date()}
                      defaultMonth={editingClient.birth_date || new Date(1990, 0)}
                      captionLayout="dropdown"
                      startMonth={new Date(1920, 0)}
                      endMonth={new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Último Atendimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editingClient.last_service_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingClient.last_service_date ? format(editingClient.last_service_date, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editingClient.last_service_date || undefined}
                      onSelect={(date) => setEditingClient({ ...editingClient, last_service_date: date || null })}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-acquisition">Como chegou</Label>
                <Select value={editingClient.acquisition_source || ''} onValueChange={(value) => setEditingClient({ ...editingClient, acquisition_source: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ACQUISITION_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Observações</Label>
                <Textarea
                  id="edit-notes"
                  value={editingClient.notes || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                  placeholder="Informações adicionais sobre o cliente..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateClientMutation.isPending}>
                {updateClientMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription>
              Configure as preferências do sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inactive-days">Considerar cliente inativo após quantos dias?</Label>
              <Input
                id="inactive-days"
                type="number"
                min="1"
                max="365"
                value={inactiveDaysConfig}
                onChange={(e) => setInactiveDaysConfig(Number(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Clientes que não fazem serviços há mais de {inactiveDaysConfig} dias serão considerados inativos.
              </p>
            </div>
            <Button onClick={handleSaveSettings} className="w-full" disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {profile && (
        <ImportClientsDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          establishmentId={profile.id}
          onImported={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
        />
      )}

      <ClientWalletDialog
        open={!!walletClient}
        onOpenChange={(v) => { if (!v) setWalletClient(null); }}
        client={walletClient}
      />
    </div>
  );
};

export default Clients;