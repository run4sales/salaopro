import { createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthContextType {
  establishmentRole: "owner" | "admin" | "employee" | null;
  professionalId: string | null;
  user: User | null;
  session: Session | null;
  profile: any | null;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  profileError: string | null;
  retryProfile: () => Promise<void>;
}

// Keep context identity outside the component hot-refresh boundary. Provider and
// consumers must reference the same object even while the provider module updates.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}