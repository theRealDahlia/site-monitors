import { currentUser, sameOrigin } from "@/lib/auth";
import { acknowledge } from "@/lib/escalation";
import { addEvent, getMonitor } from "@/lib/monitors-db";

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
  if (r === "acknowledged") addEvent({ userId: user.id, monitorId: m.id, host: m.host, kind: "acknowledged", message: `Outage on ${m.host} acknowledged by ${user.actor.email}`, emailed: false });
  return Response.json({ ok: true });
}
