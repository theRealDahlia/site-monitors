import { currentUser, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { MAX_PHONES, addPhone, listPhones, phonesConfigured, usage } from "@/lib/phones";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const ent = entitlementsFor(user.plan);
  return Response.json({
    allowed: ent.smsPerMonth > 0 || ent.callsPerMonth > 0,
    configured: phonesConfigured(),
    max: MAX_PHONES,
    limits: { sms: ent.smsPerMonth, calls: ent.callsPerMonth },
    used: usage(user.id),
    phones: listPhones(user.id),
  });
}

/** Adds a phone number for outage alerts, and texts it a code to confirm it. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const ent = entitlementsFor(user.plan);
  if (!ent.smsPerMonth && !ent.callsPerMonth) return Response.json({ error: "Text and call alerts are part of the Pro plan.", code: "plan_required" }, { status: 403 });
  if (!phonesConfigured()) return Response.json({ error: "Text messages aren't set up on this server yet." }, { status: 503 });
  // Each code is a text we pay for, so adding numbers is limited.
  if (!rateLimit(`phone-add:${user.id}`, 5, 24 * 60 * 60 * 1000)) return Response.json({ error: "Too many numbers added today. Try again tomorrow." }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const r = await addPhone(user.id, body ?? {});
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ phone: r.phone }, { status: 201 });
}
