import { currentUser, sameOrigin } from "@/lib/auth";
import { appOrigin, billingConfigured, billingFor, stripe } from "@/lib/billing";

/** Opens Stripe's billing portal, where someone changes plan, updates their card, downloads invoices or cancels. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role !== "owner") return Response.json({ error: "Only the account owner can manage billing." }, { status: 403 });
  if (!billingConfigured()) return Response.json({ error: "Payments aren't set up yet. Please try again later." }, { status: 503 });
  const { customerId } = billingFor(user.id);
  if (!customerId) return Response.json({ error: "You don't have any billing to manage yet." }, { status: 404 });

  try {
    const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${appOrigin(request)}/dashboard/plans` });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal failed:", error);
    return Response.json({ error: "Couldn't open billing. Please try again." }, { status: 502 });
  }
}
