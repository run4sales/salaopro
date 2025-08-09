import { useAuth } from '@/hooks/useAuth';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
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
import { MessageCircle, Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Clients = () => {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get('filter');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    notes: '',
  });

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', profile?.id, filterType],
    queryFn: async () => {
      if (!profile?.id) return [];

      let query = supabase
        .from('clients')
        .select('*')
        .eq('establishment_id', profile.id)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;

      if (filterType === 'inactive') {
        const twentyDaysAgo = new Date();
        twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
        
        return data.filter(client => 
          !client.last_service_date || new Date(client.last_service_date) < twentyDaysAgo
        );
      }

      return data;
    },
    enabled: !!profile?.id,
  });

  // Add client mutation
  const addClientMutation = useMutation({
    mutationFn: async (clientData: typeof newClient) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...clientData,
          establishment_id: profile?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setNewClient({ name: '', phone: '', notes: '' });
      toast({
        title: 'Cliente adicionado!',
        description: 'O cliente foi cadastrado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar cliente',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    },
  });

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.phone) return;
    addClientMutation.mutate(newClient);
  };

  const openWhatsApp = (phone: string, name: string) => {
    const message = `Olá ${name}! Temos novidades especiais para você no nosso salão. Entre em contato para saber mais!`;
    const whatsappUrl = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const getStatusBadge = (lastServiceDate: string | null) => {
    if (!lastServiceDate) {
      return <Badge variant="secondary">Novo Cliente</Badge>;
    }

    const daysSinceLastService = Math.floor(
      (new Date().getTime() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastService > 20) {
      return <Badge variant="destructive">Inativo ({daysSinceLastService} dias)</Badge>;
    } else if (daysSinceLastService > 10) {
      return <Badge variant="outline">Atenção ({daysSinceLastService} dias)</Badge>;
    } else {
      return <Badge variant="default">Ativo ({daysSinceLastService} dias)</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <a href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </a>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {filterType === 'inactive' ? 'Clientes Inativos' : 'Clientes'}
              </h1>
              <p className="text-muted-foreground">
                {filterType === 'inactive' 
                  ? 'Clientes que não visitam há mais de 20 dias'
                  : 'Gerencie seus clientes'
                }
              </p>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Cadastre um novo cliente para seu estabelecimento.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                  <Input
                    id="phone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    required
                  />
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
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p>Carregando clientes...</p>
            </CardContent>
          </Card>
        ) : !clients || clients.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {filterType === 'inactive' 
                  ? 'Nenhum cliente inativo encontrado.'
                  : 'Nenhum cliente cadastrado ainda.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {clients.length} cliente{clients.length !== 1 ? 's' : ''} encontrado{clients.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Gasto</TableHead>
                    <TableHead>Visitas</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>{getStatusBadge(client.last_service_date)}</TableCell>
                      <TableCell>R$ {Number(client.total_spent).toFixed(2)}</TableCell>
                      <TableCell>{client.visit_count}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => openWhatsApp(client.phone, client.name)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Clients;