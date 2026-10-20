import { currentUser } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getMonitor, uptimeByMonth } from "@/lib/monitors-db";

const DAY = 86_400_000;

/** A monitor's uptime month by month, as far back as the plan shows (newest first). */
export async function GET(request: Request, ctx: RouteContext<"/api/monitors/[id]/history">) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  const m = Number.isInteger(id) ? getMonitor(id, user.id) : undefined;
  if (!m) return Response.json({ error: "Monitor not found." }, { status: 404 });
  const days = entitlementsFor(user.plan).historyDays;
  const since = Math.max(m.created_at - DAY, Date.now() - days * DAY);
  const months = uptimeByMonth(m.id, since).map((r) => ({ month: r.month, uptime: r.total ? Math.round((r.ok / r.total) * 100_000) / 1000 : null, avgMs: r.avgMs }));
  return Response.json({ historyDays: days, months });
}
