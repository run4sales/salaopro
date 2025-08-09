import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft } from 'lucide-react';

const Services = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newService, setNewService] = useState({
    name: '',
    price: '',
    duration_minutes: '',
    description: '',
    active: true,
  });

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // SEO basics
  if (typeof document !== 'undefined') {
    document.title = 'Serviços | Cadastro de serviços e valores';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'Cadastre serviços e valores do seu salão');
  }

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as any[];
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('establishment_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const addServiceMutation = useMutation({
    mutationFn: async (payload: typeof newService) => {
      const insertData = {
        name: payload.name,
        price: Number(payload.price),
        duration_minutes: Number(payload.duration_minutes),
        description: payload.description || null,
        active: payload.active,
        establishment_id: profile?.id,
      };
      const { data, error } = await supabase
        .from('services')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setNewService({ name: '', price: '', duration_minutes: '', description: '', active: true });
      toast({ title: 'Serviço cadastrado!', description: 'Novo serviço adicionado com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro ao cadastrar serviço', description: 'Tente novamente em instantes.', variant: 'destructive' });
    },
  });

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name || !newService.price || !newService.duration_minutes) return;
    addServiceMutation.mutate(newService);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Serviços</h1>
              <p className="text-muted-foreground">Cadastre e gerencie seus serviços e valores</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Create Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Cadastrar Serviço
            </CardTitle>
            <CardDescription>Preencha os campos abaixo para adicionar um novo serviço</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input id="price" type="number" step="0.01" min="0" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (min) *</Label>
                <Input id="duration" type="number" min="0" value={newService.duration_minutes} onChange={(e) => setNewService({ ...newService, duration_minutes: e.target.value })} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="active" checked={newService.active} onCheckedChange={(checked) => setNewService({ ...newService, active: checked })} />
                <Label htmlFor="active">Ativo</Label>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Cadastrar</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Services List */}
        <Card>
          <CardHeader>
            <CardTitle>Serviços Cadastrados</CardTitle>
            <CardDescription>Lista de serviços do seu estabelecimento</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Carregando serviços...</p>
            ) : !services || services.length === 0 ? (
              <div className="text-center text-muted-foreground">Nenhum serviço cadastrado ainda.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>R$ {Number(s.price).toFixed(2)}</TableCell>
                      <TableCell>{s.duration_minutes} min</TableCell>
                      <TableCell>{s.active ? 'Ativo' : 'Inativo'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Services;
