import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Wallet,
  BarChart3,
  Percent,
  MessageCircle,
  Check,
  X,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Star,
  ShieldCheck,
  Zap,
} from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#08020f] text-white antialiased overflow-x-hidden">
      {/* Ambient glow background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[hsl(267_84%_48%/0.25)] blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-[hsl(45_93%_55%/0.15)] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[hsl(267_84%_48%/0.2)] blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#08020f]/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(267_84%_55%)] to-[hsl(45_93%_60%)] shadow-[0_0_20px_hsl(267_84%_55%/0.5)]" />
            <span className="text-xl font-bold tracking-tight">
              Beauty<span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">Core</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#funcionalidades" className="text-sm text-white/70 hover:text-white transition-colors">Funcionalidades</a>
            <a href="#financeiro" className="text-sm text-white/70 hover:text-white transition-colors">Financeiro</a>
            <a href="#planos" className="text-sm text-white/70 hover:text-white transition-colors">Planos</a>
            <a
              href="/auth?tab=login"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Entrar
            </a>
            <Button
              size="sm"
              className="bg-gradient-to-r from-[hsl(267_84%_55%)] to-[hsl(267_84%_45%)] hover:opacity-90 text-white border-0 shadow-[0_0_24px_hsl(267_84%_55%/0.4)]"
              asChild
            >
              <a href="/auth?tab=signup">Teste Grátis</a>
            </Button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="container mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-6 bg-white/5 border border-white/10 text-[hsl(45_93%_70%)] hover:bg-white/10">
                <Sparkles className="h-3 w-3 mr-1.5" />
                Sistema de gestão para salões premium
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
                Transforme seu salão em uma{" "}
                <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] via-[hsl(290_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
                  empresa lucrativa
                </span>{" "}
                e previsível
              </h1>
              <p className="text-lg text-white/70 mb-8 max-w-xl leading-relaxed">
                O Beauty Core é o sistema completo que une agenda, financeiro, clientes e marketing em
                um só lugar — para você ter mais controle, mais lucro e crescimento real.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  "Controle total do seu financeiro (fluxo de caixa automático)",
                  "Saiba exatamente quanto você lucra, não só quanto fatura",
                  "Agenda inteligente que evita horários vazios",
                  "Recupere clientes inativos no automático com WhatsApp",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-white/80">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(267_84%_55%/0.2)] border border-[hsl(267_84%_55%/0.4)]">
                      <Check className="h-3 w-3 text-[hsl(267_84%_75%)]" />
                    </span>
                    <span className="text-sm md:text-base">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[hsl(267_84%_55%)] to-[hsl(267_84%_45%)] hover:opacity-90 text-white border-0 shadow-[0_0_32px_hsl(267_84%_55%/0.5)] text-base px-7 py-6"
                  asChild
                >
                  <a href="/auth?tab=signup">
                    Começar teste grátis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white text-base px-7 py-6"
                >
                  Ver como funciona
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/50">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[hsl(45_93%_66%)]" /> Sem cartão de crédito</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[hsl(45_93%_66%)]" /> 14 dias grátis</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[hsl(45_93%_66%)]" /> Cancelamento fácil</span>
              </div>
            </div>

            {/* Mockup */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(267_84%_55%/0.3)] to-[hsl(45_93%_60%/0.2)] blur-3xl" />
              <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 backdrop-blur-xl shadow-[0_0_60px_hsl(267_84%_55%/0.3)]">
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="h-3 w-3 rounded-full bg-red-500/70" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <div className="h-3 w-3 rounded-full bg-green-500/70" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-4">
                    <div>
                      <p className="text-xs text-white/50">Faturamento do mês</p>
                      <p className="text-2xl font-bold text-white">R$ 48.250</p>
                    </div>
                    <div className="flex items-center gap-1 text-[hsl(142_71%_55%)] text-sm font-semibold">
                      <TrendingUp className="h-4 w-4" /> +32%
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-white/50">Lucro real</p>
                      <p className="text-lg font-bold text-[hsl(45_93%_66%)]">R$ 18.430</p>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-white/50">Agendamentos</p>
                      <p className="text-lg font-bold text-white">142</p>
                    </div>
                  </div>
                  {/* Fake chart */}
                  <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-white/50 mb-3">Evolução de receita</p>
                    <div className="flex items-end gap-1.5 h-24">
                      {[40, 55, 35, 70, 50, 80, 65, 90, 75, 95, 85, 100].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-gradient-to-t from-[hsl(267_84%_55%)] to-[hsl(45_93%_66%)] opacity-90"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="relative py-24 border-t border-white/5">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Badge className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300">O Problema</Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            Seu salão fatura… mas você não sabe para onde o{" "}
            <span className="bg-gradient-to-r from-red-400 to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
              dinheiro está indo?
            </span>
          </h2>
          <p className="text-lg text-white/70 mb-10">A maioria dos salões vive no escuro:</p>
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto mb-10">
            {[
              "Não sabe o lucro real",
              "Não controla despesas",
              "Agenda desorganizada",
              "Clientes que somem",
            ].map((p) => (
              <div key={p} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <X className="h-5 w-5 text-red-400 shrink-0" />
                <span className="text-white/80">{p}</span>
              </div>
            ))}
          </div>
          <p className="text-xl md:text-2xl font-semibold">
            Isso não é falta de cliente.{" "}
            <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
              É falta de gestão.
            </span>
          </p>
        </div>
      </section>

      {/* TRANSFORMAÇÃO */}
      <section className="py-24 border-t border-white/5">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-[hsl(267_84%_55%/0.15)] border border-[hsl(267_84%_55%/0.4)] text-[hsl(267_84%_80%)]">
              A Transformação
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Transforme desorganização em{" "}
              <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
                crescimento previsível
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
              <p className="text-sm text-white/50 mb-4 uppercase tracking-wider">Antes</p>
              <ul className="space-y-4">
                {["Agenda bagunçada", "Faturamento confuso", "Clientes sumindo", "Sem controle"].map((i) => (
                  <li key={i} className="flex items-center gap-3 text-white/70">
                    <X className="h-5 w-5 text-red-400" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[hsl(267_84%_55%/0.4)] bg-gradient-to-br from-[hsl(267_84%_55%/0.15)] to-[hsl(45_93%_60%/0.05)] p-8 shadow-[0_0_40px_hsl(267_84%_55%/0.25)]">
              <p className="text-sm text-[hsl(45_93%_70%)] mb-4 uppercase tracking-wider">Depois com Beauty Core</p>
              <ul className="space-y-4">
                {["Agenda inteligente", "Fluxo de caixa claro", "Clientes recorrentes", "Gestão profissional"].map((i) => (
                  <li key={i} className="flex items-center gap-3 text-white">
                    <Check className="h-5 w-5 text-[hsl(45_93%_66%)]" />
                    <span className="font-medium">{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* TUDO EM UM SÓ LUGAR */}
      <section id="funcionalidades" className="py-24 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <Badge className="mb-4 bg-white/5 border border-white/10 text-white/70">Tudo em um só lugar</Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Tudo que seu salão precisa para crescer, em um{" "}
              <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
                único sistema
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Calendar, title: "Agenda Inteligente", desc: "Nunca perca horários. Controle total da agenda." },
              { icon: Users, title: "Gestão de Clientes", desc: "Histórico completo + reativação automática." },
              { icon: Wallet, title: "Financeiro Completo", desc: "Fluxo de caixa, despesas e lucro real." },
              { icon: BarChart3, title: "Relatórios Inteligentes", desc: "Decisões baseadas em dados reais." },
              { icon: Percent, title: "Comissões Automáticas", desc: "Controle de profissionais sem dor de cabeça." },
              { icon: MessageCircle, title: "WhatsApp Integrado", desc: "Marketing e relacionamento automatizado." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 hover:border-[hsl(267_84%_55%/0.5)] transition-all hover:shadow-[0_0_30px_hsl(267_84%_55%/0.25)]"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(267_84%_55%/0.3)] to-[hsl(45_93%_60%/0.15)] border border-white/10 mb-4">
                  <Icon className="h-5 w-5 text-[hsl(45_93%_70%)]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINANCEIRO - DIFERENCIAL */}
      <section id="financeiro" className="py-24 border-t border-white/5 relative">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-6 bg-[hsl(45_93%_60%/0.15)] border border-[hsl(45_93%_60%/0.4)] text-[hsl(45_93%_70%)]">
                Seu diferencial
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                Pare de só faturar.{" "}
                <span className="bg-gradient-to-r from-[hsl(45_93%_66%)] to-[hsl(267_84%_70%)] bg-clip-text text-transparent">
                  Comece a lucrar de verdade.
                </span>
              </h2>
              <p className="text-lg text-white/70 mb-8 leading-relaxed">
                O Beauty Core não mostra só quanto você vende — ele mostra{" "}
                <span className="text-white font-semibold">quanto sobra no seu bolso.</span>
              </p>
              <ul className="space-y-3">
                {[
                  "Fluxo de caixa automático",
                  "Controle de entradas e saídas",
                  "Visão clara de lucro/prejuízo",
                  "Relatórios financeiros completos",
                ].map((i) => (
                  <li key={i} className="flex items-center gap-3 text-white/85">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(267_84%_55%)] to-[hsl(45_93%_60%)] shadow-[0_0_12px_hsl(267_84%_55%/0.5)]">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(45_93%_60%/0.2)] to-[hsl(267_84%_55%/0.2)] blur-3xl" />
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-gradient-to-br from-[hsl(142_71%_42%/0.2)] to-transparent border border-[hsl(142_71%_42%/0.3)] p-4">
                    <p className="text-xs text-white/60">Entradas</p>
                    <p className="text-xl font-bold text-[hsl(142_71%_60%)]">R$ 52.180</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-red-500/15 to-transparent border border-red-500/30 p-4">
                    <p className="text-xs text-white/60">Saídas</p>
                    <p className="text-xl font-bold text-red-400">R$ 33.750</p>
                  </div>
                </div>
                <div className="rounded-xl bg-gradient-to-r from-[hsl(267_84%_55%/0.25)] to-[hsl(45_93%_60%/0.2)] border border-[hsl(45_93%_60%/0.3)] p-5 mb-4">
                  <p className="text-xs text-white/70 uppercase tracking-wider">Lucro real</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-white to-[hsl(45_93%_70%)] bg-clip-text text-transparent">
                    R$ 18.430
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Pix", v: 42 },
                    { label: "Crédito", v: 31 },
                    { label: "Débito", v: 18 },
                    { label: "Dinheiro", v: 9 },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-3 text-sm">
                      <span className="w-20 text-white/60">{r.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[hsl(267_84%_55%)] to-[hsl(45_93%_66%)]"
                          style={{ width: `${r.v}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-white/70">{r.v}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-24 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-white/5 border border-white/10 text-white/70">Prova social</Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Salões que cresceram com o{" "}
              <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
                Beauty Core
              </span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "Passei a entender meu lucro de verdade. Hoje sei quanto sobra todo mês.", name: "Maria Silva", role: "Salão Beleza Pura" },
              { quote: "Minha agenda nunca mais ficou vazia. O sistema me ajuda a preencher horários.", name: "João Santos", role: "Barbearia Style" },
              { quote: "Comecei a crescer de forma organizada, com números na mão.", name: "Ana Costa", role: "Estética Renovar" },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-[hsl(45_93%_60%/0.4)] transition-colors">
                <div className="flex text-[hsl(45_93%_66%)] mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="text-white/85 mb-5 leading-relaxed">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-sm text-white/50">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARA QUEM É */}
      <section className="py-24 border-t border-white/5">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-10">
            O Beauty Core é{" "}
            <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
              para você que:
            </span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              "Quer parar de improvisar",
              "Quer ter controle financeiro",
              "Quer crescer de forma estruturada",
              "Quer profissionalizar seu salão",
            ].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <Zap className="h-5 w-5 text-[hsl(45_93%_66%)] shrink-0" />
                <span className="text-white/85">{i}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-24 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <Badge className="mb-4 bg-white/5 border border-white/10 text-white/70">Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Invista no{" "}
              <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
                crescimento do seu salão
              </span>
            </h2>
            <p className="text-white/60">Escolha o nível de crescimento do seu negócio.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                slug: "individual",
                name: "Individual",
                price: "R$ 29,90",
                desc: "Para profissionais autônomos.",
                features: [
                  "Até 300 clientes",
                  "1 usuário (administrador)",
                  "Agenda inteligente",
                  "Comissões automáticas",
                  "Relatórios completos",
                ],
                featured: false,
              },
              {
                slug: "profissional",
                name: "Profissional",
                price: "R$ 69,90",
                desc: "Para salões em crescimento.",
                features: [
                  "Clientes ilimitados",
                  "Até 4 usuários",
                  "Agenda inteligente",
                  "Comissões automáticas",
                  "Relatórios avançados",
                ],
                featured: true,
              },
              {
                slug: "empresa",
                name: "Empresa",
                price: "R$ 109,90",
                desc: "Para equipes maiores e operações multi-cadeira.",
                features: [
                  "Clientes ilimitados",
                  "Até 20 usuários",
                  "Agenda inteligente",
                  "Comissões automáticas",
                  "Relatórios avançados",
                  "Suporte prioritário",
                ],
                featured: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-7 ${
                  plan.featured
                    ? "border-[hsl(45_93%_60%/0.5)] bg-gradient-to-br from-[hsl(267_84%_55%/0.15)] to-[hsl(45_93%_60%/0.08)] shadow-[0_0_40px_hsl(267_84%_55%/0.3)] md:scale-105"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-[hsl(267_84%_55%)] to-[hsl(45_93%_60%)] text-white border-0">
                      ⭐ Mais popular
                    </Badge>
                  </div>
                )}
                <h3 className="text-xl font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-white/60 mb-5">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-white/50">/mês</span>
                </div>
                <ul className="space-y-3 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className={`h-4 w-4 mt-0.5 ${plan.featured ? "text-[hsl(45_93%_66%)]" : "text-[hsl(267_84%_70%)]"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${
                    plan.featured
                      ? "bg-gradient-to-r from-[hsl(267_84%_55%)] to-[hsl(267_84%_45%)] hover:opacity-90 text-white border-0 shadow-[0_0_24px_hsl(267_84%_55%/0.5)]"
                      : "bg-white/5 border border-white/15 text-white hover:bg-white/10"
                  }`}
                  asChild
                >
                  <a href={`/auth?tab=signup&plan=${plan.slug}`}>Começar 10 dias grátis</a>
                </Button>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[hsl(267_84%_30%/0.2)] to-transparent" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Seu salão pode faturar mais…{" "}
            <span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">
              ou crescer de verdade.
            </span>
          </h2>
          <p className="text-xl text-white/70 mb-10">A diferença está na gestão.</p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-[hsl(267_84%_55%)] to-[hsl(45_93%_60%)] hover:opacity-90 text-white border-0 shadow-[0_0_48px_hsl(267_84%_55%/0.6)] text-base px-10 py-7"
            asChild
          >
            <a href="/auth?tab=signup">
              Comece agora com o Beauty Core
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[hsl(45_93%_66%)]" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[hsl(45_93%_66%)]" /> 14 dias grátis</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[hsl(45_93%_66%)]" /> Cancelamento fácil</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-black/40">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(267_84%_55%)] to-[hsl(45_93%_60%)]" />
                <span className="text-xl font-bold">
                  Beauty<span className="bg-gradient-to-r from-[hsl(267_84%_70%)] to-[hsl(45_93%_66%)] bg-clip-text text-transparent">Core</span>
                </span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                Mais controle. Mais lucro. Mais crescimento.
              </p>
            </div>
            {[
              { title: "Produto", items: ["Funcionalidades", "Financeiro", "Planos"] },
              { title: "Suporte", items: ["Central de Ajuda", "Contato", "WhatsApp"] },
              { title: "Empresa", items: ["Sobre", "Blog", "Privacidade"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold mb-4 text-white">{col.title}</h4>
                <ul className="space-y-2 text-sm text-white/50">
                  {col.items.map((i) => (
                    <li key={i}><a href="#" className="hover:text-white transition-colors">{i}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 mt-10 pt-6 text-center text-xs text-white/40">
            <p>&copy; 2026 Beauty Core. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
