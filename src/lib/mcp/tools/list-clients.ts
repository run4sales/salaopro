import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_shared";


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
      const s = `%${search.trim()}%`;
      q = q.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
    }

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { clients: data ?? [] },
    };
  },
});
