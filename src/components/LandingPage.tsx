import { useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Menu, X, Scissors, Users, Receipt, BarChart3, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import LandingPlans from '@/components/landing/LandingPlans';
import ProductDemo from '@/components/landing/ProductDemo';
import salonImage from '@/assets/salon-management.jpg';

const supportUrl = 'https://wa.me/5511917506368';
const navLinks = [{ label: 'O sistema', href: '#sistema' }, { label: 'Funcionalidades', href: '#funcionalidades' }, { label: 'Planos', href: '#planos' }, { label: 'Dúvidas', href: '#duvidas' }];
const faqs = [
  { question: 'Como funciona o teste gratuito?', answer: 'Novas contas têm 10 dias corridos de teste a partir do cadastro, sem informar cartão de crédito. Depois desse período, é necessário contratar um plano para continuar usando o sistema.' },
  { question: 'A Beauty Core serve para o meu negócio?', answer: 'A plataforma atende salões de beleza, barbearias e profissionais de beleza que precisam organizar agendamentos, clientes, vendas e equipe.' },
  { question: 'Preciso instalar algum programa?', answer: 'Não. Você acessa a Beauty Core pelo navegador, no computador, tablet ou celular, com conexão à internet.' },
  { question: 'Como os colaboradores acessam a plataforma?', answer: 'Cada colaborador pode ter seu próprio acesso, respeitando o limite de usuários do plano. As permissões diferenciam gestores e funcionários, mantendo a agenda do profissional vinculada ao seu perfil.' },
  { question: 'Como faço para contratar?', answer: 'Crie sua conta e escolha um plano. Na área de planos e assinatura, você pode abrir a contratação e consultar a cobrança. Os pagamentos da plataforma são processados pelo Asaas.' },
  { question: 'Quais recursos posso conhecer?', answer: 'Agenda por profissional, ficha e histórico de clientes, serviços, comanda e vendas, comissões, contas a pagar e relatórios. Consulte os limites e os recursos informados no plano antes de contratar.' },
];

function Brand() {
  return <span className="inline-flex items-center gap-2.5 text-xl font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkles aria-hidden="true" className="h-4 w-4" /></span><span>Beauty<span className="text-primary">Core</span><span className="ml-0.5 text-accent">.</span></span></span>;
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="beauty-landing antialiased">
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-background focus:p-4">Ir para o conteúdo</a>
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="landing-container flex h-20 items-center justify-between gap-4">
        <a href="/" aria-label="Beauty Core, início"><Brand /></a>
        <nav aria-label="Navegação principal" className="hidden items-center gap-7 lg:flex">{navLinks.map(link => <a key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">{link.label}</a>)}</nav>
        <div className="flex items-center gap-2 sm:gap-4"><Button variant="ghost" asChild className="hidden sm:inline-flex"><a href="/auth?tab=login">Entrar</a></Button><Button asChild className="hidden sm:inline-flex"><a href="/auth?tab=signup">Teste grátis<ArrowRight className="ml-2 h-4 w-4" /></a></Button><Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="landing-mobile-menu" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X /> : <Menu />}</Button></div>
      </div>
      {menuOpen && <nav id="landing-mobile-menu" aria-label="Navegação celular" className="landing-container flex flex-col gap-4 border-t py-5 lg:hidden">{navLinks.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="py-1 text-sm">{link.label}</a>)}<div className="flex flex-wrap gap-3"><Button variant="outline" asChild><a href="/auth?tab=login">Entrar</a></Button><Button asChild><a href="/auth?tab=signup">Começar 10 dias grátis</a></Button></div></nav>}
    </header>
    <main id="conteudo">
      <section className="landing-hero relative isolate flex items-center overflow-hidden">
        <img src={salonImage} width={1920} height={1024} fetchPriority="high" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-right" />
        <div className="landing-hero-overlay absolute inset-0 -z-10" />
        <div className="landing-container w-full py-14 md:py-20">
          <div className="max-w-xl"><p className="mb-5 flex items-center gap-2 text-xs font-medium uppercase text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Sua rotina, mais organizada</p>
            <h1 className="text-4xl font-semibold leading-[1.12] sm:text-5xl">Beauty Core.<br />Gestão para salões<br />e barbearias.</h1>
            <p className="landing-hero-copy mb-8 mt-6 max-w-md text-base leading-relaxed sm:text-lg">Organize os agendamentos, acompanhe seus clientes e conecte vendas e comissões em um só lugar.</p>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"><Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild><a href="/auth?tab=signup">Começar 10 dias grátis<ArrowRight className="ml-2 h-4 w-4" /></a></Button><Button size="lg" variant="outline" className="landing-hero-secondary" asChild><a href="#sistema">Conhecer o sistema</a></Button></div>
            <div className="landing-hero-copy mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />Sem cartão de crédito</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />No computador e celular</span></div>
          </div>
        </div>
      </section>
      <div className="border-b"><div className="landing-container grid grid-cols-2 gap-5 py-7 text-sm sm:grid-cols-4">{[{ icon: CalendarDays, label: 'Agenda organizada' }, { icon: Users, label: 'Histórico de clientes' }, { icon: Receipt, label: 'Vendas e comissões' }, { icon: BarChart3, label: 'Visão do financeiro' }].map(({ icon: Icon, label }) => <span key={label} className="flex items-center gap-3"><Icon className="h-5 w-5 shrink-0 text-primary" />{label}</span>)}</div></div>
      <ProductDemo />
      <section id="funcionalidades" className="landing-section scroll-mt-24">
        <div className="landing-container"><p className="landing-eyebrow">Da agenda ao fechamento</p><div className="mb-10 grid gap-4 md:grid-cols-2"><h2 className="landing-heading">O negócio inteiro.<br />Uma gestão conectada.</h2><p className="max-w-md text-muted-foreground md:ml-auto">Menos troca entre planilhas e anotações. Cada etapa ajuda a manter as informações do atendimento no mesmo lugar.</p></div>
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{[
            { icon: CalendarDays, title: 'Organize o dia', desc: 'Agende serviços, escolha os profissionais e bloqueie os horários indisponíveis.' },
            { icon: Users, title: 'Conheça o cliente', desc: 'Consulte a ficha, os atendimentos anteriores e o crédito disponível.' },
            { icon: Receipt, title: 'Feche o atendimento', desc: 'Abra a comanda e registre a venda e a forma de pagamento.' },
            { icon: BarChart3, title: 'Acompanhe os resultados', desc: 'Confira comissões, recebimentos, despesas e relatórios da operação.' },
          ].map(({ icon: Icon, title, desc }, i) => <li key={title} className="border-t pt-5"><div className="mb-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">0{i + 1}</span><Icon className="h-5 w-5 text-primary" /></div><h3 className="mb-3 text-lg font-semibold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{desc}</p></li>)}</ol>
          <div className="mt-12 flex flex-col justify-between gap-6 border-y py-7 sm:flex-row sm:items-center"><div className="flex items-start gap-4"><ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">Cada pessoa com seu próprio acesso.</h3><p className="mt-1 text-sm text-muted-foreground">Gestores acompanham a operação. Funcionários acessam a agenda vinculada ao seu perfil.</p></div></div><Button variant="ghost" asChild><a href="#planos">Ver limites dos planos<ChevronRight className="ml-2 h-4 w-4" /></a></Button></div>
        </div>
      </section>
      <section className="border-y bg-secondary py-12"><div className="landing-container grid gap-7 md:grid-cols-[1.1fr_2fr]"><div><p className="landing-eyebrow">Para quem cuida da beleza</p><h2 className="text-2xl font-semibold">Seu jeito de trabalhar.<br />Mais organização.</h2></div><div className="grid gap-6 sm:grid-cols-3">{[{ icon: Scissors, title: 'Salões de beleza', desc: 'Serviços, equipe e atendimentos na mesma rotina.' }, { icon: Users, title: 'Barbearias', desc: 'Agenda por profissional e acompanhamento das comissões.' }, { icon: Sparkles, title: 'Autônomos', desc: 'Clientes e vendas organizados, mesmo trabalhando sozinho.' }].map(({ icon: Icon, title, desc }) => <div key={title}><Icon className="mb-3 h-5 w-5 text-primary" /><h3 className="mb-2 text-base font-semibold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{desc}</p></div>)}</div></div></section>
      <LandingPlans />
      <section id="duvidas" className="landing-section scroll-mt-24 border-t bg-secondary"><div className="landing-container grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="landing-eyebrow">Antes de começar</p><h2 className="landing-heading">Dúvidas? Vamos<br />simplificar.</h2><p className="mb-6 mt-5 max-w-sm text-muted-foreground">Se precisar conversar com a gente, nosso canal de suporte está disponível no WhatsApp.</p><Button variant="outline" asChild><a href={supportUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Falar com o suporte</a></Button></div><Accordion type="single" collapsible>{faqs.map((faq, i) => <AccordionItem key={faq.question} value={`faq-${i}`}><AccordionTrigger className="gap-4 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{faq.question}</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">{faq.answer}</AccordionContent></AccordionItem>)}</Accordion></div></section>
      <section className="bg-primary py-14 text-primary-foreground"><div className="landing-container flex flex-col justify-between gap-7 md:flex-row md:items-center"><div><p className="mb-3 text-sm text-primary-foreground/80">Seu negócio. Sua equipe. Sua Beauty Core.</p><h2 className="text-3xl font-semibold leading-tight">Dê mais clareza à sua rotina.</h2><p className="mt-3 text-primary-foreground/80">Comece com 10 dias grátis e conheça a plataforma na prática.</p></div><Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild><a href="/auth?tab=signup">Começar meu teste grátis<ArrowRight className="ml-2 h-4 w-4" /></a></Button></div></section>
    </main>
    <footer className="border-t py-10"><div className="landing-container"><div className="flex flex-col justify-between gap-7 md:flex-row md:items-start"><div><a href="/" aria-label="Beauty Core, início"><Brand /></a><p className="mt-3 max-w-xs text-sm text-muted-foreground">Gestão para quem faz a beleza acontecer.</p></div><nav aria-label="Links do rodapé" className="flex flex-wrap gap-x-7 gap-y-4 text-sm text-muted-foreground">{navLinks.map(link => <a key={link.href} href={link.href} className="hover:text-primary">{link.label}</a>)}<a href={supportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Suporte</a><a href="/auth?tab=login" className="hover:text-primary">Entrar</a></nav></div><div className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-5 text-xs text-muted-foreground"><p>© {new Date().getFullYear()} Beauty Core. Todos os direitos reservados.</p><p>Imagem de ambiente ilustrativa.</p></div></div></footer>
  </div>;
}
