import Stripe from "stripe";
import { db } from "./db";
import type { PlanId } from "./entitlements";

// Paying for a plan. Stripe takes the payment; all it does here is keep users.plan right. The plan only ever changes
// in applySubscription, which the signed webhook calls, never because a browser says it paid.

/** The plans that can be bought, and the env var holding each one's Stripe price id. Free needs no payment. */
const PRICE_ENV = { starter: "STRIPE_PRICE_STARTER", pro: "STRIPE_PRICE_PRO" } as const satisfies Partial<Record<PlanId, string>>;
export type PaidPlanId = keyof typeof PRICE_ENV;

export function isPaidPlan(value: unknown): value is PaidPlanId {
  return typeof value === "string" && Object.hasOwn(PRICE_ENV, value);
}

export function priceIdFor(plan: PaidPlanId): string | undefined {
  return process.env[PRICE_ENV[plan]]?.trim() || undefined;
}

export function planForPrice(priceId: string | undefined): PaidPlanId | null {
  if (!priceId) return null;
  return (Object.keys(PRICE_ENV) as PaidPlanId[]).find((plan) => priceIdFor(plan) === priceId) ?? null;
}

/** False until the Stripe key is in the environment, so the site can say so instead of failing. */
export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

let client: Stripe | undefined;
export function stripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
  return client;
}

/** Where Stripe sends people back to: APP_URL on the server, the address they're on while developing. */
export function appOrigin(request: Request): string {
  return process.env.APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
}

interface BillingRow {
  customerId: string | null;
  subscriptionId: string | null;
}

export function billingFor(userId: number): BillingRow {
  const row = db().prepare("SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?").get(userId) as
    | { stripe_customer_id: string | null; stripe_subscription_id: string | null }
    | undefined;
  return { customerId: row?.stripe_customer_id ?? null, subscriptionId: row?.stripe_subscription_id ?? null };
}

/** The Stripe customer for an account, made the first time they check out. */
export async function ensureCustomer(userId: number, email: string): Promise<string> {
  const existing = billingFor(userId).customerId;
  if (existing) return existing;
  const customer = await stripe().customers.create({ email, metadata: { userId: String(userId) } });
  db().prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL").run(customer.id, userId);
  // If two checkouts raced, the first customer saved wins and is the one to use.
  return billingFor(userId).customerId ?? customer.id;
}

const customerIdOf = (customer: Stripe.Subscription["customer"]) => (typeof customer === "string" ? customer : customer.id);

/**
 * Makes an account's plan match a subscription Stripe reported. A subscription that is paid (or paying, or being
 * retried after a failed card) gives the plan its price belongs to; one that has ended or never got paid gives Free.
 * Safe to run again with the same event, which Stripe does when it retries.
 */
export function applySubscription(subscription: Stripe.Subscription): void {
  const customerId = customerIdOf(subscription.customer);
  const user = db().prepare("SELECT id, stripe_subscription_id FROM users WHERE stripe_customer_id = ?").get(customerId) as
    | { id: number; stripe_subscription_id: string | null }
    | undefined;
  if (!user) return;

  const live = ["active", "trialing", "past_due"].includes(subscription.status);
  const plan = live ? planForPrice(subscription.items.data[0]?.price.id) : null;

  if (plan) {
    db().prepare("UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE id = ?").run(plan, subscription.id, user.id);
  } else if (!live && (user.stripe_subscription_id === null || user.stripe_subscription_id === subscription.id)) {
    // Only the subscription we're tracking can end the plan, so an old one finishing late doesn't undo a newer purchase.
    db().prepare("UPDATE users SET plan = 'free', stripe_subscription_id = NULL WHERE id = ?").run(user.id);
  }
}
