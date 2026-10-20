import { currentUser } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getMonitor } from "@/lib/monitors-db";
import { listSubscribers } from "@/lib/status-subscribers";

/** Who has subscribed to a monitor's status page, for its owner. */
export async function GET(request: Request, ctx: RouteContext<"/api/monitors/[id]/subscribers">) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !getMonitor(id, user.id)) return Response.json({ error: "Monitor not found." }, { status: 404 });
  return Response.json({ allowed: entitlementsFor(user.plan).statusSubscribers, subscribers: listSubscribers(id) });
}
