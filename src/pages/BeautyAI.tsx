import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Bot, Loader2, RefreshCw, Send, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

type BeautyAIStatus = {
  allowed: boolean;
  plan_eligible?: boolean;
  enabled?: boolean;
  subscription_regular?: boolean;
  monthly_limit?: number;
  usage_count?: number;
  remaining?: number;
  reason?: string;
};

const SUGGESTIONS = [
  "Quanto faturei este mês?",
  "Quais clientes estão inativos?",
  "Quais são minhas despesas pendentes?",
  "Quais serviços mais vendem?",
  "Como está o desempenho do meu salão?",
];

const GREETING =
  "Olá! Eu sou a Beauty IA, sua assistente inteligente de gestão.\n\nPosso analisar o faturamento, despesas, clientes, profissionais e desempenho do seu salão.\n\nO que você gostaria de descobrir hoje?";

function blockedReason(status: BeautyAIStatus | undefined): string {
  if (!status) return "Não foi possível validar seu acesso à Beauty IA.";
  if (status.plan_eligible === false)
    return "A Beauty IA está disponível nos planos Profissional e Empresa. Fale com nosso time para fazer upgrade.";
  if (status.enabled === false)
    return "A Beauty IA ainda não foi liberada para este salão. Entre em contato com nosso suporte.";
  if (status.subscription_regular === false)
    return "O acesso à Beauty IA está suspenso porque a assinatura do salão não está regular.";
  if ((status.remaining ?? 0) <= 0)
    return "Você atingiu o limite de utilização da Beauty IA neste mês. Entre em contato com nosso suporte para consultar a disponibilidade de mais interações.";
  return "A Beauty IA não está disponível para este salão no momento.";
}

export default function BeautyAI() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.title = "Beauty IA | Beauty Core";
  }, []);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["beauty-ai-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_beauty_ai_status");
      if (error) throw error;
      return data as unknown as BeautyAIStatus;
    },
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["beauty-ai-messages", profile?.id],
    enabled: !!profile?.id && !!status?.allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beauty_ai_messages")
        .select("id, role, content, created_at")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("beauty-ai-chat", { body: { message } });
      if (error) {
        const detail = (data as { error?: string } | null)?.error;
        throw new Error(detail || "A Beauty IA está temporariamente indisponível. Tente novamente em instantes.");
      }
      return data as { reply: string; usage: { used: number; limit: number; remaining: number } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beauty-ai-messages"] });
      queryClient.invalidateQueries({ queryKey: ["beauty-ai-status"] });
      setPending(null);
      textareaRef.current?.focus();
    },
    onError: (error) => {
      setPending(null);
      toast({
        title: "Beauty IA",
        description: error instanceof Error ? error.message : "Erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      textareaRef.current?.focus();
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) return;
      const { error } = await supabase.from("beauty_ai_messages").delete().eq("establishment_id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beauty-ai-messages"] });
      toast({ title: "Nova conversa iniciada" });
      textareaRef.current?.focus();
    },
  });

  const send = (text: string) => {
    const message = text.trim();
    if (!message || sendMutation.isPending) return;
    setInput("");
    setPending(message);
    sendMutation.mutate(message);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [status?.allowed]);

  if (statusLoading) {
    return (
      <main className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (!status?.allowed) {
    return (
      <main className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary-glow" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Beauty IA</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{blockedReason(status)}</p>
        </div>
      </main>
    );
  }

  const isEmpty = !messages?.length && !pending;

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto p-4 md:p-6 gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent shadow-[0_0_18px_hsl(var(--primary)/0.4)] flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none">Beauty IA</h1>
            <p className="text-xs text-muted-foreground mt-1">Copiloto inteligente do seu salão</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {status.usage_count ?? 0} de {status.monthly_limit ?? 0} interações neste mês
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || isEmpty}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Nova conversa
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-4 space-y-4">
        {messagesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-16 w-1/2 ml-auto" />
          </div>
        ) : (
          <>
            {isEmpty && (
              <div className="space-y-6 py-6">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-glow" />
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                    <ReactMarkdown>{GREETING}</ReactMarkdown>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-11">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages?.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-glow" />
                  </div>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap"
                      : "max-w-[85%] prose prose-sm dark:prose-invert max-w-none text-foreground"
                  }
                >
                  {m.role === "user" ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                </div>
                {m.role === "user" && (
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {pending && (
              <>
                <div className="flex gap-3 justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {pending}
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-glow" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando os dados do seu salão...
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <form
        className="flex gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Pergunte sobre faturamento, clientes, comissões..."
          className="min-h-[52px] max-h-32 resize-none"
          maxLength={2000}
          disabled={sendMutation.isPending}
        />
        <Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" disabled={!input.trim() || sendMutation.isPending}>
          {sendMutation.isPending ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </form>
    </main>
  );
}
