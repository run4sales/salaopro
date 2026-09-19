import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validateEmail } from "../_shared/contact-validation.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const body = await req.json();
    const validation = validateEmail(body?.email, true);
    if (!validation.valid) return json({ status: validation.code, error: validation.message }, 400);
    const domain = validation.normalized.split("@")[1];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
        headers: { Accept: "application/dns-json" }, signal: controller.signal,
      });
      if (!response.ok) return json({ status: "inconclusive", mailbox_confirmed: false });
      const dns = await response.json();
      if (dns.Status === 3) return json({ status: "domain_not_found", error: "O domínio deste e-mail não existe. Verifique o endereço digitado.", mailbox_confirmed: false }, 400);
      const hasMx = Array.isArray(dns.Answer) && dns.Answer.some((answer: { type?: number; data?: string }) => answer.type === 15 && answer.data && !answer.data.endsWith(" ."));
      return json({ status: hasMx ? "mail_domain" : "inconclusive", mailbox_confirmed: false });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return json({ status: "inconclusive", mailbox_confirmed: false });
  }
});