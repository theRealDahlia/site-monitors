import { currentUser, sameOrigin } from "@/lib/auth";
import { MAX_CHANNELS, addChannel, countChannels, listChannels, removeChannel, sendToChannel } from "@/lib/channels";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";
import { WEBHOOK_HELP, parseWebhookUrl } from "@/lib/webhooks";

const NOT_ON_PLAN = {
  error: "Slack and Discord alerts are part of the Starter plan.",
  code: "plan_required",
};

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const plan = entitlementsFor(user.plan);
  return Response.json({
    allowed: plan.integrations,
    plan: plan.name,
    max: MAX_CHANNELS,
    // A channel can outlive a downgrade; it just stops receiving alerts until the plan includes them again.
    channels: listChannels(user.id),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).integrations) return Response.json(NOT_ON_PLAN, { status: 403 });
  if (!rateLimit(`channel-add:${user.id}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "You're adding channels too quickly. Try again later." }, { status: 429 });
  }

  let body: { kind?: unknown; name?: unknown; url?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const kind = body.kind === "slack" || body.kind === "discord" ? body.kind : null;
  if (!kind) return Response.json({ error: "Choose Slack or Discord." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return Response.json({ error: "Give this channel a name, like #alerts." }, { status: 400 });
  const parsed = typeof body.url === "string" ? parseWebhookUrl(kind, body.url) : null;
  if (!parsed) return Response.json({ error: WEBHOOK_HELP[kind] }, { status: 400 });
  if (countChannels(user.id) >= MAX_CHANNELS) {
    return Response.json({ error: `You can connect up to ${MAX_CHANNELS} channels. Remove one to add another.` }, { status: 403 });
  }

  const id = addChannel(user.id, kind, name, parsed.href);

  // Only keep a channel that works: post a test message now, and undo the save if it isn't accepted.
  const sent = await sendToChannel(id, user.id, {
    subject: "Connected to Site Monitors",
    body: "This channel is connected. You'll get alerts about your watched sites here.",
    kind: "test",
  });
  if (!sent?.ok) {
    removeChannel(id, user.id);
    return Response.json({ error: sent?.error ?? "Couldn't send a test message to that address." }, { status: 400 });
  }
  return Response.json({ channels: listChannels(user.id) }, { status: 201 });
}
