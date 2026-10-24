import { currentUser } from "@/lib/auth";
import { billingConfigured, billingFor } from "@/lib/billing";

/** What the Plans page needs: whether payment is set up, whether this person can manage the plan, and whether they already pay. */
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const { customerId, subscriptionId } = billingFor(user.id);
  return Response.json(
    { configured: billingConfigured(), canManage: user.role === "owner", hasSubscription: Boolean(subscriptionId), hasCustomer: Boolean(customerId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
