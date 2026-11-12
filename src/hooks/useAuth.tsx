import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { clearNavigation } from '@/lib/navigationPersistence';
import { isTemporaryAuthError, needsAccessContext } from '@/lib/authContinuity';

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
  profileError: string | null;
  retryProfile: () => Promise<void>;
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
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileRequestRef = useRef(0);
  const sessionLoadRef = useRef(0);
  const verifiedUserRef = useRef<string | null>(null);
  const contextPromiseRef = useRef<Promise<void> | null>(null);
  const restoreRef = useRef<(() => Promise<void>) | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fetchProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestRef.current;
    const isCurrent = () => requestId === profileRequestRef.current;
    try {
      const resetProfileContext = () => {
        setProfile(null);
        setEstablishmentRole(null);
        setProfessionalId(null);
      };
      setProfileError(null);

      const [ownerResult, employeeResult, fallbackResult] = await Promise.allSettled([
        withTimeout<any>(supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle() as any, 'Busca do perfil proprietário'),
        withTimeout<any>((supabase as any).rpc('get_my_employee_context'), 'Busca do vínculo do funcionário'),
        withTimeout<any>(
          supabase.from('establishment_users' as any)
            .select('role, professional_id, establishment_id')
            .eq('user_id', userId)
            .eq('active', true)
            .maybeSingle() as any,
          'Busca alternativa do vínculo do funcionário'
        ),
      ]);
      if (!isCurrent()) return;

      const ownerResponse = ownerResult.status === 'fulfilled' ? ownerResult.value : null;
      const ownerProfile = ownerResponse?.data;
      const ownerError = ownerResponse?.error ?? (ownerResult.status === 'rejected' ? ownerResult.reason : null);
      if (ownerError) {
        console.warn('Erro ao buscar perfil proprietário:', ownerError);
      }
      if (ownerProfile) {
        setProfile(ownerProfile);
        setEstablishmentRole("owner");
        setProfessionalId(null);
        return;
      }

      const employeeResponse = employeeResult.status === 'fulfilled' ? employeeResult.value : null;
      const employeeContext = employeeResponse?.data;
      const employeeContextError = employeeResponse?.error ?? (employeeResult.status === 'rejected' ? employeeResult.reason : null);

      if (employeeContextError) {
        console.warn('Erro ao buscar contexto seguro do funcionário:', employeeContextError);
      }

      const context = employeeContext as any;

      const fallbackResponse = fallbackResult.status === 'fulfilled' ? fallbackResult.value : null;
      const fallbackError = fallbackResponse?.error ?? (fallbackResult.status === 'rejected' ? fallbackResult.reason : null);
      const membershipResult = context?.establishment_id
        ? { data: context, error: null }
        : { data: fallbackResponse?.data, error: fallbackError };

      const { data: membershipData, error: membershipError } = membershipResult as any;
      if (membershipError) {
        console.warn('Erro ao buscar vínculo do funcionário:', membershipError);
      }
      const membership = membershipData as any;
      if (!membership?.establishment_id) {
        resetProfileContext();
        setProfileError(ownerError && employeeContextError && membershipError
          ? 'Não foi possível carregar seus dados. Tente novamente.'
          : 'Seu acesso está autenticado, mas não possui vínculo ativo com um salão.');
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
        try {
          const { data: linkedProfile, error: linkedProfileError } = await withTimeout<any>(
            (supabase as any).rpc('get_my_establishment_profile'),
            'Busca de dados do estabelecimento vinculado'
          );

          if (linkedProfileError) {
            console.warn('Erro ao buscar perfil do estabelecimento vinculado:', linkedProfileError);
            return;
          }

          if (linkedProfile && isCurrent()) setProfile(linkedProfile);
        } catch (error) {
          console.warn('Erro ao enriquecer perfil do estabelecimento:', error);
        }
      })();
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (!isCurrent()) return;
      setProfile(null);
      setEstablishmentRole(null);
      setProfessionalId(null);
      setProfileError('Não foi possível carregar seus dados. Tente novamente.');
    }
  }, []);

  const retryProfile = useCallback(async () => {
    if (!user?.id) { await restoreRef.current?.(); return; }
    setLoading(true);
    try {
      await fetchProfile(user.id);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, user?.id]);

  useEffect(() => {
    let active = true;

    const loadFor = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      // The provider re-emits SIGNED_IN on tab focus and TOKEN_REFRESHED on renewal.
      // Updating credentials for the SAME identity must not unmount the outlet or refetch its profile.
      if (s?.user && !needsAccessContext(verifiedUserRef.current, s.user.id)) {
        await contextPromiseRef.current;
        return;
      }
      const loadId = ++sessionLoadRef.current;
      if (s?.user) {
        setLoading(true);
        setProfileError(null);
        if (verifiedUserRef.current && verifiedUserRef.current !== s.user.id) {
          clearNavigation(window.localStorage, verifiedUserRef.current);
          verifiedUserRef.current = null;
          profileRequestRef.current += 1;
          queryClient.clear();
          setUser(null);
          setProfile(null);
          setEstablishmentRole(null);
          setProfessionalId(null);
        }
        try {
          const { data, error } = await withTimeout(supabase.auth.getUser(), 'Verificação da sessão');
          if (!active || loadId !== sessionLoadRef.current) return;
          if (error) throw error;
          if (!data.user || data.user.id !== s.user.id) throw new Error('Sessão inválida');
          verifiedUserRef.current = data.user.id;
          setUser(data.user);
          contextPromiseRef.current = fetchProfile(data.user.id);
          await contextPromiseRef.current;
          contextPromiseRef.current = null;
        } catch (error) {
          if (!active || loadId !== sessionLoadRef.current) return;
          if (isTemporaryAuthError(error)) {
            // Do not revoke or duplicate provider storage on a temporary outage.
            setProfileError('Não foi possível verificar sua conexão. Tente novamente.');
          } else {
            await supabase.auth.signOut({ scope: 'local' });
          }
        }
      } else {
        if (verifiedUserRef.current) clearNavigation(window.localStorage, verifiedUserRef.current);
        verifiedUserRef.current = null;
        queryClient.clear();
        setUser(null);
        profileRequestRef.current += 1;
        setProfile(null);
        setEstablishmentRole(null);
        setProfessionalId(null);
        setProfileError(null);
      }
      if (active && loadId === sessionLoadRef.current) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer to avoid deadlocks inside the auth callback
      setTimeout(() => { void loadFor(s); }, 0);
    });

    const restore = async () => {
      setLoading(true);
      setProfileError(null);
      try {
        const { data: { session: s }, error } = await withTimeout(supabase.auth.getSession(), 'Restauração da sessão');
        if (error) throw error;
        await loadFor(s);
      } catch {
        if (!active) return;
        setProfileError('Não foi possível carregar seus dados. Tente novamente.');
        setLoading(false);
      }
    };
    restoreRef.current = restore;
    void restore();

    // Provider owns visibility-based token refresh. Online merely retries a failed initial validation.
    const retryConnection = () => { if (!verifiedUserRef.current) void restore(); };
    window.addEventListener('online', retryConnection);

    return () => { active = false; restoreRef.current = null; subscription.unsubscribe(); window.removeEventListener('online', retryConnection); };
  }, [fetchProfile, queryClient]);

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
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      toast({ title: 'Não foi possível sair', description: 'Tente novamente.', variant: 'destructive' });
      return;
    }
    if (user?.id) clearNavigation(window.localStorage, user.id);
    queryClient.clear();
    verifiedUserRef.current = null;
    profileRequestRef.current += 1;
    sessionLoadRef.current += 1;
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
    profileError,
    retryProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
