import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAppointments from "./tools/list-appointments";
import listClients from "./tools/list-clients";
import listServices from "./tools/list-services";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "salaopro-mcp",
  title: "SalaoPro MCP",
  version: "0.1.0",
  instructions:
    "Tools for the SalaoPro salon management app. Use list_appointments to read the salon agenda, list_clients to look up customers, and list_services to see the salon's service catalog. All calls are scoped to the signed-in user's salon.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAppointments, listClients, listServices],
});
