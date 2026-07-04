import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_shared";



export default defineTool({
  name: "list_appointments",
  title: "List appointments",
  description: "List appointments for the signed-in salon within a date range (defaults to today).",
  inputSchema: {
    start_date: z.string().describe("ISO date/time lower bound (inclusive). Defaults to today 00:00.").optional(),
    end_date: z.string().describe("ISO date/time upper bound (exclusive). Defaults to tomorrow 00:00.").optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const now = new Date();
    const start = start_date ?? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = end_date ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { data, error } = await supabaseForUser(ctx)
      .from("appointments")
      .select("id, start_time, end_time, status, notes, client_id, professional_id, service_id")
      .gte("start_time", start)
      .lt("start_time", end)
      .order("start_time", { ascending: true })
      .limit(limit ?? 100);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { appointments: data ?? [] },
    };
  },
});
