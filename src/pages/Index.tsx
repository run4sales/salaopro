import LandingPage from "@/components/LandingPage";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Navigate, useLocation } from "react-router-dom";
import { restoredNavigation } from "@/components/NavigationContinuity";
import { safeNavigationRoute } from "@/lib/navigationPersistence";

const Index = () => {
  const { user, profile, establishmentRole, loading, profileError, retryProfile } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Restaurando acesso...</div>;
  if (profileError) return <div className="p-6 space-y-4"><p>{profileError}</p><Button onClick={() => void retryProfile()}>Tentar novamente</Button></div>;
  if (user?.id && profile?.id && !location.search && !location.hash) {
    const route = safeNavigationRoute(restoredNavigation(user.id, profile.id, establishmentRole), establishmentRole);
    if (route) return <Navigate to={route} replace />;
  }
  return <LandingPage />;
};

export default Index;
