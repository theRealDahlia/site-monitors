import { currentUser, sameOrigin } from "@/lib/auth";
import { alertPhones, listPhones } from "@/lib/phones";
import { rateLimit } from "@/lib/rate-limit";

/** Sends a test alert to one confirmed number. It counts against the month's limit, like a real one. */
export async function POST(request: Request, ctx: RouteContext<"/api/phones/[id]/test">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  const phone = listPhones(user.id).find((p) => p.id === id);
  if (!phone) return Response.json({ error: "Not found." }, { status: 404 });
  if (!phone.verified) return Response.json({ error: "Confirm the number first." }, { status: 409 });
  if (!rateLimit(`phone-test:${user.id}`, 5, 60 * 60 * 1000)) return Response.json({ error: "Too many tests. Try again later." }, { status: 429 });
  const r = await alertPhones(user.id, user.plan, new Set([`phone:${id}`]), {
    text: "Site Monitors test: this is how outage alerts will arrive.",
    say: "This is a Site Monitors test call. This is how outage alerts will sound.",
  });
  if (r.skipped && !r.sent) return Response.json({ error: "This month's limit for texts and calls is reached." }, { status: 429 });
  if (!r.sent) return Response.json({ error: "We couldn't reach that number. Try again in a moment." }, { status: 502 });
  return Response.json({ ok: true });
}
