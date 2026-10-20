import { currentUser, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getMonitor, getMonitorWithOwner } from "@/lib/monitors-db";
import { noticeMessage, notifySubscribers } from "@/lib/status-subscribers";
import { rateLimit } from "@/lib/rate-limit";
import { createIncident, createMaintenance, listNotices } from "@/lib/status-notices";

const PLAN_REQUIRED = { error: "Incidents and maintenance are part of the Starter plan.", code: "plan_required" };

/** A monitor's incidents and maintenance, for its owner. */
export async function GET(request: Request, ctx: RouteContext<"/api/monitors/[id]/notices">) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !getMonitor(id, user.id)) return Response.json({ error: "Monitor not found." }, { status: 404 });
  return Response.json({ allowed: entitlementsFor(user.plan).statusPages, notices: listNotices(id) });
}

/** Reports an incident or schedules maintenance on a monitor's status page. */
export async function POST(request: Request, ctx: RouteContext<"/api/monitors/[id]/notices">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).statusPages) return Response.json(PLAN_REQUIRED, { status: 403 });
  if (!rateLimit(`notices:${user.id}`, 60, 60 * 60 * 1000)) return Response.json({ error: "Too many posts. Try again later." }, { status: 429 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !getMonitor(id, user.id)) return Response.json({ error: "Monitor not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });

  const result = body.kind === "maintenance" ? createMaintenance(user.id, id, body) : createIncident(user.id, id, body);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  // Subscribers hear about it in the background; the owner doesn't wait for a few hundred emails.
  const monitor = getMonitorWithOwner(id);
  if (monitor) notifySubscribers(monitor, noticeMessage(result.value, "created")).catch((err) => console.error("subscriber notice failed", err));
  return Response.json({ notice: result.value }, { status: 201 });
}
