import { currentUser, sameOrigin } from "@/lib/auth";
import { billingConfigured, isPaidPlan } from "@/lib/billing";
import { changePlan, quoteChange } from "@/lib/plan-change";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Moves a paying account to another paid plan right away, or cancels it back to Free (`plan: "free"`): `{ plan }` returns what it would cost and refund;
 * `{ plan, confirm: true, expect: { refundCents, chargeCents } }` does it, if those are still the amounts.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role !== "owner") return Response.json({ error: "Only the account owner can change the plan." }, { status: 403 });
  if (!billingConfigured()) return Response.json({ error: "Payments aren't set up yet. Please try again later." }, { status: 503 });

  let body: { plan?: unknown; confirm?: unknown; expect?: { refundCents?: unknown; chargeCents?: unknown } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  // "free" means cancelling the subscription now.
  const plan = body?.plan === "free" ? "free" : isPaidPlan(body?.plan) ? body.plan : null;
  if (!plan) return Response.json({ error: "Choose a plan." }, { status: 400 });
  if (!rateLimit(`plan-change:${user.id}`, 20, 60 * 60 * 1000)) return Response.json({ error: "Too many plan changes. Try again later." }, { status: 429 });

  try {
    if (body.confirm !== true) {
      const result = await quoteChange(user.id, plan);
      return result.ok ? Response.json({ quote: result.quote }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: result.error }, { status: result.status });
    }
    const { refundCents, chargeCents } = body.expect ?? {};
    if (!Number.isInteger(refundCents) || !Number.isInteger(chargeCents)) return Response.json({ error: "Invalid request." }, { status: 400 });
    const result = await changePlan(user.id, plan, { refundCents: refundCents as number, chargeCents: chargeCents as number });
    if (!result.ok) return Response.json({ error: result.error, ...("quote" in result ? { quote: result.quote } : {}) }, { status: result.status });
    return Response.json({ ok: true, plan, refundedCents: result.refundedCents, chargedCents: result.chargedCents, refundProblem: result.refundProblem }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Plan change request failed:", error);
    return Response.json({ error: "Couldn't reach our payment provider. Nothing was changed. Please try again." }, { status: 502 });
  }
}
