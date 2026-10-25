import type Stripe from "stripe";
import { applySubscription, billingFor, type PaidPlanId, planForPrice, priceIdFor, stripe } from "./billing";
import { unusedRefund } from "./proration";

// Moving between paid plans (up or down), or cancelling to Free. It happens at once:
//   - a new paid plan is charged in full, today, and its monthly period starts today;
//   - the unused days of the old plan are refunded to the card (see unusedRefund for the arithmetic);
//   - cancelling ends the subscription now, charges nothing more, and the account goes to Free.
// Stripe's own proration would put leftover money on the account as credit instead of returning it, so it's switched off
// here and the refund is made explicitly.

export interface Quote {
  fromPlan: PaidPlanId;
  /** "free" means cancelling the subscription. */
  toPlan: PaidPlanId | "free";
  daysTotal: number;
  daysRemaining: number;
  /** What was paid for the current period. */
  paidCents: number;
  /** What goes back to the card. */
  refundCents: number;
  /** What the new plan costs today. */
  chargeCents: number;
  currency: string;
}

export type ChangeError = { ok: false; error: string; status: number };

interface Context {
  subscription: Stripe.Subscription;
  item: Stripe.SubscriptionItem;
  from: PaidPlanId;
  oldInvoice: Stripe.Invoice | null;
  quote: Quote;
}

const fail = (error: string, status = 400): ChangeError => ({ ok: false, error, status });

/** Works out what changing to `to` would do right now, from the current subscription and what was actually paid for it. */
async function prepare(userId: number, to: PaidPlanId | "free"): Promise<({ ok: true } & Context) | ChangeError> {
  const subscriptionId = billingFor(userId).subscriptionId;
  if (!subscriptionId) return fail("You don't have a paid plan to change.", 409);
  const cancelling = to === "free";
  const newPrice = cancelling ? undefined : priceIdFor(to);
  if (!cancelling && !newPrice) return fail("That plan can't be bought yet.", 503);

  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  const from = planForPrice(item?.price.id);
  if (!item || !from) return fail("We couldn't find your current plan. Please contact support.", 409);
  // Cancelling is always allowed, whatever state the subscription is in, so nobody is stuck paying.
  if (!cancelling) {
    if (!["active", "trialing"].includes(subscription.status)) return fail("Your subscription isn't active. Update your card from Manage billing first.", 409);
    if (subscription.cancel_at_period_end || subscription.cancel_at) return fail("Your subscription is set to cancel. Resume it from Manage billing before changing plan.", 409);
    if (from === to) return fail("You're already on that plan.", 409);
  }

  // What was paid for this period: the latest paid invoice whose service period is the current one.
  const invoices = await stripe().invoices.list({ subscription: subscription.id, status: "paid", limit: 5 });
  const oldInvoice = invoices.data.find((inv) => inv.lines.data.some((line) => Math.abs(line.period.start - item.current_period_start) < 120)) ?? null;
  const paidCents = oldInvoice?.amount_paid ?? 0;
  if (!oldInvoice && invoices.data.length > 0 && !cancelling) return fail("We couldn't match your last payment to this billing period, so nothing was changed. Please contact support.", 409);

  const { daysTotal, daysRemaining, refundCents } = unusedRefund(paidCents, item.current_period_start, item.current_period_end, Math.floor(Date.now() / 1000));

  // What the new plan will cost today, including any discount on the subscription.
  let chargeCents = 0;
  if (!cancelling && newPrice) {
    try {
      const preview = await stripe().invoices.createPreview({
        customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        subscription: subscription.id,
        subscription_details: { items: [{ id: item.id, price: newPrice }], billing_cycle_anchor: { type: "now" as const }, proration_behavior: "none" as const },
      });
      chargeCents = preview.total;
    } catch {
      chargeCents = (await stripe().prices.retrieve(newPrice)).unit_amount ?? 0;
    }
  }

  return { ok: true, subscription, item, from, oldInvoice, quote: { fromPlan: from, toPlan: to, daysTotal, daysRemaining, paidCents, refundCents, chargeCents, currency: subscription.currency } };
}

/** What a change would do, without doing it, so the person can agree to the amounts first. */
export async function quoteChange(userId: number, to: PaidPlanId | "free"): Promise<{ ok: true; quote: Quote } | ChangeError> {
  const ctx = await prepare(userId, to);
  return ctx.ok ? { ok: true, quote: ctx.quote } : ctx;
}

/**
 * Ends someone's subscription now with the unused days refunded, with no confirmation step (for closing an account, which
 * has already been confirmed). Does nothing if they have no subscription. Throws if the subscription couldn't be cancelled.
 */
export async function cancelWithRefund(userId: number): Promise<{ refundedCents: number; refundProblem: boolean; currency: string } | null> {
  const subscriptionId = billingFor(userId).subscriptionId;
  if (!subscriptionId) return null;
  let quote: Quote;
  try {
    // Already ended (our record just hadn't caught up): nothing to cancel or refund.
    if ((await stripe().subscriptions.retrieve(subscriptionId)).status === "canceled") return null;
    const q = await quoteChange(userId, "free");
    if (!q.ok) throw new Error(q.error);
    quote = q.quote;
  } catch (error) {
    // Already gone on Stripe's side is fine; anything else must stop whatever called this.
    if ((error as { code?: string }).code === "resource_missing") return null;
    throw error;
  }
  const result = await changePlan(userId, "free", { refundCents: quote.refundCents, chargeCents: 0 });
  if (!result.ok) throw new Error(result.error);
  return { refundedCents: result.refundedCents, refundProblem: result.refundProblem, currency: quote.currency };
}

const inFlight = new Set<number>();

/**
 * Makes the change. `expect` is the amounts the person agreed to; if they've moved since (a day ticked over), nothing is
 * done and the new amounts come back to be agreed again. Returns what was refunded, or an error with nothing changed.
 */
export async function changePlan(
  userId: number,
  to: PaidPlanId | "free",
  expect: { refundCents: number; chargeCents: number },
): Promise<({ ok: true; refundedCents: number; chargedCents: number; refundProblem: boolean }) | ChangeError | { ok: false; error: string; status: 409; quote: Quote }> {
  if (inFlight.has(userId)) return fail("Your plan is already being changed. Give it a moment.", 409);
  inFlight.add(userId);
  try {
    const ctx = await prepare(userId, to);
    if (!ctx.ok) return ctx;
    const { subscription, item, oldInvoice, quote } = ctx;
    if (quote.refundCents !== expect.refundCents || quote.chargeCents !== expect.chargeCents) {
      return { ok: false, error: "The amounts changed. Please check them and confirm again.", status: 409, quote };
    }

    // Work out where the refund will come from before anything is charged, so we never charge and then find we can't refund.
    let refundFrom: { paymentIntent: string; refundable: number } | null = null;
    if (oldInvoice && quote.refundCents > 0) {
      refundFrom = await refundSource(oldInvoice);
      if (!refundFrom && to !== "free") return fail("We couldn't find the payment to refund, so nothing was changed. Please contact support.", 409);
    }
    // A cancellation always goes ahead; a refund that can't be made automatically is flagged for us to sort out.
    let refundProblem = to === "free" && quote.refundCents > 0 && !refundFrom;

    let updated: Stripe.Subscription;
    try {
      if (to === "free") {
        updated = await stripe().subscriptions.cancel(subscription.id, { prorate: false, invoice_now: false }, { idempotencyKey: `plan-cancel-${subscription.id}` });
      } else {
        updated = await stripe().subscriptions.update(
          subscription.id,
          {
            items: [{ id: item.id, price: priceIdFor(to) }],
            billing_cycle_anchor: { type: "now" as const },
            proration_behavior: "none" as const,
            // If the card can't pay for the new plan, nothing changes.
            payment_behavior: "error_if_incomplete",
            expand: ["latest_invoice"],
          },
          { idempotencyKey: `plan-change-${subscription.id}-${item.current_period_start}-${to}` },
        );
      }
    } catch (error) {
      console.error("Plan change failed:", error);
      if (to === "free") return fail("Couldn't cancel your subscription. Nothing was changed. Please try again.", 502);
      return fail("The payment for the new plan didn't go through, so your plan hasn't changed. Check your card from Manage billing and try again.", 402);
    }
    applySubscription(updated); // the plan changes now; Stripe's webhook will say the same thing a moment later

    // Only refund once the new plan's charge is confirmed paid (a cancellation has no charge to wait for).
    const latest = updated.latest_invoice;
    const charged = latest && typeof latest !== "string" && latest.id !== oldInvoice?.id && latest.status === "paid" ? latest : null;
    let refundedCents = 0;
    if (refundFrom && quote.refundCents > 0) {
      const amount = Math.min(quote.refundCents, refundFrom.refundable);
      if ((to !== "free" && !charged) || amount <= 0) {
        refundProblem = true;
        console.error(`Plan change for ${subscription.id}: refund of ${quote.refundCents} not made (new invoice paid: ${Boolean(charged)}, refundable: ${refundFrom.refundable}).`);
      } else {
        try {
          await stripe().refunds.create(
            { payment_intent: refundFrom.paymentIntent, amount, reason: "requested_by_customer", metadata: { subscription: subscription.id, reason: to === "free" ? "cancellation" : "plan_change", to } },
            { idempotencyKey: `plan-change-refund-${oldInvoice?.id}` },
          );
          refundedCents = amount;
        } catch (error) {
          refundProblem = true;
          console.error(`Plan change for ${subscription.id}: the refund of ${amount} failed:`, error);
        }
      }
    }
    if (to === "free" && quote.refundCents > 0 && refundedCents === 0) refundProblem = true;
    return { ok: true, refundedCents, chargedCents: charged?.amount_paid ?? 0, refundProblem };
  } catch (error) {
    console.error("Plan change failed unexpectedly:", error);
    return fail("Couldn't change your plan. Nothing was changed. Please try again.", 502);
  } finally {
    inFlight.delete(userId);
  }
}

/** The card payment behind an invoice, and how much of it can still be refunded. */
async function refundSource(invoice: Stripe.Invoice): Promise<{ paymentIntent: string; refundable: number } | null> {
  const payments = await stripe().invoicePayments.list({ invoice: invoice.id, status: "paid" });
  const pi = payments.data.map((p) => p.payment).find((p) => p.type === "payment_intent")?.payment_intent;
  if (!pi) return null;
  const paymentIntent = await stripe().paymentIntents.retrieve(typeof pi === "string" ? pi : pi.id, { expand: ["latest_charge"] });
  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge === "string") return null;
  return { paymentIntent: paymentIntent.id, refundable: Math.max(0, charge.amount - charge.amount_refunded) };
}
