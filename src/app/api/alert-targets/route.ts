import { currentUser } from "@/lib/auth";
import { listTargets } from "@/lib/alert-targets";
import { entitlementsFor } from "@/lib/entitlements";

/** Every place this account's alerts can go, for choosing a monitor's destinations or the escalation contacts. */
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const ent = entitlementsFor(user.plan);
  return Response.json({ routing: ent.alertRouting, escalation: ent.escalation, targets: listTargets(user.id) });
}
