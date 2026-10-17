import { currentUser, sameOrigin } from "@/lib/auth";
import { listChannels, removeChannel, setChannelEnabled } from "@/lib/channels";
import { removeRemoteWebhook } from "@/lib/oauth";

/** Switches a channel on or off. Off keeps it connected but sends it nothing. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/integrations/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  let body: { enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") return Response.json({ error: "Invalid request." }, { status: 400 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !setChannelEnabled(id, user.id, body.enabled)) {
    return Response.json({ error: "Channel not found." }, { status: 404 });
  }
  return Response.json({ channels: listChannels(user.id) });
}

/** Disconnects a channel. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/integrations/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const id = Number((await ctx.params).id);
  const removed = Number.isInteger(id) ? removeChannel(id, user.id) : null;
  if (!removed) return Response.json({ error: "Channel not found." }, { status: 404 });
  // Only webhooks we created by sign-in are deleted on Discord's side; a pasted one belongs to the person.
  if (removed.via === "oauth" && removed.url) await removeRemoteWebhook(removed.kind, removed.url);
  return Response.json({ channels: listChannels(user.id) });
}
