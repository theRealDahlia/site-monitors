import { currentUser, sameOrigin } from "@/lib/auth";
import { parseTargets } from "@/lib/alert-targets";
import { entitlementsFor } from "@/lib/entitlements";
import { ESCALATE_AFTER, getPolicy, setPolicy } from "@/lib/escalation";

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json({ allowed: entitlementsFor(user.plan).escalation, policy: getPolicy(user.id), afterChoices: ESCALATE_AFTER });
}

/** Saves the account's escalation rule: `{ enabled, afterMs, targets }`. Switching it off is always allowed. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  let body: { enabled?: unknown; afterMs?: unknown; targets?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const enabled = body?.enabled === true;
  if (enabled && !entitlementsFor(user.plan).escalation) {
    return Response.json({ error: "Escalation is part of the Pro plan.", code: "plan_required" }, { status: 403 });
  }
  const afterMs = Number(body?.afterMs);
  if (!ESCALATE_AFTER.includes(afterMs)) return Response.json({ error: "Choose how long to wait." }, { status: 400 });
  const targets = parseTargets(user.id, body?.targets ?? []);
  if (!targets.ok && enabled) return Response.json({ error: targets.error }, { status: 400 });
  const list = targets.ok ? (targets.value ?? []) : [];
  if (enabled && list.length === 0) return Response.json({ error: "Choose who to tell." }, { status: 400 });
  setPolicy(user.id, { enabled, afterMs, targets: list });
  return Response.json({ policy: getPolicy(user.id) });
}
