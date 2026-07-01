import { NavLink, useLocation } from "react-router-dom";
import { Calendar, LogOut, PlayCircle } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

const employeeItems = [
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Atendimentos", url: "/atendimentos", icon: PlayCircle },
];

export default function EmployeeSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();

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
              <div className="text-[10px] text-sidebar-foreground/50 mt-1 uppercase tracking-wider">Área do funcionário</div>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/40">Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employeeItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} className={active ? "bg-sidebar-accent text-sidebar-accent-foreground border border-primary/30 shadow-[0_0_18px_hsl(var(--primary)/0.25)] hover:bg-sidebar-accent" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"}>
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
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <div className="px-2 pb-2">
          <ThemeToggle className="w-full border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-sidebar-foreground/70 hover:bg-destructive/15 hover:text-destructive">
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
