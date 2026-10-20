import { apiCaller } from "@/lib/api-keys";
import { apiHistory, apiMonitor } from "@/lib/api-view";
import { getMonitor } from "@/lib/monitors-db";

/** GET /api/v1/monitors/:id?days=30: one monitor, with daily uptime for up to the plan's history (365 days on Pro). */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/monitors/[id]">) {
  const c = apiCaller(request);
  if (!c.ok) return c.response;
  const id = Number((await ctx.params).id);
  const m = Number.isInteger(id) ? getMonitor(id, c.userId) : undefined;
  if (!m) return Response.json({ error: "Monitor not found." }, { status: 404 });
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  return Response.json({ monitor: apiMonitor(m, c.plan), history: apiHistory(m.id, c.plan, days) });
}
