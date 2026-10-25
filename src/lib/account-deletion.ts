import { billingConfigured, billingFor } from "./billing";
import { listChannels, removeChannel } from "./channels";
import { db } from "./db";
import { removeRemoteWebhook } from "./oauth";
import { cancelWithRefund } from "./plan-change";

// Closing an account. Everything an account owns (sites, history, alert addresses, integrations, branding, status pages,
// team seats, API keys) hangs off the user row with ON DELETE CASCADE, so deleting that row removes all of it. What it
// can't remove is outside our database: a paid subscription and the webhooks we created in Discord. Those go first.

/** What the delete page needs to warn about: whether a subscription will be cancelled, and how many team members lose access. */
export function deletionSummary(userId: number): { hasSubscription: boolean; teamMembers: number } {
  const members = db().prepare("SELECT COUNT(*) AS n FROM team_members WHERE owner_id = ?").get(userId) as { n: number };
  return { hasSubscription: Boolean(billingFor(userId).subscriptionId), teamMembers: members.n };
}

/** The stored password hash of an account, for confirming it's really them before anything is deleted. */
export function passwordHashFor(userId: number): string | null {
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | undefined;
  return row?.password_hash ?? null;
}

/** What happened to money when an account was deleted, for the confirmation email. */
export interface DeletionResult {
  refundedCents: number;
  /** The subscription was cancelled but its refund couldn't be sent automatically. */
  refundProblem: boolean;
  currency: string;
}

/**
 * Cancels the subscription (refunding its unused days, the same as cancelling from the Plans page), disconnects Discord
 * webhooks we made, then deletes the account and everything in it. The subscription is cancelled first and a failure stops
 * everything, so nobody is left paying for an account that's gone.
 */
export async function deleteAccount(userId: number): Promise<DeletionResult> {
  let result: DeletionResult = { refundedCents: 0, refundProblem: false, currency: "usd" };
  if (billingFor(userId).subscriptionId) {
    if (!billingConfigured()) throw new Error("Can't cancel the subscription: Stripe isn't configured.");
    result = (await cancelWithRefund(userId)) ?? result;
  }

  for (const channel of listChannels(userId)) {
    const removed = removeChannel(channel.id, userId);
    // Only webhooks we created by sign-in are deleted on Discord's side; a pasted one belongs to the person.
    if (removed?.via === "oauth" && removed.url) await removeRemoteWebhook(removed.kind, removed.url);
  }

  // The email can be used to sign up again straight away: the user row was the only thing holding it. A sign-up code
  // requested before the deletion is cleared too, so it can't be locked or stale when they come back.
  const conn = db();
  const row = conn.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
  conn.prepare("DELETE FROM users WHERE id = ?").run(userId);
  if (row) conn.prepare("DELETE FROM signup_codes WHERE email = ?").run(row.email);
  return result;
}
