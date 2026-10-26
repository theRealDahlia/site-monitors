import { currentUser, sameOrigin } from "@/lib/auth";
import { appOrigin, billingConfigured, billingFor, ensureCustomer, isPaidPlan, priceIdFor, stripe } from "@/lib/billing";

/** Starts paying for a plan: `{ plan: "starter" | "pro" | "agency" }`. The response is the Stripe page to send the browser to. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role !== "owner") return Response.json({ error: "Only the account owner can change the plan." }, { status: 403 });

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!isPaidPlan(body?.plan)) return Response.json({ error: "Choose a plan to buy." }, { status: 400 });
  if (!billingConfigured()) return Response.json({ error: "Payments aren't set up yet. Please try again later." }, { status: 503 });
  const price = priceIdFor(body.plan);
  if (!price) return Response.json({ error: "That plan can't be bought yet." }, { status: 503 });
  // Changing plans while subscribed happens in the billing portal, so nobody ends up paying for two at once.
  if (billingFor(user.id).subscriptionId) return Response.json({ error: "You already have a subscription. Use Manage billing to change it.", code: "has_subscription" }, { status: 409 });

  try {
    const origin = appOrigin(request);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: await ensureCustomer(user.id, user.email),
      client_reference_id: String(user.id),
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true, // shows an "Add promotion code" box on Stripe's payment page
      success_url: `${origin}/dashboard/plans?billing=success`,
      cancel_url: `${origin}/dashboard/plans?billing=cancelled`,
    });
    if (!session.url) throw new Error("Stripe returned no checkout address.");
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed:", error);
    return Response.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
