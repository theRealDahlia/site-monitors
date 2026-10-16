import { currentUser, sameOrigin } from "@/lib/auth";
import { listChannels, sendToChannel } from "@/lib/channels";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

/** Sends a test message to one channel, so a user can check it still works. */
export async function POST(request: Request, ctx: RouteContext<"/api/integrations/[id]/test">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).integrations) {
    return Response.json({ error: "Slack and Discord alerts are part of the Starter plan.", code: "plan_required" }, { status: 403 });
  }
  if (!rateLimit(`channel-test:${user.id}`, 10, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many test messages. Try again in a few minutes." }, { status: 429 });
  }

  const id = Number((await ctx.params).id);
  const result = Number.isInteger(id)
    ? await sendToChannel(id, user.id, {
        subject: "Test alert from Site Monitors",
        body: "If you can read this, alerts for your watched sites will arrive in this channel.",
        kind: "test",
      })
    : null;
  if (!result) return Response.json({ error: "Channel not found." }, { status: 404 });
  return Response.json({ ok: result.ok, error: result.error, channels: listChannels(user.id) });
}
