import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_shared";
import { normalizePhone } from "../../contactValidation";



export default defineTool({
  name: "list_clients",
  title: "List clients",
  description: "List salon clients, optionally filtered by a search term matching name, phone, or email.",
  inputSchema: {
    search: z.string().describe("Optional search term (name, phone, email).").optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("clients")
      .select("id, name, phone, email, birth_date, notes")
      .order("name", { ascending: true })
      .limit(limit ?? 50);

    if (search && search.trim()) {
      const raw = search.trim();
      const term = raw.replace(/[,%()_*\\"\r\n]/g, "");
      if (!term) return { content: [{ type: "text", text: "Invalid search term" }], isError: true };
      const s = `%${term}%`;
      const phone = normalizePhone(raw);
      const filters = [`name.ilike.${s}`, `email.ilike.${s}`];
      if (phone) filters.push(`phone.ilike.%${phone}%`);
      q = q.or(filters.join(","));
    }

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { clients: data ?? [] },
    };
  },
});
