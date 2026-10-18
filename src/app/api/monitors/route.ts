import { currentUser, sameOrigin } from "@/lib/auth";
import { CheckError, parseHostname } from "@/lib/hostname";
import { ALL_CHECKS, runChecks } from "@/lib/monitor-runner";
import { entitlementsFor } from "@/lib/entitlements";
import { monitorView } from "@/lib/monitor-view";
import { countMonitors, getMonitor, insertMonitor, listMonitors, recentEvents } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";
import { sendWatchConfirmation } from "@/lib/watch-email";
import { resolvePublicAddress } from "@/lib/ssl-check";

const HOUR_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in to see your monitors." }, { status: 401 });

  const plan = entitlementsFor(user.plan);
  return Response.json({
    email: user.email,
    plan: { id: user.plan, name: plan.name, statusPages: plan.statusPages, integrations: plan.integrations, aiVisibility: plan.aiVisibility },
    limit: plan.maxMonitors,
    monitors: listMonitors(user.id).map((m) => monitorView(m, plan)),
    events: recentEvents(user.id, 50).map((e) => ({
      id: e.id,
      host: e.host,
      kind: e.kind,
      message: e.message,
      details: e.details,
      emailed: !!e.emailed,
      at: e.created_at,
    })),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in to add a monitor." }, { status: 401 });
  if (!rateLimit(`monitor-add:${user.id}`, entitlementsFor(user.plan).addsPerHour, HOUR_MS)) {
    return Response.json({ error: "You're adding monitors too quickly. Try again later." }, { status: 429 });
  }

  let body: { host?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const host = parseHostname(typeof body.host === "string" ? body.host : "", { ignorePort: true });
    await resolvePublicAddress(host); // catches typos and private addresses before we save anything

    const plan = entitlementsFor(user.plan);
    if (countMonitors(user.id) >= plan.maxMonitors) {
      return Response.json(
        { error: `${plan.name} accounts can watch up to ${plan.maxMonitors} sites. Remove one to add another.`, code: "monitor_limit" },
        { status: 403 },
      );
    }
    const id = insertMonitor(user.id, host, Date.now());
    if (id === null) return Response.json({ error: `You're already watching ${host}.` }, { status: 409 });

    // Confirm by email first, so it arrives before any alert the first checks might raise. A failed
    // send must never undo the monitor: it exists either way, and the dashboard shows it.
    try {
      await sendWatchConfirmation({ monitorId: id, userId: user.id, host, createdAt: Date.now(), uptimeEveryMs: plan.uptimeEveryMs, plan: user.plan });
    } catch (err) {
      console.error(`watch confirmation for ${host} failed`, err);
    }

    // Run every check now so the dashboard has real results straight away.
    await runChecks(id, ALL_CHECKS);
    return Response.json({ monitor: monitorView(getMonitor(id, user.id)!, plan) }, { status: 201 });
  } catch (err) {
    if (err instanceof CheckError) return Response.json({ error: err.message }, { status: err.httpStatus });
    console.error("create monitor failed", err);
    return Response.json({ error: "Something went wrong adding that site." }, { status: 500 });
  }
}
