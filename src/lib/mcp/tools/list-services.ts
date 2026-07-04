import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_shared";


export default defineTool({
  name: "list_services",
  title: "List services",
  description: "List services offered by the signed-in salon (name, price, duration).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("services")
      .select("id, name, price, duration_minutes, active")
      .order("name", { ascending: true })
      .limit(limit ?? 100);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { services: data ?? [] },
    };
  },
});
