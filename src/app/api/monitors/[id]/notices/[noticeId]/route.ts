import { currentUser, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getMonitor, getMonitorWithOwner } from "@/lib/monitors-db";
import { noticeMessage, notifySubscribers } from "@/lib/status-subscribers";
import { rateLimit } from "@/lib/rate-limit";
import { deleteNotice, finishMaintenance, updateIncident } from "@/lib/status-notices";

type Ctx = RouteContext<"/api/monitors/[id]/notices/[noticeId]">;

async function ids(request: Request, ctx: Ctx) {
  const user = currentUser(request);
  if (!user) return { response: Response.json({ error: "Log in first." }, { status: 401 }) };
  const { id: rawId, noticeId: rawNotice } = await ctx.params;
  const id = Number(rawId);
  const noticeId = Number(rawNotice);
  if (!Number.isInteger(id) || !Number.isInteger(noticeId) || !getMonitor(id, user.id)) {
    return { response: Response.json({ error: "Not found." }, { status: 404 }) };
  }
  return { user, id, noticeId };
}

/**
 * Changes an incident or maintenance: `{ action: "update", state, message }` adds to an incident's timeline;
 * `{ action: "finish" }` ends maintenance that's under way, or cancels it before it starts.
 */
export async function POST(request: Request, ctx: Ctx) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const r = await ids(request, ctx);
  if ("response" in r) return r.response;
  if (!entitlementsFor(r.user.plan).statusPages) {
    return Response.json({ error: "Incidents and maintenance are part of the Starter plan.", code: "plan_required" }, { status: 403 });
  }
  if (!rateLimit(`notices:${r.user.id}`, 60, 60 * 60 * 1000)) return Response.json({ error: "Too many posts. Try again later." }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const result =
    body?.action === "finish" ? finishMaintenance(r.user.id, r.id, r.noticeId) : body?.action === "update" ? updateIncident(r.user.id, r.id, r.noticeId, body) : null;
  if (!result) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  const monitor = getMonitorWithOwner(r.id);
  if (monitor) {
    const message = noticeMessage(result.value, body?.action === "finish" ? "finished" : "updated");
    notifySubscribers(monitor, message).catch((err) => console.error("subscriber notice failed", err));
  }
  return Response.json({ notice: result.value });
}

/** Removes an incident or maintenance, and its timeline, from the status page. Allowed on any plan. */
export async function DELETE(request: Request, ctx: Ctx) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const r = await ids(request, ctx);
  if ("response" in r) return r.response;
  if (!deleteNotice(r.user.id, r.id, r.noticeId)) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
