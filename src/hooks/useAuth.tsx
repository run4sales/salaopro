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

const AUTH_QUERY_TIMEOUT_MS = 12000;

function withTimeout<T = any>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} demorou para responder`)), AUTH_QUERY_TIMEOUT_MS);
    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

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
      const resetProfileContext = () => {
        setProfile(null);
        setEstablishmentRole(null);
        setProfessionalId(null);
      };

      const { data: ownerProfile, error: ownerError } = await withTimeout<any>(
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle() as any,
        'Busca do perfil proprietário'
      );
      if (ownerError) {
        console.warn('Erro ao buscar perfil proprietário:', ownerError);
      }
      if (ownerProfile) {
        setProfile(ownerProfile);
        setEstablishmentRole("owner");
        setProfessionalId(null);
        return;
      }

      const { data: employeeContext, error: employeeContextError } = await withTimeout<any>(
        (supabase as any).rpc('get_my_employee_context'),
        'Busca do vínculo do funcionário'
      );

      if (employeeContextError) {
        console.warn('Erro ao buscar contexto seguro do funcionário:', employeeContextError);
      }

      const context = employeeContext as any;

      const membershipResult = context?.establishment_id
        ? { data: context, error: null }
        : await withTimeout<any>(
            supabase
              .from('establishment_users' as any)
              .select('role, professional_id, establishment_id')
              .eq('user_id', userId)
              .eq('active', true)
              .maybeSingle() as any,
            'Busca alternativa do vínculo do funcionário'
          );

      const { data: membershipData, error: membershipError } = membershipResult as any;
      if (membershipError) {
        console.warn('Erro ao buscar vínculo do funcionário:', membershipError);
      }
      const membership = membershipData as any;
      if (!membership?.establishment_id) {
        resetProfileContext();
        return;
      }

      // Funcionários precisam pelo menos do establishment_id para carregar agenda/atendimentos.
      setEstablishmentRole((membership.role as any) ?? null);
      setProfessionalId(membership.professional_id ?? null);
      setProfile({
        id: membership.establishment_id,
        business_name: membership.business_name,
        slug: membership.slug,
        accepting_bookings: membership.accepting_bookings,
      });

      // Enriquece dados do salão sem bloquear a liberação da tela do funcionário.
      void (async () => {
        const { data: linkedProfile, error: linkedProfileError } = await withTimeout<any>(
          (supabase as any).rpc('get_my_establishment_profile'),
          'Busca de dados do estabelecimento vinculado'
        );

        if (linkedProfileError) {
          console.warn('Erro ao buscar perfil do estabelecimento vinculado:', linkedProfileError);
          return;
        }

        if (linkedProfile) {
          setProfile(linkedProfile);
        }
      })();
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setEstablishmentRole(null);
      setProfessionalId(null);
    }
  };

  useEffect(() => {
    let active = true;

    const loadFor = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        await fetchProfile(s.user.id);
      } else {
        setProfile(null);
        setEstablishmentRole(null);
        setProfessionalId(null);
      }
      if (active) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer to avoid deadlocks inside the auth callback
      setTimeout(() => { void loadFor(s); }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => { void loadFor(s); });

    return () => { active = false; subscription.unsubscribe(); };
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
