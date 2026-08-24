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
      .select("id, appointment_date, duration_minutes, status, notes, client_id, professional_id, service_id")
      .gte("appointment_date", start)
      .lt("appointment_date", end)
      .order("appointment_date", { ascending: true })
      .limit(limit ?? 100);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const appointments = (data ?? []).map((row) => {
      const startTime = row.appointment_date as string;
      const duration = Number(row.duration_minutes ?? 30);
      const endTime = new Date(new Date(startTime).getTime() + duration * 60_000).toISOString();
      return {
        id: row.id,
        start_time: startTime,
        end_time: endTime,
        status: row.status,
        notes: row.notes,
        client_id: row.client_id,
        professional_id: row.professional_id,
        service_id: row.service_id,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(appointments, null, 2) }],
      structuredContent: { appointments },
    };
  },
});
