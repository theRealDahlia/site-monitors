import { currentUser, sameOrigin } from "@/lib/auth";
import { acknowledge } from "@/lib/escalation";
import { getMonitor } from "@/lib/monitors-db";
import { sendAckNotice } from "@/lib/watch-email";

/** Acknowledges a monitor's current outage from its page in the dashboard. */
export async function POST(request: Request, ctx: RouteContext<"/api/monitors/[id]/ack">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  const m = Number.isInteger(id) ? getMonitor(id, user.id) : undefined;
  if (!m) return Response.json({ error: "Monitor not found." }, { status: 404 });
  const r = acknowledge(m.id, null);
  if (r === "over") return Response.json({ error: "It's not down any more." }, { status: 409 });
  if (r === "acknowledged") await sendAckNotice({ monitor: m, plan: user.plan, by: user.actor.email });
  return Response.json({ ok: true });
}
