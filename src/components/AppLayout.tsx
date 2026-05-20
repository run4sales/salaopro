import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";

export default function AppLayout() {
  return (
    <div className="dark">
      <SidebarProvider>
        {/* Header visível apenas no mobile para abrir a Sidebar */}
        <header className="h-12 flex items-center border-b border-border bg-background md:hidden">
          <SidebarTrigger className="ml-2 text-foreground" />
          <span className="ml-2 text-sm font-bold tracking-tight">
            Beauty<span className="bg-gradient-to-r from-primary-glow to-accent bg-clip-text text-transparent">Core</span>
          </span>
        </header>

        <div className="flex min-h-screen w-full bg-background text-foreground">
          <AppSidebar />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
