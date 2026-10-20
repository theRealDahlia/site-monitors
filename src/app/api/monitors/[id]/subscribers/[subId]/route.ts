import { currentUser, sameOrigin } from "@/lib/auth";
import { getMonitor } from "@/lib/monitors-db";
import { removeSubscriber } from "@/lib/status-subscribers";

/** The owner removes a subscriber from their status page. Allowed on any plan. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/monitors/[id]/subscribers/[subId]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const { id: rawId, subId: rawSub } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || !getMonitor(id, user.id) || !removeSubscriber(id, Number(rawSub))) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
