import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { navigationScope, readNavigation, safeNavigationRoute, writeNavigation } from "@/lib/navigationPersistence";

export function restoredNavigation(userId: string, establishmentId: string, role: "owner" | "admin" | "employee" | null) {
  try {
    return readNavigation(window.localStorage, navigationScope(userId, establishmentId), "route", null as string | null,
      (value): value is string => typeof value === "string" && safeNavigationRoute(value, role) !== null);
  } catch { return null; }
}

export default function NavigationContinuity() {
  const { user, profile, establishmentRole, loading, profileError } = useAuth();
  const location = useLocation();
  const scope = user?.id && profile?.id ? navigationScope(user.id, profile.id) : null;
  useEffect(() => {
    if (!scope || loading || profileError) return;
    const route = safeNavigationRoute(location.pathname + location.search, establishmentRole);
    try { if (route) writeNavigation(window.localStorage, scope, "route", route); } catch { /* Storage may be denied. */ }
  }, [scope, loading, profileError, location.pathname, location.search, establishmentRole]);

  // Never intercept referral, recovery or provider callback URLs.
  if (location.pathname !== "/" || location.search || location.hash) return null;
  if (!loading && !profileError && user?.id && profile?.id) {
    const route = restoredNavigation(user.id, profile.id, establishmentRole);
    if (route) return <Navigate to={safeNavigationRoute(route, establishmentRole) ?? "/agenda"} replace />;
  }
  return null;
}