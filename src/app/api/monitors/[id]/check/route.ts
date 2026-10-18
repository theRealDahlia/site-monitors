import { currentUser, sameOrigin } from "@/lib/auth";
import { ALL_CHECKS, runChecks } from "@/lib/monitor-runner";
import { entitlementsFor } from "@/lib/entitlements";
import { monitorView } from "@/lib/monitor-view";
import { getMonitor, updateMonitor } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";

const COOLDOWN_MS = 30_000;

/** "Check now": runs every check for one monitor immediately. */
export async function POST(request: Request, ctx: RouteContext<"/api/monitors/[id]/check">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const id = Number((await ctx.params).id);
  const monitor = Number.isInteger(id) ? getMonitor(id, user.id) : undefined;
  if (!monitor) return Response.json({ error: "Monitor not found." }, { status: 404 });

  const wait = COOLDOWN_MS - (Date.now() - (monitor.last_manual_check_at ?? 0));
  if (wait > 0) {
    return Response.json({ error: `Checked just now. Try again in ${Math.ceil(wait / 1000)}s.` }, { status: 429 });
  }
  if (!rateLimit(`monitor-check:${user.id}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many manual checks. Try again later." }, { status: 429 });
  }

  updateMonitor(monitor.id, { last_manual_check_at: Date.now() });
  await runChecks(monitor.id, ALL_CHECKS);
  return Response.json({ monitor: monitorView(getMonitor(id, user.id)!, entitlementsFor(user.plan)) });
}
