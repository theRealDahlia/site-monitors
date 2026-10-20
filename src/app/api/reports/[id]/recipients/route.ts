import { currentUser, normalizeEmail, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";
import { addRecipient } from "@/lib/reports";

/** Adds someone to a report. They're emailed a link to confirm, and get nothing until they do. */
export async function POST(request: Request, ctx: RouteContext<"/api/reports/[id]/recipients">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).reports) return Response.json({ error: "Client reports are part of the Pro plan.", code: "plan_required" }, { status: 403 });
  if (!rateLimit(`report-recipient:${user.id}`, 30, 24 * 60 * 60 * 1000)) return Response.json({ error: "Too many invitations today. Try again tomorrow." }, { status: 429 });
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizeEmail(body?.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const r = await addRecipient(user.id, user.email, Number((await ctx.params).id), email);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ report: r.value }, { status: 201 });
}
