import { apiCaller } from "@/lib/api-keys";
import { apiMonitor } from "@/lib/api-view";
import { listMonitors } from "@/lib/monitors-db";

/** GET /api/v1/monitors: every monitor on the account, with its current state. */
export async function GET(request: Request) {
  const c = apiCaller(request);
  if (!c.ok) return c.response;
  return Response.json({ monitors: listMonitors(c.userId).map((m) => apiMonitor(m, c.plan)) });
}
