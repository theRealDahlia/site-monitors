import { currentUser } from "@/lib/auth";
import { MAX_CHANNELS, listChannels } from "@/lib/channels";
import { entitlementsFor } from "@/lib/entitlements";
import { SERVICES, clientConfig } from "@/lib/oauth";

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const plan = entitlementsFor(user.plan);
  return Response.json({
    allowed: plan.integrations,
    plan: plan.name,
    max: MAX_CHANNELS,
    // Whether the Slack and Discord apps are set up on this server yet (never the credentials themselves).
    available: Object.fromEntries(SERVICES.map((s) => [s, clientConfig(s) !== null])),
    // A channel can outlive a downgrade; it just stops receiving alerts until the plan includes them again.
    channels: listChannels(user.id),
  });
}
