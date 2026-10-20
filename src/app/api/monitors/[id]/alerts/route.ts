import { currentUser, sameOrigin } from "@/lib/auth";
import { parseTargets, setMonitorTargets } from "@/lib/alert-targets";
import { entitlementsFor } from "@/lib/entitlements";
import { getMonitor } from "@/lib/monitors-db";

/** Chooses who gets a monitor's alerts: `{ targets: null }` for everyone, or a list of destinations. */
export async function PUT(request: Request, ctx: RouteContext<"/api/monitors/[id]/alerts">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !getMonitor(id, user.id)) return Response.json({ error: "Monitor not found." }, { status: 404 });

  let body: { targets?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  // Going back to "everyone" is always allowed, including after a downgrade.
  if (body?.targets !== null && !entitlementsFor(user.plan).alertRouting) {
    return Response.json({ error: "Choosing who gets each monitor's alerts is part of the Starter plan.", code: "plan_required" }, { status: 403 });
  }
  const parsed = parseTargets(user.id, body?.targets);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  setMonitorTargets(id, user.id, parsed.value);
  return Response.json({ targets: parsed.value });
}
