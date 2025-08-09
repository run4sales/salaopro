import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";

export default function AppLayout() {
  return (
    <SidebarProvider>
      {/* Header visível apenas no mobile para abrir a Sidebar */}
      <header className="h-12 flex items-center border-b md:hidden">
        <SidebarTrigger className="ml-2" />
        <span className="ml-2 text-sm font-semibold bg-gradient-primary bg-clip-text text-transparent">
          Salão PRO
        </span>
      </header>

      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
