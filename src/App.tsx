import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Services from "./pages/Services";
import Sales from "./pages/Sales";
import Agenda from "./pages/Agenda";
import Reports from "./pages/Reports";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import PublicBooking from "./pages/PublicBooking";
import AppLayout from "./components/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public pages */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/agendar/:establishmentId" element={<PublicBooking />} />

            {/* Internal pages (with sidebar) */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/services" element={<Services />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Dynamic public page, must be after other routes */}
            <Route path="/:slug" element={<PublicBooking />} />

            {/* Catch-all Not Found page */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
