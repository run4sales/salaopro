import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Scissors,
  DollarSign,
  LogOut,
  Calendar,
  BarChart3,
  Settings,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const groups = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda Inteligente", url: "/agenda", icon: Calendar },
      { title: "Gestão de Clientes", url: "/clients", icon: Users },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Vendas (PDV)", url: "/sales", icon: DollarSign },
      { title: "Despesas", url: "/expenses", icon: Receipt },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { title: "Métricas", url: "/metrics", icon: TrendingUp },
      { title: "Relatórios Inteligentes", url: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Configuração",
    items: [
      { title: "Serviços", url: "/services", icon: Scissors },
      { title: "Configurações", url: "/settings", icon: Settings },
    ],
  },
];

export default function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border" collapsible="offcanvas">
      <SidebarHeader>
        <div className="px-3 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent shadow-[0_0_18px_hsl(var(--primary)/0.5)]" />
            <div>
              <div className="text-lg font-bold tracking-tight leading-none">
                Beauty<span className="bg-gradient-to-r from-primary-glow to-accent bg-clip-text text-transparent">Core</span>
              </div>
              <div className="text-[10px] text-sidebar-foreground/50 mt-1 uppercase tracking-wider">
                Gestão premium
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/40">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground border border-primary/30 shadow-[0_0_18px_hsl(var(--primary)/0.25)] hover:bg-sidebar-accent"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
                        }
                      >
                        <NavLink to={item.url} end>
                          <item.icon className={active ? "text-primary-glow" : ""} />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="text-sidebar-foreground/70 hover:bg-destructive/15 hover:text-destructive"
            >
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
