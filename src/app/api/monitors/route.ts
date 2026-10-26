import { currentUser, sameOrigin } from "@/lib/auth";
import { assignMonitors, clientView, getClient, listClients } from "@/lib/clients";
import { CheckError } from "@/lib/hostname";
import { KIND_LABEL, isMonitorKind, parseMonitorRequest } from "@/lib/monitor-kinds";
import { ALL_CHECKS, runChecks } from "@/lib/monitor-runner";
import { entitlementsFor } from "@/lib/entitlements";
import { monitorView } from "@/lib/monitor-view";
import { countMonitors, getMonitor, insertMonitor, listMonitors, recentEvents } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";
import { sendWatchConfirmation } from "@/lib/watch-email";

const HOUR_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in to see your monitors." }, { status: 401 });

  const plan = entitlementsFor(user.plan);
  return Response.json({
    email: user.email,
    plan: { id: user.plan, name: plan.name, statusPages: plan.statusPages, integrations: plan.integrations, aiVisibility: plan.aiVisibility, monitorKinds: plan.monitorKinds, clients: plan.clients, bulkTools: plan.bulkTools },
    clients: listClients(user.id).map(clientView),
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });

  const kind = body.kind === undefined ? "site" : body.kind;
  if (!isMonitorKind(kind)) return Response.json({ error: "Choose what to monitor." }, { status: 400 });
  const plan = entitlementsFor(user.plan);
  if (!plan.monitorKinds.includes(kind)) {
    return Response.json({ error: `${KIND_LABEL[kind]} monitors are part of the Starter plan.`, code: "plan_required" }, { status: 403 });
  }

  try {
    const { host, config } = await parseMonitorRequest(kind, body);

    if (countMonitors(user.id) >= plan.maxMonitors) {
      return Response.json(
        { error: `${plan.name} accounts can have up to ${plan.maxMonitors} monitors. Remove one to add another.`, code: "monitor_limit" },
        { status: 403 },
      );
    }
    // An optional client (Agency). Checked before anything is saved.
    let clientId: number | null = null;
    if (body.clientId !== undefined && body.clientId !== null && body.clientId !== "") {
      clientId = Number(body.clientId);
      if (!plan.clients || !Number.isInteger(clientId) || !getClient(clientId, user.id)) return Response.json({ error: "Choose one of your clients." }, { status: 400 });
    }
    const id = insertMonitor(user.id, host, Date.now(), config);
    if (id === null) return Response.json({ error: `You already have a monitor for ${host}.` }, { status: 409 });
    if (clientId !== null) assignMonitors(user.id, [id], clientId);

    // Confirm by email first, so it arrives before any alert the first checks might raise. A failed
    // send must never undo the monitor: it exists either way, and the dashboard shows it.
    try {
      await sendWatchConfirmation({ monitorId: id, userId: user.id, host, createdAt: Date.now(), uptimeEveryMs: plan.uptimeEveryMs, plan: user.plan, config });
    } catch (err) {
      console.error(`watch confirmation for ${host} failed`, err);
    }

    // Run every check now so the dashboard has real results straight away. A heartbeat has nothing to check until it pings.
    if (kind !== "heartbeat") await runChecks(id, ALL_CHECKS);
    return Response.json({ monitor: monitorView(getMonitor(id, user.id)!, plan) }, { status: 201 });
  } catch (err) {
    if (err instanceof CheckError) return Response.json({ error: err.message }, { status: err.httpStatus });
    console.error("create monitor failed", err);
    return Response.json({ error: "Something went wrong adding that monitor." }, { status: 500 });
  }
}
