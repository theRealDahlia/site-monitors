import type Stripe from "stripe";
import { applySubscription, stripe } from "@/lib/billing";

/**
 * Stripe's messages about payments. This is the only thing that changes a plan after a purchase, so it first checks
 * the message really came from Stripe: the signature is over the exact bytes sent, which is why the body is read as text.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Not configured.", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Bad signature.", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        applySubscription(await stripe().subscriptions.retrieve(id));
      }
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      applySubscription(event.data.object);
    }
  } catch (error) {
    // A 500 makes Stripe send the event again later.
    console.error("Stripe webhook failed:", error);
    return new Response("Failed.", { status: 500 });
  }
  return new Response("ok");
}
