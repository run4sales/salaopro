import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  plan: string | null;
  status: string | null;
};

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    // Basic SEO for this page
    document.title = "Painel Super Admin | Salão PRO";
    const metaName = "description";
    const description =
      "Painel Super Admin: estabelecimentos, planos, contatos e faturamento total";
    let meta = document.querySelector(`meta[name="${metaName}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", metaName);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);

    // Canonical
    const canonicalHref = `${window.location.origin}/admin`;
    let link: HTMLLinkElement | null = document.querySelector(
      'link[rel="canonical"]'
    );
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonicalHref);
  }, []);

  React.useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const isSuperAdmin = roles?.includes("super_admin");

  const profilesQuery = useQuery({
    queryKey: ["profiles-all"],
    enabled: !!isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,business_name,owner_name,phone,email,plan,status"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["clients-all"],
    enabled: !!isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("establishment_id");
      if (error) throw error;
      return data as { establishment_id: string }[];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["sales-sum"],
    enabled: !!isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("amount");
      if (error) throw error;
      return (data ?? []) as { amount: number }[];
    },
  });

  const clientCountByEstablishment = React.useMemo(() => {
    const map = new Map<string, number>();
    (clientsQuery.data ?? []).forEach((c) => {
      map.set(c.establishment_id, (map.get(c.establishment_id) ?? 0) + 1);
    });
    return map;
  }, [clientsQuery.data]);

  const totalEstablishments = profilesQuery.data?.length ?? 0;
  const totalRevenue = React.useMemo(() => {
    return (salesQuery.data ?? []).reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [salesQuery.data]);

  if (loadingRoles || profilesQuery.isLoading || clientsQuery.isLoading || salesQuery.isLoading) {
    return (
      <main className="p-4 md:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Painel Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Carregando visão geral dos estabelecimentos…
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 mt-6" />
      </main>
    );
  }

  if (!isSuperAdmin) {
    return (
      <main className="p-4 md:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Acesso restrito</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Esta área é exclusiva para Super Admin.
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className={cn("text-2xl font-semibold")}>Painel Super Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral dos estabelecimentos, contatos, planos e clientes.
        </p>
      </header>

      <section aria-label="Métricas" className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estabelecimentos cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalEstablishments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Faturamento total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalRevenue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              Soma de vendas (sales.amount) de todos os estabelecimentos.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8" aria-label="Lista de estabelecimentos">
        <Card>
          <CardHeader>
            <CardTitle>Estabelecimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salão</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profilesQuery.data?.map((p) => {
                    const count = clientCountByEstablishment.get(p.id) ?? 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.business_name}</TableCell>
                        <TableCell>{p.owner_name}</TableCell>
                        <TableCell>
                          {p.phone ? (
                            <a
                              href={`https://wa.me/55${p.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline-offset-2 hover:underline"
                            >
                              {p.phone}
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {p.email ? (
                            <a
                              href={`mailto:${p.email}`}
                              className="underline-offset-2 hover:underline"
                            >
                              {p.email}
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{p.plan ?? "trial"}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    );
                  })}
                  {profilesQuery.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum estabelecimento encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
