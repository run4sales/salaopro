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
import { LayoutDashboard, Users, Scissors, DollarSign, LogOut, Calendar, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Serviços", url: "/services", icon: Scissors },
  { title: "Vendas", url: "/sales", icon: DollarSign },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export default function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="bg-sidebar text-sidebar-foreground" collapsible="offcanvas">
      <SidebarHeader>
        <div className="px-2 py-2">
          <div className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
            Salão PRO
          </div>
          <div className="text-xs text-sidebar-foreground/70">Gestão do seu salão</div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
