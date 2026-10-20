import { normalizeEmail, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { getPublicMonitor } from "@/lib/monitors-db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { SLUG_PATTERN } from "@/lib/status-page";
import { subscribe } from "@/lib/status-subscribers";

const DONE = { ok: true, message: "Check your inbox: we've sent a link to confirm." };

/** A visitor asks for email updates about a status page. Public, so it's rate limited and answers vaguely. */
export async function POST(request: Request, ctx: RouteContext<"/api/status/[slug]/subscribe">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const { slug } = await ctx.params;
  const monitor = SLUG_PATTERN.test(slug) ? getPublicMonitor(slug) : undefined;
  if (!monitor || !entitlementsFor(monitor.owner_plan).statusPages) return Response.json({ error: "Status page not found." }, { status: 404 });
  if (!entitlementsFor(monitor.owner_plan).statusSubscribers) return Response.json({ error: "This page doesn't offer email updates." }, { status: 403 });
  if (!rateLimit(`subscribe-ip:${clientIp(request)}`, 10, 60 * 60 * 1000) || !rateLimit(`subscribe-page:${monitor.id}`, 200, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizeEmail(body?.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const r = await subscribe(monitor, email);
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    return Response.json(DONE);
  } catch (err) {
    console.error("status subscription email failed", err);
    return Response.json({ error: "We couldn't send the confirmation email. Try again in a moment." }, { status: 502 });
  }
}
