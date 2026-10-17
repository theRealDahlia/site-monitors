import { MAX_EXTRA_EMAILS, listRecipients, removeAlertEmail, setAccountAlerts, setAlertEmailEnabled } from "@/lib/alert-emails";
import { currentUser, sameOrigin } from "@/lib/auth";

/** Switches an address on or off. `account` is the account's own address; anything else is an added one's id. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/alert-emails/[id]">) {
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

  const { id } = await ctx.params;
  if (id === "account") setAccountAlerts(user.id, body.enabled);
  else if (!Number.isInteger(Number(id)) || !setAlertEmailEnabled(Number(id), user.id, body.enabled)) {
    return Response.json({ error: "Address not found." }, { status: 404 });
  }
  return Response.json({ ...listRecipients(user.id), max: MAX_EXTRA_EMAILS });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/alert-emails/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !removeAlertEmail(id, user.id)) return Response.json({ error: "Address not found." }, { status: 404 });
  return Response.json({ ...listRecipients(user.id), max: MAX_EXTRA_EMAILS });
}
