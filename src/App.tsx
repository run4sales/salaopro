import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Services from "./pages/Services";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Agenda from "./pages/StableAgenda";
import Reports from "./pages/Reports";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import PublicBooking from "./pages/PublicBooking";
import AppLayout from "./components/AppLayout";
import SuperAdmin from "./pages/SuperAdmin";
import Attendances from "./pages/Attendances";
import Users from "./pages/Users";
import SelectPlan from "./pages/SelectPlan";
import Checkout from "./pages/Checkout";
import Plans from "./pages/Plans";

const queryClient = new QueryClient();

const employeeAllowedRoutes = new Set(["/agenda", "/atendimentos", "/services", "/products", "/sales"]);

function RoleProtectedRoute({ children }: { children: ReactNode }) {
  const { establishmentRole, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando permissões...</div>;
  }

  if (establishmentRole === "employee" && !employeeAllowedRoutes.has(path)) {
    return <Navigate to="/agenda" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Index />} />
              <Route path="/agendar/:establishmentId" element={<PublicBooking />} />
              <Route path="/:slug" element={<PublicBooking />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<RoleProtectedRoute><Dashboard /></RoleProtectedRoute>} />
                <Route path="/clients" element={<RoleProtectedRoute><Clients /></RoleProtectedRoute>} />
                <Route path="/services" element={<RoleProtectedRoute><Services /></RoleProtectedRoute>} />
                <Route path="/products" element={<RoleProtectedRoute><Products /></RoleProtectedRoute>} />
                <Route path="/sales" element={<RoleProtectedRoute><Sales /></RoleProtectedRoute>} />
                <Route path="/expenses" element={<RoleProtectedRoute><Expenses /></RoleProtectedRoute>} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/atendimentos" element={<Attendances />} />
                <Route path="/reports" element={<RoleProtectedRoute><Reports /></RoleProtectedRoute>} />
                <Route path="/metrics" element={<RoleProtectedRoute><Metrics /></RoleProtectedRoute>} />
                <Route path="/settings" element={<RoleProtectedRoute><Settings /></RoleProtectedRoute>} />
                <Route path="/users" element={<RoleProtectedRoute><Users /></RoleProtectedRoute>} />
                <Route path="/escolher-plano" element={<RoleProtectedRoute><SelectPlan /></RoleProtectedRoute>} />
                <Route path="/checkout" element={<RoleProtectedRoute><Checkout /></RoleProtectedRoute>} />
                <Route path="/planos" element={<RoleProtectedRoute><Plans /></RoleProtectedRoute>} />
                <Route path="/admin" element={<RoleProtectedRoute><SuperAdmin /></RoleProtectedRoute>} />

                <Route path="/super-admin" element={<RoleProtectedRoute><SuperAdmin /></RoleProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
