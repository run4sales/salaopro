import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, MessageCircle, Calendar, Target, BarChart3, Star, Check } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import retentionIcon from "@/assets/retention-icon.jpg";
import growthIcon from "@/assets/growth-icon.jpg";
import whatsappIcon from "@/assets/whatsapp-icon.jpg";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded bg-gradient-primary"></div>
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Salão PRO
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#funcionalidades" className="text-sm font-medium hover:text-primary transition-colors">
              Funcionalidades
            </a>
            <a href="#beneficios" className="text-sm font-medium hover:text-primary transition-colors">
              Benefícios
            </a>
            <a href="#planos" className="text-sm font-medium hover:text-primary transition-colors">
              Planos
            </a>
            <Button variant="outline" size="sm" asChild>
              <a href="/auth">Entrar</a>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <a href="/auth">Teste Grátis</a>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="relative container mx-auto px-4 py-24 text-center">
          <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20">
            CRM Especializado para Beleza
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent">
            Transforme Clientes Inativos em 
            <br />
            Receita Recorrente
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            O Salão PRO é o CRM que ajuda salões, barbearias e profissionais de beleza a 
            reativar clientes, aumentar a frequência de visitas e bater suas metas mensais.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" className="text-lg px-8 py-3" asChild>
              <a href="/auth">Começar Teste Grátis</a>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3">
              Ver Demonstração
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            ✅ 14 dias grátis • ✅ Sem cartão de crédito • ✅ Cancelamento a qualquer momento
          </p>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="beneficios" className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que escolher o Salão PRO?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Desenvolvido especificamente para o mercado de beleza, com funcionalidades 
              que realmente fazem a diferença no seu faturamento.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <div className="mx-auto mb-4">
                  <img src={retentionIcon} alt="Retenção de Clientes" className="w-16 h-16 mx-auto" />
                </div>
                <CardTitle className="text-xl">Recupere Clientes Perdidos</CardTitle>
                <CardDescription>
                  Identifique automaticamente clientes que não voltam há dias e reative-os 
                  com um clique via WhatsApp.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <div className="mx-auto mb-4">
                  <img src={growthIcon} alt="Crescimento de Vendas" className="w-16 h-16 mx-auto" />
                </div>
                <CardTitle className="text-xl">Aumente seu Faturamento</CardTitle>
                <CardDescription>
                  Defina metas mensais e acompanhe seu progresso em tempo real. 
                  Saiba exatamente quantos atendimentos faltam para bater sua meta.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <div className="mx-auto mb-4">
                  <img src={whatsappIcon} alt="Integração WhatsApp" className="w-16 h-16 mx-auto" />
                </div>
                <CardTitle className="text-xl">WhatsApp Integrado</CardTitle>
                <CardDescription>
                  Envie promoções e cupons diretamente pelo WhatsApp com apenas um clique. 
                  Mantenha contato constante com seus clientes.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Funcionalidades pensadas especificamente para profissionais de beleza 
              que querem crescer e organizar seu negócio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Gestão de Clientes</CardTitle>
                <CardDescription>
                  Cadastre clientes com histórico completo de serviços, 
                  telefone e data do último atendimento.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <Calendar className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Agenda Inteligente</CardTitle>
                <CardDescription>
                  Visualize seus agendamentos por dia, semana ou mês. 
                  Nunca mais perca um compromisso.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <Target className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Metas e Objetivos</CardTitle>
                <CardDescription>
                  Defina suas metas mensais e acompanhe o progresso. 
                  Saiba quantos atendimentos faltam para o sucesso.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Relatórios Detalhados</CardTitle>
                <CardDescription>
                  Compare faturamento entre meses, identifique tendências 
                  e tome decisões baseadas em dados.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <MessageCircle className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Clientes Inativos</CardTitle>
                <CardDescription>
                  Filtro automático de clientes que não voltam há dias. 
                  Reative-os com promoções via WhatsApp.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Dashboard Completo</CardTitle>
                <CardDescription>
                  Visão geral do seu negócio: faturamento, metas, 
                  próximos agendamentos e muito mais.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
                <CardDescription className="text-base">
                  "Aumentei meu faturamento em 40% depois que comecei a usar o Salão PRO. 
                  A funcionalidade de clientes inativos é incrível!"
                </CardDescription>
                <div className="mt-4">
                  <p className="font-semibold">Maria Silva</p>
                  <p className="text-sm text-muted-foreground">Salão Beleza Pura</p>
                </div>
              </CardHeader>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
                <CardDescription className="text-base">
                  "Finalmente consigo acompanhar minhas metas e saber exatamente 
                  quantos cortes preciso fazer para atingir meu objetivo mensal."
                </CardDescription>
                <div className="mt-4">
                  <p className="font-semibold">João Santos</p>
                  <p className="text-sm text-muted-foreground">Barbearia Style</p>
                </div>
              </CardHeader>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
                <CardDescription className="text-base">
                  "A integração com WhatsApp revolucionou meu relacionamento com os clientes. 
                  Super fácil de usar e muito eficiente!"
                </CardDescription>
                <div className="mt-4">
                  <p className="font-semibold">Ana Costa</p>
                  <p className="text-sm text-muted-foreground">Estética Renovar</p>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Planos que cabem no seu bolso
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para o seu negócio. 
              Todos incluem 14 dias de teste grátis.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Básico</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">R$ 29</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <CardDescription>
                  Perfeito para profissionais autônomos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Até 200 clientes
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Agenda básica
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    WhatsApp integrado
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Relatórios básicos
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline">
                  Começar Teste Grátis
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-elegant border-primary relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-secondary text-foreground font-semibold">
                  Mais Popular
                </Badge>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Profissional</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">R$ 59</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <CardDescription>
                  Ideal para salões pequenos e médios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Até 1000 clientes
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Agenda avançada
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    WhatsApp integrado
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Relatórios avançados
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Metas e indicadores
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Suporte prioritário
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="hero">
                  Começar Teste Grátis
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Premium</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">R$ 99</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <CardDescription>
                  Para salões grandes e redes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Clientes ilimitados
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Múltiplos usuários
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    WhatsApp integrado
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Relatórios personalizados
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    API integração
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Suporte dedicado
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline">
                  Começar Teste Grátis
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-hero text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para transformar seu negócio?
          </h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
            Junte-se a centenas de profissionais que já aumentaram seu faturamento 
            com o Salão PRO. Comece seu teste grátis hoje mesmo!
          </p>
          <Button variant="cta" size="lg" className="text-lg px-8 py-3">
            Começar Teste Grátis Agora
          </Button>
          <p className="text-sm mt-4 opacity-75">
            ✅ Sem cartão de crédito • ✅ 14 dias grátis • ✅ Cancelamento fácil
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded bg-gradient-primary"></div>
                <span className="text-xl font-bold">Salão PRO</span>
              </div>
              <p className="text-sm opacity-75">
                O CRM especializado para profissionais de beleza que querem crescer.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm opacity-75">
                <li><a href="#" className="hover:opacity-100">Funcionalidades</a></li>
                <li><a href="#" className="hover:opacity-100">Preços</a></li>
                <li><a href="#" className="hover:opacity-100">Demonstração</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm opacity-75">
                <li><a href="#" className="hover:opacity-100">Central de Ajuda</a></li>
                <li><a href="#" className="hover:opacity-100">Contato</a></li>
                <li><a href="#" className="hover:opacity-100">WhatsApp</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm opacity-75">
                <li><a href="#" className="hover:opacity-100">Sobre</a></li>
                <li><a href="#" className="hover:opacity-100">Blog</a></li>
                <li><a href="#" className="hover:opacity-100">Privacidade</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-background/20 mt-8 pt-8 text-center text-sm opacity-75">
            <p>&copy; 2024 Salão PRO. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;