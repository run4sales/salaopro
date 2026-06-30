import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [establishmentRole, setEstablishmentRole] = useState<"owner" | "admin" | "employee" | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (ownerProfile) {
        setProfile(ownerProfile);
        setEstablishmentRole("owner");
        setProfessionalId(null);
        return;
      }

      const { data: membershipData } = await supabase
        .from('establishment_users' as any)
        .select('role, professional_id, establishment_id')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle();
      const membership = membershipData as any;
      if (!membership?.establishment_id) {
        setProfile(null);
        setEstablishmentRole(null);
        setProfessionalId(null);
        return;
      }

      const { data: linkedProfile } = await (supabase as any)
        .rpc('get_my_establishment_profile');
      setProfile(linkedProfile ?? null);
      setEstablishmentRole((membership.role as any) ?? null);
      setProfessionalId(membership.professional_id ?? null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setEstablishmentRole(null);
      setProfessionalId(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setLoading(true);
          // Defer profile fetching with setTimeout to prevent Supabase auth callback deadlocks,
          // but keep auth loading active until the employee/owner context is resolved.
          setTimeout(async () => {
            await fetchProfile(session.user.id);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setEstablishmentRole(null);
          setProfessionalId(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata
      }
    });

    if (error) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const { error: agendorError } = await supabase.functions.invoke('agendor-create-signup-lead', {
        body: {
          ...metadata,
          email,
        },
      });

      if (agendorError) {
        console.error('Erro ao enviar cadastro para o Agendor:', agendorError);
      }

      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu email para confirmar a conta.",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast({
        title: "Erro ao enviar recuperação",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email de recuperação enviado",
        description: "Confira sua caixa de entrada para criar uma nova senha.",
      });
    }

    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        title: "Erro ao atualizar senha",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Senha atualizada",
        description: "Sua nova senha já pode ser usada para acessar o sistema.",
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setEstablishmentRole(null);
    setProfessionalId(null);
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  const value = {
    user,
    session,
    profile,
    signUp,
    signIn,
    resetPassword,
    updatePassword,
    signOut,
    loading,
    establishmentRole,
    professionalId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
