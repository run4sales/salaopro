import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Upload, Package, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ImportServicesDialog } from '@/components/services/ImportServicesDialog';

const Products = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    cost_price: '',
    price: '',
    stock_quantity: '0',
    active: true,
  });
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);

  if (!user) return <Navigate to="/auth" replace />;

  if (typeof document !== 'undefined') {
    document.title = 'Produtos | Cadastro e estoque';
  }

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as any[];
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('establishment_id', profile.id)
        .eq('kind', 'product')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const addMutation = useMutation({
    mutationFn: async (p: typeof newProduct) => {
      const insertData = {
        name: p.name,
        description: p.description || null,
        cost_price: Number(p.cost_price) || 0,
        price: Number(p.price) || 0,
        stock_quantity: Number(p.stock_quantity) || 0,
        active: p.active,
        kind: 'product',
        duration_minutes: 0,
        commission_solo: 0,
        commission_with_assistants: 0,
        commission_as_assistant: 0,
        establishment_id: profile?.id!,
      };
      const { error } = await supabase.from('services').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setNewProduct({ name: '', description: '', cost_price: '', price: '', stock_quantity: '0', active: true });
      toast({ title: 'Produto cadastrado!' });
    },
    onError: (e: any) => toast({ title: 'Erro ao cadastrar', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase
        .from('services')
        .update({
          name: p.name,
          description: p.description || null,
          cost_price: Number(p.cost_price) || 0,
          price: Number(p.price) || 0,
          stock_quantity: Number(p.stock_quantity) || 0,
          active: p.active,
        })
        .eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditing(null);
      toast({ title: 'Produto atualizado!' });
    },
    onError: (e: any) => toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').update({ active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setDeleting(null);
      toast({ title: 'Produto excluído', description: 'O produto não aparecerá mais no PDV nem em novas vendas.' });
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;
    addMutation.mutate(newProduct);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="text-muted-foreground">Cadastre produtos, preços e controle de estoque</p>
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
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['services'] });
          }}
        />
      )}

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Cadastrar Produto
            </CardTitle>
            <CardDescription>Preencha os dados do produto</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="cost">Preço de custo (R$)</Label>
                <Input id="cost" type="number" step="0.01" value={newProduct.cost_price} onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="price">Preço de venda (R$) *</Label>
                <Input id="price" type="number" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="stock">Quantidade em estoque</Label>
                <Input id="stock" type="number" min="0" value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={newProduct.active} onCheckedChange={(v) => setNewProduct({ ...newProduct, active: v })} />
                <Label>Ativo</Label>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={addMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar Produto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Produtos cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (products ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhum produto cadastrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>R$ {Number(p.cost_price ?? 0).toFixed(2)}</TableCell>
                      <TableCell>R$ {Number(p.price).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={Number(p.stock_quantity) <= 0 ? 'destructive' : 'secondary'}>
                          {p.stock_quantity ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.active ? 'default' : 'outline'}>{p.active ? 'Ativo' : 'Inativo'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(p)} aria-label="Excluir produto">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
            <DialogDescription>Atualize as informações do produto</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Preço de custo</Label>
                <Input type="number" step="0.01" value={editing.cost_price ?? 0} onChange={(e) => setEditing({ ...editing, cost_price: e.target.value })} />
              </div>
              <div>
                <Label>Preço de venda</Label>
                <Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
              </div>
              <div>
                <Label>Estoque</Label>
                <Input type="number" min="0" value={editing.stock_quantity ?? 0} onChange={(e) => setEditing({ ...editing, stock_quantity: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Ativo</Label>
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate(editing)} disabled={updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
