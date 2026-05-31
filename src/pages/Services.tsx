import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ImportServicesDialog } from '@/components/services/ImportServicesDialog';


const Services = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newService, setNewService] = useState({
    name: '',
    price: '',
    duration_minutes: '',
    description: '',
    commission_solo: '40',
    active: true,
  });

  const [editingService, setEditingService] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);



  const [newProfessional, setNewProfessional] = useState({
    name: '',
    active: true,
    commission_type: 'per_service' as 'per_service' | 'custom_percentage' | 'fixed_daily',
    custom_percentage: '40',
    daily_amount: '0',
  });
  const [linkServiceId, setLinkServiceId] = useState('');
  const [linkProfessionalId, setLinkProfessionalId] = useState('');

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

  const { data: professionals, isLoading: loadingPros } = useQuery({
    queryKey: ['professionals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as any[];
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('establishment_id', profile.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const { data: links, isLoading: loadingLinks } = useQuery({
    queryKey: ['service_professionals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as any[];
      const { data, error } = await supabase
        .from('service_professionals')
        .select('id, service_id, professional_id')
        .eq('establishment_id', profile.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const addServiceMutation = useMutation({
    mutationFn: async (payload: typeof newService) => {
      const pct = Number(payload.commission_solo) || 0;
      const insertData = {
        name: payload.name,
        price: Number(payload.price),
        duration_minutes: Number(payload.duration_minutes),
        description: payload.description || null,
        commission_solo: pct,
        commission_with_assistants: pct,
        commission_as_assistant: pct,
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
      setNewService({ name: '', price: '', duration_minutes: '', description: '', commission_solo: '40', active: true });
      toast({ title: 'Serviço cadastrado!', description: 'Novo serviço adicionado com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro ao cadastrar serviço', description: 'Tente novamente em instantes.', variant: 'destructive' });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const pct = Number(payload.commission_solo) || 0;
      const { data, error } = await supabase
        .from('services')
        .update({
          name: payload.name,
          price: Number(payload.price),
          duration_minutes: Number(payload.duration_minutes),
          description: payload.description || null,
          commission_solo: pct,
          commission_with_assistants: pct,
          commission_as_assistant: pct,
          active: payload.active,
        })
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditingService(null);
      toast({ title: 'Serviço atualizado!', description: 'As alterações foram salvas com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar serviço', description: 'Tente novamente em instantes.', variant: 'destructive' });
    },
  });

  const addProfessionalMutation = useMutation({
    mutationFn: async (payload: typeof newProfessional) => {
      const insertData = {
        name: payload.name,
        active: payload.active,
        commission_type: payload.commission_type,
        custom_percentage: Number(payload.custom_percentage) || 0,
        daily_amount: Number(payload.daily_amount) || 0,
        establishment_id: profile?.id,
      } as any;
      const { data, error } = await supabase
        .from('professionals')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      setNewProfessional({ name: '', active: true, commission_type: 'per_service', custom_percentage: '40', daily_amount: '0' });
      toast({ title: 'Profissional cadastrado!', description: 'Novo profissional adicionado.' });
    },
    onError: () => {
      toast({ title: 'Erro ao cadastrar profissional', description: 'Tente novamente.', variant: 'destructive' });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (payload: { service_id: string; professional_id: string }) => {
      const { data, error } = await supabase
        .from('service_professionals')
        .insert({ establishment_id: profile?.id, service_id: payload.service_id, professional_id: payload.professional_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_professionals'] });
      setLinkProfessionalId('');
      toast({ title: 'Vinculado!', description: 'Profissional vinculado ao serviço.' });
    },
    onError: () => {
      toast({ title: 'Erro ao vincular', description: 'Confira se já não está vinculado.', variant: 'destructive' });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (payload: { id: string }) => {
      const { error } = await supabase
        .from('service_professionals')
        .delete()
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_professionals'] });
      toast({ title: 'Vínculo removido' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Serviços</h1>
              <p className="text-muted-foreground">Cadastre e gerencie seus serviços e valores</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar XLSX/CSV
          </Button>
        </div>
      </header>

      {profile?.id && (
        <ImportServicesDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          establishmentId={profile.id}
          onImported={() => queryClient.invalidateQueries({ queryKey: ['services'] })}
        />
      )}


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
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-md p-4 bg-muted/30">
                <div className="md:col-span-3 -mb-2">
                  <Label className="text-sm font-semibold">Comissão</Label>
                  <p className="text-xs text-muted-foreground">% pago aos profissionais. Quando 2+ profissionais atendem juntos, o sistema divide igualmente.</p>
                </div>
                <div className="space-y-2 md:col-span-3 md:max-w-xs">
                  <Label htmlFor="c-solo">% de comissão</Label>
                  <Input id="c-solo" type="number" min="0" max="100" step="0.01" value={newService.commission_solo} onChange={(e) => setNewService({ ...newService, commission_solo: e.target.value })} />
                </div>
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
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>R$ {Number(s.price).toFixed(2)}</TableCell>
                      <TableCell>{s.duration_minutes} min</TableCell>
                      <TableCell>{Number(s.commission_solo ?? 0)}%</TableCell>
                      <TableCell>{s.active ? 'Ativo' : 'Inativo'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditingService(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Profissionais */}
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar Profissional</CardTitle>
            <CardDescription>Adicione profissionais do seu estabelecimento</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={(e) => { e.preventDefault(); if (!newProfessional.name) return; addProfessionalMutation.mutate(newProfessional); }}>
              <div className="space-y-2">
                <Label htmlFor="prof-name">Nome *</Label>
                <Input id="prof-name" value={newProfessional.name} onChange={(e) => setNewProfessional({ ...newProfessional, name: e.target.value })} required />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="prof-active" checked={newProfessional.active} onCheckedChange={(checked) => setNewProfessional({ ...newProfessional, active: checked })} />
                <Label htmlFor="prof-active">Ativo</Label>
              </div>
              <div className="md:col-span-2 border rounded-md p-4 bg-muted/30 space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Tipo de comissão</Label>
                  <p className="text-xs text-muted-foreground">Como esse profissional é remunerado.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {([
                    { value: 'per_service', label: 'Por serviço', desc: 'Usa o % de cada serviço' },
                    { value: 'custom_percentage', label: '% próprio', desc: 'Sobrescreve o do serviço' },
                    { value: 'fixed_daily', label: 'Diária fixa', desc: 'Valor fixo por dia' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewProfessional({ ...newProfessional, commission_type: opt.value })}
                      className={`text-left rounded-md border p-3 text-sm transition ${newProfessional.commission_type === opt.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                {newProfessional.commission_type === 'custom_percentage' && (
                  <div className="md:max-w-xs space-y-1">
                    <Label htmlFor="custom-pct">% personalizado</Label>
                    <Input id="custom-pct" type="number" min="0" max="100" step="0.01" value={newProfessional.custom_percentage} onChange={(e) => setNewProfessional({ ...newProfessional, custom_percentage: e.target.value })} />
                  </div>
                )}
                {newProfessional.commission_type === 'fixed_daily' && (
                  <div className="md:max-w-xs space-y-1">
                    <Label htmlFor="daily">Valor diário (R$)</Label>
                    <Input id="daily" type="number" min="0" step="0.01" value={newProfessional.daily_amount} onChange={(e) => setNewProfessional({ ...newProfessional, daily_amount: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Cadastrar Profissional</Button>
              </div>
            </form>

            <div className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(professionals || []).length ? (
                    (professionals as any[]).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.active ? 'Ativo' : 'Inativo'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">Nenhum profissional cadastrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Vincular Serviço x Profissional */}
        <Card>
          <CardHeader>
            <CardTitle>Vincular Serviço a Profissional</CardTitle>
            <CardDescription>Escolha um serviço e um profissional para vincular</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={linkServiceId} onValueChange={setLinkServiceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(services || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select value={linkProfessionalId} onValueChange={setLinkProfessionalId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(professionals || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button disabled={!linkServiceId || !linkProfessionalId} onClick={() => linkMutation.mutate({ service_id: linkServiceId, professional_id: linkProfessionalId })}>
                  Vincular
                </Button>
              </div>
            </div>

            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(links || []).length ? (
                    (links as any[]).map((l: any) => {
                      const s = (services || []).find((sv: any) => sv.id === l.service_id);
                      const p = (professionals || []).find((pr: any) => pr.id === l.professional_id);
                      return (
                        <TableRow key={l.id}>
                          <TableCell>{s?.name || l.service_id}</TableCell>
                          <TableCell>{p?.name || l.professional_id}</TableCell>
                          <TableCell>
                            <Button variant="outline" onClick={() => unlinkMutation.mutate({ id: l.id })}>Remover</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum vínculo criado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {/* Edit Service Dialog */}
        <Dialog open={!!editingService} onOpenChange={(open) => { if (!open) setEditingService(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Serviço</DialogTitle>
              <DialogDescription>Altere os dados do serviço e salve as mudanças.</DialogDescription>
            </DialogHeader>
            {editingService && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateServiceMutation.mutate(editingService);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome *</Label>
                  <Input
                    id="edit-name"
                    value={editingService.name}
                    onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Preço (R$) *</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingService.price}
                      onChange={(e) => setEditingService({ ...editingService, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-duration">Duração (min) *</Label>
                    <Input
                      id="edit-duration"
                      type="number"
                      min="0"
                      value={editingService.duration_minutes}
                      onChange={(e) => setEditingService({ ...editingService, duration_minutes: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                    id="edit-description"
                    value={editingService.description || ''}
                    onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-commission">% de comissão</Label>
                  <Input
                    id="edit-commission"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={editingService.commission_solo}
                    onChange={(e) => setEditingService({ ...editingService, commission_solo: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="edit-active"
                    checked={editingService.active}
                    onCheckedChange={(checked) => setEditingService({ ...editingService, active: checked })}
                  />
                  <Label htmlFor="edit-active">Ativo</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditingService(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateServiceMutation.isPending}>
                    {updateServiceMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Services;
