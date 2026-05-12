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
      { title: "Agenda", url: "/agenda", icon: Calendar },
      { title: "Clientes", url: "/clients", icon: Users },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Vendas", url: "/sales", icon: DollarSign },
      { title: "Despesas", url: "/expenses", icon: Receipt },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Métricas", url: "/metrics", icon: TrendingUp },
      { title: "Relatórios", url: "/reports", icon: BarChart3 },
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
    <Sidebar className="bg-sidebar text-sidebar-foreground" collapsible="offcanvas">
      <SidebarHeader>
        <div className="px-3 py-4">
          <div className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent tracking-tight">
            Salão PRO
          </div>
          <div className="text-xs text-sidebar-foreground/60 mt-0.5">Gestão completa do seu salão</div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className="transition-colors"
                    >
                      <NavLink to={item.url} end>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
