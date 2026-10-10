import { lazy, Suspense } from 'react';
import { CalendarDays, Users, Receipt, Check, ArrowUpRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const AgendaDemo = lazy(() => import('./AgendaDemo'));
const modules = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays, title: 'Cada atendimento no seu lugar.', description: 'Veja os horários, os serviços e quem vai atender. Organize a rotina por profissional e compartilhe seu link de agendamento.', points: ['Cores por profissional', 'Bloqueios de horários e disponibilidade', 'Mais de um serviço no mesmo agendamento'] },
  { id: 'clientes', label: 'Clientes', icon: Users, title: 'Uma ficha. Todo o relacionamento.', description: 'Encontre os dados e o histórico do cliente sem depender de anotações espalhadas. Consulte atendimentos, vendas e crédito na mesma ficha.', points: ['Cadastro e histórico de atendimentos', 'Vendas e carteira de crédito', 'Importação de clientes'] },
  { id: 'vendas', label: 'Vendas', icon: Receipt, title: 'Do atendimento à comissão.', description: 'Feche a comanda, registre o pagamento e acompanhe a comissão de cada profissional. Consulte recebimentos e despesas para entender a operação.', points: ['Comanda e ponto de venda', 'Comissões por profissional', 'Relatórios financeiros e contas a pagar'] },
];

export default function ProductDemo() {
  return <section id="sistema" className="landing-section scroll-mt-24 bg-secondary">
    <div className="landing-container">
      <p className="landing-eyebrow">Conheça a Beauty Core</p>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><h2 className="landing-heading">Menos informações espalhadas.<br />Mais visão da sua rotina.</h2><p className="max-w-sm text-muted-foreground">Agenda, clientes e vendas conectados para você acompanhar o negócio.</p></div>
      <Tabs defaultValue="agenda">
        <TabsList aria-label="Módulos do sistema" className="mb-7 grid h-auto w-full max-w-md grid-cols-3 border bg-background p-1">{modules.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Icon className="h-4 w-4" />{label}</TabsTrigger>)}</TabsList>
        {modules.map(module => <TabsContent key={module.id} value={module.id}>
          <div className="grid items-start gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14">
            <div className="py-2 lg:py-8"><h3 className="mb-4 text-2xl font-semibold">{module.title}</h3><p className="leading-relaxed text-muted-foreground">{module.description}</p><ul className="my-6 space-y-3">{module.points.map(point => <li key={point} className="flex items-start gap-3 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{point}</li>)}</ul><Button variant="outline" asChild><a href="/auth?tab=signup">Experimentar no meu negócio<ArrowUpRight className="ml-2 h-4 w-4" /></a></Button></div>
            <figure className="min-w-0"><figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{module.label} · Beauty Core</span><span>Demonstração com dados ilustrativos</span></figcaption>
              {module.id === 'agenda' ? <Suspense fallback={<div role="status" className="flex h-96 items-center justify-center rounded-lg border bg-card">Carregando demonstração da agenda…</div>}><AgendaDemo /></Suspense>
                : module.id === 'clientes' ? <div className="rounded-lg border bg-card p-5 sm:p-7"><div className="flex items-center gap-3 border-b pb-5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><Users className="h-5 w-5 text-primary" /></span><div><p className="font-semibold">Cliente de exemplo</p><p className="text-xs text-muted-foreground">Ficha do cliente</p></div></div><div className="grid grid-cols-2 gap-4 py-5"><div><p className="text-xs text-muted-foreground">Último atendimento</p><p className="mt-1 font-medium">12/10/2026</p></div><div><p className="text-xs text-muted-foreground">Crédito disponível</p><p className="mt-1 font-medium">R$ 50,00</p></div></div><h4 className="border-t pt-5 text-sm font-semibold">Histórico de atendimentos</h4>{['12 out · Corte · Finalizado', '05 out · Escova · Finalizado', '21 set · Coloração · Finalizado'].map(row => <p key={row} className="border-b py-4 text-sm text-muted-foreground">{row}</p>)}<p className="mt-5 text-xs text-muted-foreground">Valores e atendimentos de exemplo, não de clientes reais.</p></div>
                : <div className="rounded-lg border bg-card p-5 sm:p-7"><div className="flex items-center justify-between border-b pb-5"><h4 className="font-semibold">Resumo da comanda</h4><Receipt className="h-5 w-5 text-primary" /></div><div className="space-y-4 py-5"><div className="flex justify-between gap-3 text-sm"><span>Corte · Profissional A</span><span>R$ 80,00</span></div><div className="flex justify-between gap-3 text-sm"><span>Escova · Profissional B</span><span>R$ 60,00</span></div></div><div className="flex justify-between border-y py-4 font-semibold"><span>Total</span><span>R$ 140,00</span></div><div className="space-y-3 py-5 text-sm"><p className="font-medium">Comissões do atendimento</p><p className="text-muted-foreground">Profissional A · 30% de R$ 80,00 = R$ 24,00</p><p className="text-muted-foreground">Profissional B · 30% de R$ 60,00 = R$ 18,00</p></div><p className="border-t pt-4 text-xs text-muted-foreground">Exemplo ilustrativo. Os percentuais são definidos no seu negócio.</p></div>}
            </figure>
          </div>
        </TabsContent>)}
      </Tabs>
    </div>
  </section>;
}