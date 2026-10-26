import { currentUser, sameOrigin } from "@/lib/auth";
import { parseTargets, setMonitorTargets } from "@/lib/alert-targets";
import { assignMonitors, getClient } from "@/lib/clients";
import { entitlementsFor } from "@/lib/entitlements";
import { deleteMonitor } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";

const MAX_IDS = 500;

/**
 * Changes several monitors at once: `{ ids, action: "client", clientId }` (null for none), `{ ids, action: "alerts",
 * targets }` (null for everyone) or `{ ids, action: "delete" }`. Only the account's own monitors are touched.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const ent = entitlementsFor(user.plan);
  if (!ent.bulkTools) return Response.json({ error: "Changing many monitors at once is part of the Agency plan.", code: "plan_required" }, { status: 403 });
  if (!rateLimit(`monitor-bulk:${user.id}`, 60, 60 * 60 * 1000)) return Response.json({ error: "Too many changes. Try again later." }, { status: 429 });

  let body: { ids?: unknown; action?: unknown; clientId?: unknown; targets?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const ids = Array.isArray(body?.ids) && body.ids.every((i) => Number.isInteger(i)) ? [...new Set(body.ids as number[])] : null;
  if (!ids || ids.length === 0 || ids.length > MAX_IDS) return Response.json({ error: "Choose some monitors first." }, { status: 400 });

  if (body.action === "client") {
    const clientId = body.clientId === null ? null : Number(body.clientId);
    if (clientId !== null && (!Number.isInteger(clientId) || !getClient(clientId, user.id))) return Response.json({ error: "Client not found." }, { status: 404 });
    return Response.json({ changed: assignMonitors(user.id, ids, clientId) });
  }

  if (body.action === "alerts") {
    // Going back to "everyone" is always allowed, including after a downgrade.
    if (body.targets !== null && !ent.alertRouting) return Response.json({ error: "Choosing who gets each monitor's alerts is part of the Starter plan.", code: "plan_required" }, { status: 403 });
    const parsed = parseTargets(user.id, body.targets);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    let changed = 0;
    for (const id of ids) if (setMonitorTargets(id, user.id, parsed.value)) changed++;
    return Response.json({ changed });
  }

  if (body.action === "delete") {
    // No removal email per site: a hundred of them at once would only flood the inbox.
    let changed = 0;
    for (const id of ids) if (deleteMonitor(id, user.id)) changed++;
    return Response.json({ changed });
  }

  return Response.json({ error: "Choose what to do." }, { status: 400 });
}
