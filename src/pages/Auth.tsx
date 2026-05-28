import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const planParam = searchParams.get('plan');
  const initialPlan = (planParam === 'empresa' || planParam === 'individual' || planParam === 'profissional'
    ? planParam : 'profissional') as 'individual' | 'profissional' | 'empresa';
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);
  const [selectedPlan, setSelectedPlan] = useState<'individual' | 'profissional' | 'empresa'>(initialPlan);


  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    businessName: '',
    document: '',
    ownerName: '',
    phone: '',
    cep: '',
    street: '',
    neighborhood: '',
    city: '',
    businessType: '',
  });

  // Redirect if user is already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await signIn(loginData.email, loginData.password);
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try { localStorage.setItem('signup_plan_slug', selectedPlan); } catch {}
    await signUp(signupData.email, signupData.password, {
      business_name: signupData.businessName,
      document: signupData.document,
      owner_name: signupData.ownerName,
      phone: signupData.phone,
      cep: signupData.cep,
      street: signupData.street,
      neighborhood: signupData.neighborhood,
      city: signupData.city,
      business_type: signupData.businessType,
      selected_plan: selectedPlan,
    });
    setIsLoading(false);
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-3xl" />
      </div>
      <Card className="w-full max-w-md border-border/60 bg-card/80 backdrop-blur-xl shadow-elegant">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent shadow-[0_0_24px_hsl(var(--primary)/0.5)]" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            Beauty<span className="bg-gradient-to-r from-primary-glow to-accent bg-clip-text text-transparent">Core</span>
          </CardTitle>
          <CardDescription>
            Acesse ou crie sua conta para gerenciar seu salão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { slug: 'individual', name: 'Individual', price: 'R$ 29,90', sub: '300 clientes • 1 usuário' },
                      { slug: 'profissional', name: 'Profissional', price: 'R$ 69,90', sub: 'Ilimitado • 4 usuários', star: true },
                      { slug: 'empresa', name: 'Empresa', price: 'R$ 109,90', sub: 'Ilimitado • 20 usuários' },
                    ].map((p) => {
                      const active = selectedPlan === p.slug;
                      return (
                        <button
                          type="button"
                          key={p.slug}
                          onClick={() => setSelectedPlan(p.slug as any)}
                          className={`relative text-left rounded-lg border p-3 transition ${
                            active
                              ? 'border-primary bg-primary/10 shadow-[0_0_18px_hsl(var(--primary)/0.25)]'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {p.star && <span className="absolute -top-2 right-2 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">⭐</span>}
                          <div className="text-sm font-semibold">{p.name}</div>
                          <div className="text-sm font-bold text-primary">{p.price}<span className="text-[10px] text-muted-foreground font-normal">/mês</span></div>
                          <div className="text-[10px] text-muted-foreground mt-1">{p.sub}</div>
                        </button>
                      );
                    })}
                  </div>


                  <p className="text-xs text-muted-foreground">10 dias grátis • sem cartão de crédito</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business-name">Nome do Estabelecimento</Label>
                  <Input
                    id="business-name"
                    value={signupData.businessName}
                    onChange={(e) => setSignupData({ ...signupData, businessName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">CPF ou CNPJ</Label>
                  <Input
                    id="document"
                    value={signupData.document}
                    onChange={(e) => setSignupData({ ...signupData, document: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Nome do Proprietário</Label>
                  <Input
                    id="owner-name"
                    value={signupData.ownerName}
                    onChange={(e) => setSignupData({ ...signupData, ownerName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={signupData.phone}
                    onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={signupData.cep}
                    onChange={(e) => setSignupData({ ...signupData, cep: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street">Rua</Label>
                  <Input
                    id="street"
                    value={signupData.street}
                    onChange={(e) => setSignupData({ ...signupData, street: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={signupData.neighborhood}
                    onChange={(e) => setSignupData({ ...signupData, neighborhood: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={signupData.city}
                    onChange={(e) => setSignupData({ ...signupData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-type">Tipo de comércio</Label>
                  <select
                    id="business-type"
                    value={signupData.businessType}
                    onChange={(e) => setSignupData({ ...signupData, businessType: e.target.value })}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="Salao de beleza">Salão de beleza</option>
                    <option value="Barbeiro">Barbeiro</option>
                    <option value="Clinica Estetica">Clinica Estética</option>
                    <option value="Trancista">Trancista</option>
                    <option value="Manicure">Manicure</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
