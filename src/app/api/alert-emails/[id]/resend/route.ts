import { MAX_EXTRA_EMAILS, listRecipients, renewConfirmation, sendConfirmationLink } from "@/lib/alert-emails";
import { currentUser, sameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/** Sends a fresh confirmation link to an address that hasn't been confirmed yet. */
export async function POST(request: Request, ctx: RouteContext<"/api/alert-emails/[id]/resend">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!rateLimit(`alert-email-add:${user.id}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many confirmation emails. Try again later." }, { status: 429 });
  }

  const id = Number((await ctx.params).id);
  const renewed = Number.isInteger(id) ? renewConfirmation(id, user.id) : { ok: false as const, error: "Address not found.", status: 404 };
  if (!renewed.ok) return Response.json({ error: renewed.error }, { status: renewed.status });
  try {
    await sendConfirmationLink(user.email, renewed.email, renewed.token);
  } catch (err) {
    console.error("alert email confirmation resend failed", err);
    return Response.json({ error: "We couldn't send the confirmation email. Try again in a moment." }, { status: 502 });
  }
  return Response.json({ ...listRecipients(user.id), max: MAX_EXTRA_EMAILS });
}
