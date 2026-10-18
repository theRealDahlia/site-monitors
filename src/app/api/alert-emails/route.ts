import { addAlertEmail, recipientsView, removeAlertEmail, sendConfirmationLink } from "@/lib/alert-emails";
import { currentUser, normalizeEmail, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

/** The addresses alert emails go to. Every plan has this. */
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json(recipientsView(user.id, user.plan));
}

/** Adds an address and emails it a link to confirm. It gets nothing else until that link is used. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  // Each add sends an email to someone else, so keep it slow.
  if (!rateLimit(`alert-email-add:${user.id}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "You're adding addresses too quickly. Try again later." }, { status: 429 });
  }

  const added = addAlertEmail(user.id, user.email, email, entitlementsFor(user.plan).maxExtraEmails);
  if (!added.ok) return Response.json({ error: added.error }, { status: added.status });
  try {
    await sendConfirmationLink(user.email, email, added.token);
  } catch (err) {
    console.error("alert email confirmation failed", err);
    removeAlertEmail(added.id, user.id);
    return Response.json({ error: "We couldn't send the confirmation email. Check the address and try again." }, { status: 502 });
  }
  return Response.json(recipientsView(user.id, user.plan), { status: 201 });
}
